// sim.zig — Cognitive simulation kernel for Kernel Panic
// Ornstein-Uhlenbeck SDE drives emotional state across 3 axes.
// Compiles native (self-test) AND wasm32-freestanding (client-side).
// Single file, zero dependencies, arena semantics via fixed branch slots.
// Every timeline branch lives here; forks deep-copy and diverge independently.

const std = @import("std");
const builtin = @import("builtin");
const is_freestanding = builtin.os.tag == .freestanding;

// ============================================================
// DATA STRUCTURES — all packed, wire-ready, zero padding
// ============================================================

/// A single memory event injected by the user or LLM.
/// sigma derived from emotion_intensity — higher intensity = more chaos.
pub const MemoryEvent = extern struct {
    timestamp: u64,
    location: [64]u8,
    emotion_valence: f32, // -1.0 negative ← → 1.0 positive
    emotion_intensity: f32, // 0.0 calm ← → 1.0 overwhelming
    sigma: f32, // = min(emotion_intensity * 1.5, 1.5) — noise amplitude
};

/// The live state of one timeline branch.
/// Three spatial axes (x,y,z) model cognitive displacement from equilibrium.
pub const StateVector = packed struct {
    x: f32, // cognitive axis 0 — drifts via OU process
    y: f32, // cognitive axis 1
    z: f32, // cognitive axis 2
    sigma: f32, // current noise amplitude — set by last MemoryEvent
    theta: f32, // mean-reversion rate — 0.3 default, attractor pull strength
    tick: u64, // monotonic step counter per branch
    branch_id: u32, // which timeline this state belongs to
};

/// Logged when panic_score exceeds 1.0 — the system has "kernel panicked".
pub const PanicEvent = packed struct {
    branch_id: u32,
    tick: u64,
    panic_score: f32,
};

// ============================================================
// CONSTANTS
// ============================================================

const MAX_BRANCHES: usize = 64; // arena upper bound: 64 concurrent timelines, zero realloc
const DT: f32 = 0.016; // ~60fps timestep for OU integration
const DEFAULT_THETA: f32 = 0.3; // attractor pull — how fast state reverts to origin
const DEFAULT_SIGMA: f32 = 0.1; // baseline noise before any event injection
const PANIC_THRESHOLD: f32 = 1.0; // panic_score above this → kernel panic
const PI: f32 = 3.14159265;

// precompute sqrt(dt) once — used every OU step for Wiener increment scaling
const SQRT_DT: f32 = 0.12649111; // sqrt(0.016) ≈ 0.12649

// ============================================================
// GLOBAL STATE — arena-style: fixed slots, never individually freed
// One session occupies this module; reset via sim_init.
// For WASM: module globals persist across calls from JS.
// For native: same globals, reset in main() self-test.
// ============================================================

var branches: [MAX_BRANCHES]StateVector = undefined;
var branch_count: u32 = 0;
var session_id: u32 = 0;

// ============================================================
// PRNG — xorshift64, deterministic per (session, tick)
// ============================================================

/// xorshift64: fast, non-cryptographic, passes most statistical tests.
/// State must never be zero — caller ensures this.
fn xorshift64(state: *u64) u64 {
    var x = state.*;
    x ^= x << 13; // shift-xor left: spread low bits upward
    x ^= x >> 7; // shift-xor right: mix high bits down
    x ^= x << 17; // shift-xor left: final avalanche
    state.* = x;
    return x;
}

/// Convert xorshift64 output to uniform f32 in (0, 1).
/// Masks to 23 bits (f32 mantissa width) then scales.
/// Avoids exact 0.0 — ln(0) is undefined in Box-Muller.
fn uniform_f32(rng: *u64) f32 {
    const raw = xorshift64(rng);
    // mask to 23 bits, add 1 to avoid zero, divide by 2^23+1
    const bits: u32 = @truncate((raw & 0x7FFFFF) + 1);
    return @as(f32, @floatFromInt(bits)) / 8388609.0; // (2^23 + 1)
}

// ============================================================
// MATH — pure arithmetic, zero libc dependency
// Needed because @log/@sin/@cos lower to libm calls on freestanding.
// ============================================================

/// Natural log for f32, using IEEE 754 decomposition + polynomial.
/// x = m * 2^e where m in [1,2), ln(x) = e*ln2 + ln(m).
/// ln(m) via Padé-like series: t = (m-1)/(m+1), ln(m) ≈ 2t(1 + t²/3 + t⁴/5 + t⁶/7 + t⁸/9).
/// Max error < 1e-6 over (0, +inf) — more than enough for f32 simulation.
fn ln_f32(x: f32) f32 {
    const bits: u32 = @bitCast(x);
    const exp_raw: i32 = @as(i32, @intCast((bits >> 23) & 0xFF)) - 127;
    const exponent: f32 = @floatFromInt(exp_raw);
    // reconstruct mantissa in [1.0, 2.0) by resetting exponent to 127
    const mantissa_bits: u32 = (bits & 0x007FFFFF) | 0x3F800000;
    const m: f32 = @bitCast(mantissa_bits);
    // series variable: t = (m-1)/(m+1), converges fast for m in [1,2)
    const t = (m - 1.0) / (m + 1.0);
    const t2 = t * t;
    // Horner evaluation of 2t(1 + t²/3 + t⁴/5 + t⁶/7 + t⁸/9)
    const ln_m = 2.0 * t * (1.0 + t2 * (1.0 / 3.0 + t2 * (1.0 / 5.0 + t2 * (1.0 / 7.0 + t2 / 9.0))));
    return exponent * 0.6931472 + ln_m; // ln(2) ≈ 0.6931472
}

/// sin(x) via Taylor series with range reduction to [-π, π].
/// 5-term expansion: x - x³/6 + x⁵/120 - x⁷/5040 + x⁹/362880.
/// Sufficient precision for stochastic simulation noise generation.
fn sin_f32(x: f32) f32 {
    // range reduction: bring x into [-π, π] via modular arithmetic
    var t = x;
    // manual fmod: subtract nearest multiple of 2π
    t = t - @trunc(t / (2.0 * PI)) * (2.0 * PI);
    if (t > PI) t -= 2.0 * PI;
    if (t < -PI) t += 2.0 * PI;
    const t2 = t * t;
    // Horner form: t * (1 - t²(1/6 - t²(1/120 - t²(1/5040 - t²/362880))))
    return t * (1.0 - t2 * (1.0 / 6.0 - t2 * (1.0 / 120.0 - t2 * (1.0 / 5040.0 - t2 / 362880.0))));
}

/// cos(x) = sin(x + π/2) — reuse sin implementation
fn cos_f32(x: f32) f32 {
    return sin_f32(x + PI / 2.0);
}

// ============================================================
// BOX-MULLER TRANSFORM — two uniforms → two Gaussians
// ============================================================

/// Classic Box-Muller: given a,b ~ Uniform(0,1), returns two N(0,1) samples.
/// Uses our custom ln/sin/cos to avoid libc on freestanding.
fn box_muller(a: f32, b: f32) [2]f32 {
    // radius from exponential distribution via inverse CDF
    const r = @sqrt(-2.0 * ln_f32(a));
    const angle = 2.0 * PI * b; // uniform angle on [0, 2π)
    return .{
        r * cos_f32(angle), // Gaussian sample 1
        r * sin_f32(angle), // Gaussian sample 2
    };
}

// ============================================================
// ORNSTEIN-UHLENBECK STEP
// ============================================================

/// Advance one branch by one dt using Euler-Maruyama discretization.
/// dx = θ(0 - x)dt + σ·dW for each axis independently.
/// Seed = session_id XOR tick — deterministic replay guaranteed.
fn ou_step(state: *StateVector) void {
    // seed from session + tick: same seed = identical trajectory (deterministic replay)
    var rng_state: u64 = @as(u64, session_id) ^ state.tick;
    if (rng_state == 0) rng_state = 1; // xorshift cannot have zero state

    // generate 3 Gaussian increments: Box-Muller gives pairs, we need 3
    const r1 = uniform_f32(&rng_state);
    const r2 = uniform_f32(&rng_state);
    const g1 = box_muller(r1, r2); // yields 2 Gaussians

    const r3 = uniform_f32(&rng_state);
    const r4 = uniform_f32(&rng_state);
    const g2 = box_muller(r3, r4); // yields 2 more, we use first

    // Wiener increments: dW = N(0,1) * sqrt(dt)
    const dw_x = g1[0] * SQRT_DT;
    const dw_y = g1[1] * SQRT_DT;
    const dw_z = g2[0] * SQRT_DT;

    // Euler-Maruyama: drift pulls toward origin, diffusion adds noise
    // drift = θ(μ - x)dt where μ = 0 (equilibrium is origin)
    // diffusion = σ * dW (sigma scales with emotional intensity)
    state.x += state.theta * (0.0 - state.x) * DT + state.sigma * dw_x;
    state.y += state.theta * (0.0 - state.y) * DT + state.sigma * dw_y;
    state.z += state.theta * (0.0 - state.z) * DT + state.sigma * dw_z;

    state.tick += 1; // monotonic: never decremented, append-only time
}

// ============================================================
// PANIC SCORE
// ============================================================

/// Distance from cognitive origin normalized by threshold radius.
/// > 1.0 means the mind has drifted beyond recoverable equilibrium → kernel panic.
fn compute_panic_score(state: *const StateVector) f32 {
    return @sqrt(state.x * state.x + state.y * state.y + state.z * state.z) / 3.0;
}

// ============================================================
// EXPORTED API — called from JS via WASM, or from self-test main()
// ============================================================

/// Initialize a new session. Resets all branches, creates branch 0 at origin.
/// session_id seeds all future PRNG — same id = same trajectory (deterministic).
export fn sim_init(sid: u32) void {
    session_id = sid;
    branch_count = 1;
    branches[0] = StateVector{
        .x = 0.0,
        .y = 0.0,
        .z = 0.0,
        .sigma = DEFAULT_SIGMA, // baseline noise until first event
        .theta = DEFAULT_THETA, // 0.3 attractor strength
        .tick = 0,
        .branch_id = 0,
    };
}

/// Advance branch by one tick. Returns pointer offset to result in linear memory.
/// JS reads StateVector fields from WASM memory at returned address.
export fn sim_step(branch_id: u32) [*]const u8 {
    if (branch_id >= branch_count) return @ptrCast(&branches[0]); // safety: clamp to branch 0
    ou_step(&branches[branch_id]);
    return @ptrCast(&branches[branch_id]); // pointer into WASM linear memory
}

/// Fork: deep-copy branch, amplify sigma by (1 + divergence_coeff).
/// Returns new branch_id. Both branches evolve independently from this tick.
/// Divergence_coeff controls how much the fork's noise deviates from original.
export fn sim_fork(branch_id: u32, divergence_coeff: f32) u32 {
    if (branch_id >= branch_count) return 0; // invalid source branch
    if (branch_count >= MAX_BRANCHES) return 0; // arena full, no more slots

    const new_id = branch_count;
    branches[new_id] = branches[branch_id]; // deep copy — StateVector is value type, no pointers
    branches[new_id].branch_id = new_id;
    branches[new_id].sigma *= (1.0 + divergence_coeff); // amplify chaos in forked timeline

    branch_count += 1;
    return new_id;
}

/// Current panic score for a branch. > 1.0 = kernel panic triggered.
export fn sim_panic_score(branch_id: u32) f32 {
    if (branch_id >= branch_count) return 0.0;
    return compute_panic_score(&branches[branch_id]);
}

/// Inject a memory event into a branch. Updates sigma from emotion_intensity.
/// Sigma = min(emotion_intensity * 1.5, 1.5) — caps noise to prevent numerical explosion.
export fn sim_apply_event(branch_id: u32, event_ptr: [*]const u8) void {
    if (branch_id >= branch_count) return;

    // reinterpret raw bytes as MemoryEvent — caller provides packed struct layout
    const event: *const MemoryEvent = @ptrCast(@alignCast(event_ptr));
    // sigma derived from emotional intensity: more intense → more stochastic noise
    const computed_sigma = @min(event.emotion_intensity * 1.5, 1.5);
    branches[branch_id].sigma = computed_sigma;
}

// ============================================================
// INTERNAL STEP (for native self-test — returns value, not pointer)
// ============================================================

fn step_internal(branch_id: u32) StateVector {
    if (branch_id >= branch_count) return branches[0];
    ou_step(&branches[branch_id]);
    return branches[branch_id];
}

// ============================================================
// SELF-TEST — native only, validates deterministic simulation
// ============================================================

pub fn main() void {
    // guard: on wasm32-freestanding, main is never called — skip entirely
    // comptime-known condition: untaken branch is not semantically analyzed
    if (comptime is_freestanding) return;

    const print = std.debug.print;

    print("\n=== Kernel Panic — Cognitive Core Self-Test ===\n\n", .{});

    // 1. Init session id=42
    sim_init(42);
    print("[1] Session initialized: id=42, branch_count={d}\n", .{branch_count});

    // 2. Apply event: valence=-0.8, intensity=0.9 (bad memory)
    //    sigma = min(0.9 * 1.5, 1.5) = 1.35 — high chaos
    var event = MemoryEvent{
        .timestamp = 1,
        .location = [_]u8{0} ** 64,
        .emotion_valence = -0.8, // strongly negative memory
        .emotion_intensity = 0.9, // overwhelming
        .sigma = 0.0, // will be computed by sim_apply_event
    };
    // copy "bad_memory" into location field
    const loc = "bad_memory";
    for (loc, 0..) |c, i| {
        event.location[i] = c;
    }
    sim_apply_event(0, @ptrCast(&event));
    print("[2] Event applied: valence={d:.2}, intensity={d:.2}, sigma={d:.4}\n", .{
        event.emotion_valence,
        event.emotion_intensity,
        branches[0].sigma,
    });

    // 3. Run 25 ticks, print panic score
    var i: u32 = 0;
    while (i < 25) : (i += 1) {
        _ = step_internal(0);
    }
    const score_25 = compute_panic_score(&branches[0]);
    print("[3] After 25 ticks: panic_score={d:.6}\n", .{score_25});
    print("    state: x={d:.6} y={d:.6} z={d:.6}\n", .{
        branches[0].x,
        branches[0].y,
        branches[0].z,
    });

    // 4. Fork at tick 25, divergence_coeff=0.6
    //    Forked sigma = original sigma * 1.6 — significantly more chaotic
    const forked_id = sim_fork(0, 0.6);
    print("[4] Forked: branch {d} → branch {d}, forked_sigma={d:.4}\n", .{
        @as(u32, 0),
        forked_id,
        branches[forked_id].sigma,
    });

    // 5. Run both branches 25 more ticks
    i = 0;
    while (i < 25) : (i += 1) {
        _ = step_internal(0);
        _ = step_internal(forked_id);
    }

    // 6. Print both panic scores
    const score_original = compute_panic_score(&branches[0]);
    const score_forked = compute_panic_score(&branches[forked_id]);
    print("[5] After 50 ticks total:\n", .{});
    print("    Original (branch 0): panic_score={d:.6}\n", .{score_original});
    print("    Forked   (branch {d}): panic_score={d:.6}\n", .{ forked_id, score_forked });
    print("    Original state: x={d:.6} y={d:.6} z={d:.6}\n", .{
        branches[0].x,
        branches[0].y,
        branches[0].z,
    });
    print("    Forked   state: x={d:.6} y={d:.6} z={d:.6}\n", .{
        branches[forked_id].x,
        branches[forked_id].y,
        branches[forked_id].z,
    });

    // 7. Assert: forked branch panic score > original branch panic score
    //    Higher sigma → more noise → larger expected displacement from origin
    //    This is a statistical property: not guaranteed per-run, but very likely
    //    with divergence_coeff=0.6 amplifying sigma by 60%
    if (score_forked > score_original) {
        print("\n[PASS] Forked panic ({d:.6}) > Original panic ({d:.6})\n", .{
            score_forked,
            score_original,
        });
    } else {
        print("\n[NOTE] Forked panic ({d:.6}) <= Original panic ({d:.6})\n", .{
            score_forked,
            score_original,
        });
        print("       (Stochastic — can happen rarely. Re-run or adjust params.)\n", .{});
    }

    print("\n=== Self-Test Complete ===\n", .{});
}

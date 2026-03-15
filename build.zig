// Kernel Panic — build configuration
// Two targets from one source: native (self-test) + wasm32-freestanding (client-side sim)
const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{}); // native host by default, overridable with -Dtarget
    const optimize = b.standardOptimizeOption(.{});

    // === Native executable: self-test runner ===
    // Compiles sim.zig with main() for deterministic verification on host machine
    const exe = b.addExecutable(.{
        .name = "kernel-panic-sim",
        .root_module = b.createModule(.{
            .root_source_file = b.path("sim/sim.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });
    b.installArtifact(exe);

    // `zig build run` — execute the self-test directly
    const run_cmd = b.addRunArtifact(exe);
    run_cmd.step.dependOn(b.getInstallStep());
    const run_step = b.step("run", "Run the simulation self-test");
    run_step.dependOn(&run_cmd.step);

    // === WASM module: client-side simulation kernel ===
    // Same source, wasm32-freestanding target — exports sim_init/step/fork/panic_score/apply_event
    // No entry point; the browser calls exported functions directly
    const wasm = b.addExecutable(.{
        .name = "kernel-panic-sim",
        .root_module = b.createModule(.{
            .root_source_file = b.path("sim/sim.zig"),
            .target = b.resolveTargetQuery(.{
                .cpu_arch = .wasm32,
                .os_tag = .freestanding,
            }),
            .optimize = optimize,
        }),
    });
    // rdynamic: export all `export fn` symbols to the WASM host
    wasm.root_module.export_symbol_names = &.{
        "sim_init",
        "sim_step",
        "sim_fork",
        "sim_panic_score",
        "sim_apply_event",
    };
    const install_wasm = b.addInstallArtifact(wasm, .{});
    const wasm_step = b.step("wasm", "Build the WASM simulation module");
    wasm_step.dependOn(&install_wasm.step);
}

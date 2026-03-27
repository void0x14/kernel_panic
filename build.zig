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

    const event_mod = b.createModule(.{
        .root_source_file = b.path("store/event.zig"),
        .target = target,
        .optimize = optimize,
    });
    const protocol_mod = b.createModule(.{
        .root_source_file = b.path("net/protocol.zig"),
        .target = target,
        .optimize = optimize,
    });
    protocol_mod.addImport("event", event_mod);

    const store_mod = b.createModule(.{
        .root_source_file = b.path("store/store.zig"),
        .target = target,
        .optimize = optimize,
    });
    store_mod.addImport("event", event_mod);
    store_mod.addImport("protocol", protocol_mod);

    const handler_mod = b.createModule(.{
        .root_source_file = b.path("net/handler.zig"),
        .target = target,
        .optimize = optimize,
    });
    handler_mod.addImport("event", event_mod);
    handler_mod.addImport("protocol", protocol_mod);
    handler_mod.addImport("store", store_mod);

    const backend_root = b.createModule(.{
        .root_source_file = b.path("kernel/main.zig"),
        .target = target,
        .optimize = optimize,
    });
    backend_root.addImport("handler", handler_mod);
    backend_root.addImport("store", store_mod);

    const backend = b.addExecutable(.{
        .name = "kernel-panic-backend",
        .root_module = backend_root,
    });
    const install_backend = b.addInstallArtifact(backend, .{});
    const backend_step = b.step("backend", "Build the backend server");
    backend_step.dependOn(&install_backend.step);

    const run_backend = b.addRunArtifact(backend);
    run_backend.step.dependOn(b.getInstallStep());
    const backend_run_step = b.step("backend-run", "Run the backend server");
    backend_run_step.dependOn(&run_backend.step);

    const protocol_test = b.addTest(.{ .root_module = protocol_mod });
    const run_protocol_test = b.addRunArtifact(protocol_test);
    const store_test = b.addTest(.{ .root_module = store_mod });
    const run_store_test = b.addRunArtifact(store_test);
    const handler_test = b.addTest(.{ .root_module = handler_mod });
    const run_handler_test = b.addRunArtifact(handler_test);
    const backend_test_step = b.step("backend-test", "Run backend foundation tests");
    backend_test_step.dependOn(&run_protocol_test.step);
    backend_test_step.dependOn(&run_store_test.step);
    backend_test_step.dependOn(&run_handler_test.step);
}

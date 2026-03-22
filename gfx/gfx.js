async function init() {
    const canvas = document.getElementById('c');

    // ============================================================
    // WebGPU setup — identical to Phase 2, no changes needed
    // ============================================================
    if (!navigator.gpu) {
        document.body.innerHTML = '<p style="color:red;padding:2em;font-size:1.5em">WebGPU not supported. Use Chrome 113+ or Edge 113+.</p>';
        return;
    }

    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) {
        document.body.innerHTML = '<p style="color:red;padding:2em;font-size:1.5em">No WebGPU adapter found.</p>';
        return;
    }
    const device = await adapter.requestDevice();

    const context = canvas.getContext('webgpu');
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: 'premultiplied' });

    function resize() {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
    }
    resize();
    window.addEventListener('resize', resize);

    // ============================================================
    // Shaders — unchanged from Phase 2
    // ============================================================
    const shaderCode = /* wgsl */ `
        struct Uniforms {
            view_proj: mat4x4<f32>,
        };
        @group(0) @binding(0) var<uniform> uniforms: Uniforms;

        struct VertexInput {
            @location(0) position: vec3<f32>,
            @location(1) color: vec3<f32>,
        };

        struct VertexOutput {
            @builtin(position) clip_position: vec4<f32>,
            @location(0) frag_color: vec3<f32>,
        };

        @vertex
        fn vs_main(in: VertexInput) -> VertexOutput {
            var out: VertexOutput;
            out.clip_position = uniforms.view_proj * vec4<f32>(in.position, 1.0);
            out.frag_color = in.color;
            return out;
        }

        @fragment
        fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
            return vec4<f32>(in.frag_color, 1.0);
        }
    `;

    const bindGroupLayout = device.createBindGroupLayout({
        entries: [{
            binding: 0,
            visibility: GPUShaderStage.VERTEX,
            buffer: { type: 'uniform' },
        }],
    });

    const pipelineLayout = device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout],
    });

    const pipeline = device.createRenderPipeline({
        layout: pipelineLayout,
        vertex: {
            module: device.createShaderModule({ code: shaderCode }),
            entryPoint: 'vs_main',
            buffers: [{
                arrayStride: 24,
                attributes: [
                    { shaderLocation: 0, offset: 0, format: 'float32x3' },
                    { shaderLocation: 1, offset: 12, format: 'float32x3' },
                ],
            }],
        },
        fragment: {
            module: device.createShaderModule({ code: shaderCode }),
            entryPoint: 'fs_main',
            targets: [{ format }],
        },
        primitive: { topology: 'point-list' },
    });

    // ============================================================
    // Camera — identical to Phase 2
    // ============================================================
    const camera = {
        x: 0.0, y: 0.0, z: -5.0,
        pitch: 0.0,
        yaw: 0.0,
    };

    function mat4Perspective(fovY, aspect, near, far) {
        const f = 1.0 / Math.tan(fovY / 2.0);
        const rangeInv = 1.0 / (near - far);
        return new Float32Array([
            f / aspect, 0, 0, 0,
            0, f, 0, 0,
            0, 0, (near + far) * rangeInv, -1,
            0, 0, near * far * rangeInv * 2, 0,
        ]);
    }

    function mat4LookAt(eye, target, up) {
        const zx = eye[0] - target[0], zy = eye[1] - target[1], zz = eye[2] - target[2];
        let len = Math.sqrt(zx * zx + zy * zy + zz * zz);
        const fz = [zx / len, zy / len, zz / len];
        const sx = up[1] * fz[2] - up[2] * fz[1];
        const sy = up[2] * fz[0] - up[0] * fz[2];
        const sz = up[0] * fz[1] - up[1] * fz[0];
        len = Math.sqrt(sx * sx + sy * sy + sz * sz);
        const fx = [sx / len, sy / len, sz / len];
        const ux = [fz[1] * fx[2] - fz[2] * fx[1], fz[2] * fx[0] - fz[0] * fx[2], fz[0] * fx[1] - fz[1] * fx[0]];
        return new Float32Array([
            fx[0], ux[0], fz[0], 0,
            fx[1], ux[1], fz[1], 0,
            fx[2], ux[2], fz[2], 0,
            -(fx[0] * eye[0] + fx[1] * eye[1] + fx[2] * eye[2]),
            -(ux[0] * eye[0] + ux[1] * eye[1] + ux[2] * eye[2]),
            -(fz[0] * eye[0] + fz[1] * eye[1] + fz[2] * eye[2]),
            1,
        ]);
    }

    function mat4Mul(a, b) {
        const o = new Float32Array(16);
        for (let c = 0; c < 4; c++) {
            for (let r = 0; r < 4; r++) {
                o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
            }
        }
        return o;
    }

    function getViewProjMatrix() {
        const aspect = canvas.width / canvas.height;
        const proj = mat4Perspective(75 * Math.PI / 180, aspect, 0.1, 100.0);
        const dirX = Math.cos(camera.pitch) * Math.sin(camera.yaw);
        const dirY = -Math.sin(camera.pitch);
        const dirZ = Math.cos(camera.pitch) * Math.cos(camera.yaw);
        const view = mat4LookAt(
            [camera.x, camera.y, camera.z],
            [camera.x + dirX, camera.y + dirY, camera.z + dirZ],
            [0, 1, 0],
        );
        return mat4Mul(proj, view);
    }

    // ============================================================
    // GPU buffers — uniform stays same, vertex buffer now dynamic
    // ============================================================
    const uniformBuffer = device.createBuffer({
        size: 64,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const bindGroup = device.createBindGroup({
        layout: bindGroupLayout,
        entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
    });

    // Pre-allocate vertex buffer for MAX_BRANCHES = 64
    // Each point: [x, y, z, r, g, b] = 6 floats = 24 bytes
    // Total: 64 * 24 = 1536 bytes
    const MAX_BRANCHES = 64;
    const vertexData = new Float32Array(MAX_BRANCHES * 6);
    const vertexBuffer = device.createBuffer({
        size: vertexData.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    // ============================================================
    // WASM loading — sim_init(42) on load, expose exports globally
    // ============================================================
    const { instance } = await WebAssembly.instantiateStreaming(
        fetch('../zig-out/bin/kernel-panic-sim.wasm'),
    );
    const wasm = instance.exports;

    // Initialize simulation session with seed 42
    wasm.sim_init(42);

    // Track active branch count from JS side (mirrors wasm internal state)
    let activeBranchCount = 1;

    // DataView for reading WASM linear memory (must be recreated on memory.growth)
    let mem = new DataView(wasm.memory.buffer);

    // Expose WASM globally for parser.js
    window._kpWasm = wasm;

    // Panic display update — called by parser.js after event injection
    window._kpUpdatePanic = function () {
        updatePanicDisplay();
    };

    console.log('Phase 3: WASM loaded, sim running');

    // ============================================================
    // Branch color mapping — deterministic per branch_id
    // ============================================================
    // WHY branch-based colors: lets the eye track which timeline is which
    function getBranchColor(branchId, panicScore) {
        if (panicScore > 1.0) return [1.0, 0.1, 0.1]; // panic override: red
        switch (branchId) {
            case 0: return [1.0, 1.0, 1.0];       // white — the original
            case 1: return [0.0, 0.8, 1.0];       // cyan — first fork
            case 2: return [1.0, 0.8, 0.0];       // yellow — second fork
            default: return [1.0, 0.5, 0.0];      // orange — deep forks
        }
    }

    // ============================================================
    // Input — keyboard + pointer lock (same as Phase 2, plus F key)
    // ============================================================
    const keys = {};
    window.addEventListener('keydown', (e) => { keys[e.code] = true; });
    window.addEventListener('keyup', (e) => { keys[e.code] = false; });

    let mouseLocked = false;
    canvas.addEventListener('click', () => {
        if (!mouseLocked) canvas.requestPointerLock();
    });
    document.addEventListener('pointerlockchange', () => {
        mouseLocked = document.pointerLockElement === canvas;
    });
    document.addEventListener('mousemove', (e) => {
        if (!mouseLocked) return;
        const sensitivity = 0.002;
        camera.yaw += e.movementX * sensitivity;
        camera.pitch += e.movementY * sensitivity;
        const maxPitch = 89 * Math.PI / 180;
        if (camera.pitch > maxPitch) camera.pitch = maxPitch;
        if (camera.pitch < -maxPitch) camera.pitch = -maxPitch;
    });

    // ============================================================
    // Self-test logging — once per second
    // ============================================================
    let lastLogTime = performance.now();

    function logStatus() {
        const scores = [];
        for (let i = 0; i < activeBranchCount; i++) {
            const score = wasm.sim_panic_score(i);
            scores.push(`b${i}:${score.toFixed(3)}`);
        }
        console.log(`branches=${activeBranchCount} panic=[${scores.join(', ')}]`);
    }

    function updatePanicDisplay() {
        const panicEl = document.getElementById('kp-panic-scores');
        const branchEl = document.getElementById('kp-branch-list');
        const sceneEl = document.getElementById('kp-scene-data');
        if (!panicEl || !branchEl) return;

        let panicHtml = '';
        let branchHtml = '';
        for (let i = 0; i < activeBranchCount; i++) {
            const score = wasm.sim_panic_score(i);
            const isPanic = score > 1.0;
            const scoreClass = isPanic ? 'panic-alert' : '';
            const color = i === 0 ? '#FFFFFF' : i === 1 ? '#00C8FF' : i === 2 ? '#FFC800' : '#FF8000';
            panicHtml += `<div class="${scoreClass}">b${i}: ${score.toFixed(4)}</div>`;
            branchHtml += `<div style="color:${color}">b${i} ${isPanic ? '⚠ PANIC' : ''}</div>`;
        }
        panicEl.innerHTML = panicHtml;
        branchEl.innerHTML = branchHtml;

        if (!sceneEl) return;

        const sceneData = window._kpSceneData || {};
        const sceneRows = [
            ['source', sceneData.source ? sceneData.source.toUpperCase() : '-'],
            ['location', sceneData.location || '-'],
            ['time', sceneData.time_of_day || '-'],
            ['weather', sceneData.weather || '-'],
            ['atmosphere', sceneData.atmosphere || '-'],
            ['valence', Number.isFinite(sceneData.emotion_valence) ? sceneData.emotion_valence.toFixed(3) : '-'],
            ['intensity', Number.isFinite(sceneData.emotion_intensity) ? sceneData.emotion_intensity.toFixed(3) : '-'],
        ];

        sceneEl.innerHTML = sceneRows.map(([key, value]) => (
            `<div class="scene-row"><span class="scene-key">${key}</span><span class="scene-value">${value}</span></div>`
        )).join('');
    }

    // ============================================================
    // Render loop — sim_step drives positions, dynamic vertex upload
    // ============================================================
    function frame() {
        // Re-read DataView if WASM memory grew (unlikely but safe)
        mem = new DataView(wasm.memory.buffer);

        // F key: fork from branch 0 with divergence_coeff=0.6
        // WHY branch 0: the original timeline is always the fork source
        if (keys['KeyF'] && activeBranchCount < MAX_BRANCHES) {
            const newId = wasm.sim_fork(0, 0.6);
            if (newId > 0) {
                activeBranchCount = newId + 1;
                console.log(`Forked: new branch ${newId}, active=${activeBranchCount}`);
            }
            keys['KeyF'] = false; // debounce: one fork per press
        }

        // P key: log camera position
        if (keys['KeyP']) {
            console.log(`Camera: (${camera.x.toFixed(2)}, ${camera.y.toFixed(2)}, ${camera.z.toFixed(2)}) yaw=${(camera.yaw * 180 / Math.PI).toFixed(1)}° pitch=${(camera.pitch * 180 / Math.PI).toFixed(1)}°`);
            keys['KeyP'] = false;
        }

        // WASD movement
        const moveSpeed = 0.1;
        const fwdX = Math.sin(camera.yaw);
        const fwdZ = Math.cos(camera.yaw);
        const rightX = Math.cos(camera.yaw);
        const rightZ = -Math.sin(camera.yaw);
        if (keys['KeyW']) { camera.x += fwdX * moveSpeed; camera.z += fwdZ * moveSpeed; }
        if (keys['KeyS']) { camera.x -= fwdX * moveSpeed; camera.z -= fwdZ * moveSpeed; }
        if (keys['KeyA']) { camera.x -= rightX * moveSpeed; camera.z -= rightZ * moveSpeed; }
        if (keys['KeyD']) { camera.x += rightX * moveSpeed; camera.z += rightZ * moveSpeed; }
        if (keys['Space'])     camera.y += moveSpeed;
        if (keys['ShiftLeft']) camera.y -= moveSpeed;

        // Step simulation and populate vertex buffer
        for (let i = 0; i < activeBranchCount; i++) {
            const ptr = wasm.sim_step(i); // returns byte offset into WASM memory

            // Read StateVector fields from WASM linear memory
            const x = mem.getFloat32(ptr + 0, true);
            const y = mem.getFloat32(ptr + 4, true);
            const z = mem.getFloat32(ptr + 8, true);
            // sigma at ptr+12, theta at ptr+16 — not needed for rendering
            // tick at ptr+20 (u64), branch_id at ptr+28 (u32) — already known

            // Compute panic score for color decision
            const panicScore = wasm.sim_panic_score(i);
            const [r, g, b] = getBranchColor(i, panicScore);

            // Write interleaved [x, y, z, r, g, b] into vertex buffer
            const off = i * 6;
            vertexData[off + 0] = x;
            vertexData[off + 1] = y;
            vertexData[off + 2] = z;
            vertexData[off + 3] = r;
            vertexData[off + 4] = g;
            vertexData[off + 5] = b;
        }

        // Upload vertex data to GPU — only active branches
        device.queue.writeBuffer(vertexBuffer, 0, vertexData, 0, activeBranchCount * 6);

        // Self-test: log branch stats every second
        const now = performance.now();
        if (now - lastLogTime > 1000) {
            logStatus();
            updatePanicDisplay();
            lastLogTime = now;
        }

        // Standard WebGPU render pass
        const vpMatrix = getViewProjMatrix();
        device.queue.writeBuffer(uniformBuffer, 0, vpMatrix);

        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
            colorAttachments: [{
                view: context.getCurrentTexture().createView(),
                clearValue: { r: 0.039, g: 0.039, b: 0.039, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store',
            }],
        });
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.setVertexBuffer(0, vertexBuffer);
        pass.draw(activeBranchCount); // only draw active branches, not all 64
        pass.end();
        device.queue.submit([encoder.finish()]);
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}
init();

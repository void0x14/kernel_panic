async function init() {
    // ============================================================
    // BOOT DIAGNOSTICS — measure each stage
    // ============================================================
    const diag = {
        secure_context: window.isSecureContext,
        page_url: location.href,
        has_navigator_gpu: false,
        adapter_ok: false,
        device_ok: false,
        gpu_stage: 'not_started',
        gpu_error: '',
        wasm_ok: false,
        wasm_error: '',
    };

    // Stage 1: navigator.gpu exists?
    diag.has_navigator_gpu = !!navigator.gpu;
    if (!diag.has_navigator_gpu) {
        diag.gpu_stage = 'api_missing';
    }

    // Stage 2: adapter
    let adapter = null;
    if (diag.gpu_stage === 'not_started') {
        try {
            adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
            if (!adapter) {
                diag.gpu_stage = 'adapter_null';
            } else {
                diag.adapter_ok = true;
            }
        } catch (e) {
            diag.gpu_stage = 'adapter_error';
            diag.gpu_error = e.message || String(e);
        }
    }

    // Stage 3: device
    let device = null;
    if (diag.gpu_stage === 'not_started') {
        try {
            device = await adapter.requestDevice();
            diag.device_ok = true;
            diag.gpu_stage = 'ok';
        } catch (e) {
            diag.gpu_stage = 'device_failed';
            diag.gpu_error = e.message || String(e);
        }
    }

    // Stage 4: WASM
    let wasm = null;
    try {
        const { instance } = await WebAssembly.instantiateStreaming(
            fetch('../zig-out/bin/kernel-panic-sim.wasm'),
        );
        wasm = instance.exports;
        wasm.sim_init(42);
        window._kpWasm = wasm;
        diag.wasm_ok = true;
    } catch (e) {
        diag.wasm_ok = false;
        diag.wasm_error = e.message || String(e);
    }

    // Publish diagnostics
    window._kpBootDiag = diag;
    console.log('[BOOT] ' + JSON.stringify(diag));

    // ============================================================
    // Original boot continues from here (unchanged behavior)
    // ============================================================
    const canvas = document.getElementById('c');

    function clamp01(value) {
        return Math.min(1, Math.max(0, value));
    }

    function lerp(a, b, t) {
        return a + (b - a) * t;
    }

    function mixColor(a, b, t) {
        return [
            lerp(a[0], b[0], t),
            lerp(a[1], b[1], t),
            lerp(a[2], b[2], t),
        ];
    }

    function colorToCss(color, alpha) {
        return `rgba(${Math.round(clamp01(color[0]) * 255)}, ${Math.round(clamp01(color[1]) * 255)}, ${Math.round(clamp01(color[2]) * 255)}, ${alpha})`;
    }

    function getAmbientTint(timeOfDay) {
        switch (timeOfDay) {
            case 'morning': return [0.72, 0.80, 0.92];
            case 'afternoon': return [0.92, 0.92, 0.86];
            case 'evening': return [0.88, 0.58, 0.36];
            case 'night': return [0.14, 0.18, 0.34];
            default: return [0.42, 0.46, 0.52];
        }
    }

    function getAtmosphereTint(atmosphere) {
        switch (atmosphere) {
            case 'tense': return [0.72, 0.18, 0.16];
            case 'calm': return [0.18, 0.46, 0.66];
            case 'melancholic': return [0.36, 0.34, 0.54];
            case 'euphoric': return [0.94, 0.72, 0.28];
            case 'neutral': return [0.38, 0.40, 0.42];
            default: return [0.38, 0.40, 0.42];
        }
    }

    function getFogScalar(weather) {
        switch (weather) {
            case 'clear': return 0.02;
            case 'overcast': return 0.18;
            case 'rain': return 0.30;
            case 'fog': return 0.52;
            default: return 0.10;
        }
    }

    function buildVisualState(sceneData, panicScore) {
        const ambientTint = getAmbientTint(sceneData.time_of_day);
        const atmosphereTint = getAtmosphereTint(sceneData.atmosphere);
        const fogScalar = getFogScalar(sceneData.weather);
        const intensity = Number.isFinite(sceneData.emotion_intensity) ? clamp01(sceneData.emotion_intensity) : 0;
        const panic = Number.isFinite(panicScore) ? clamp01(panicScore / 1.5) : 0;
        const desaturationScalar = clamp01(panic * 0.85);
        const distortionScalar = clamp01(panic * 0.9 + intensity * 0.25);
        const jitterScalar = clamp01(intensity * 0.75);
        const clearColor = mixColor(ambientTint, atmosphereTint, 0.38 + panic * 0.2);

        return {
            ambient_tint: ambientTint,
            atmosphere_tint: atmosphereTint,
            fog_scalar: fogScalar,
            jitter_scalar: jitterScalar,
            distortion_scalar: distortionScalar,
            desaturation_scalar: desaturationScalar,
            clear_color: clearColor,
        };
    }

    function applyVisualState(sceneData, panicScore) {
        const visualState = buildVisualState(sceneData || {}, panicScore);
        const topColor = mixColor(visualState.clear_color, [1, 1, 1], 0.08);
        const bottomColor = mixColor(visualState.clear_color, [0, 0, 0], 0.72 + visualState.desaturation_scalar * 0.12);
        const hazeAlpha = clamp01(0.16 + visualState.fog_scalar * 0.55);
        document.body.style.background = `radial-gradient(circle at top, ${colorToCss(topColor, 0.96)} 0%, ${colorToCss(visualState.atmosphere_tint, 0.42)} 38%, ${colorToCss(bottomColor, 1)} 100%)`;
        canvas.style.filter = `blur(${(visualState.fog_scalar * 3.5).toFixed(2)}px) saturate(${(1 - visualState.desaturation_scalar * 0.55).toFixed(2)}) contrast(${(1 + visualState.distortion_scalar * 0.18).toFixed(2)}) brightness(${(0.92 + (1 - visualState.fog_scalar) * 0.12).toFixed(2)})`;
        canvas.style.opacity = `${(0.88 + (1 - visualState.fog_scalar) * 0.12).toFixed(2)}`;
        canvas.style.boxShadow = `inset 0 0 ${Math.round(36 + visualState.distortion_scalar * 90)}px ${colorToCss(visualState.atmosphere_tint, hazeAlpha)}`;
        window._kpVisualState = visualState;
        return visualState;
    }

    // Derive runtime state from diagnostics
    const hasWebGPU = diag.gpu_stage === 'ok';

    if (!hasWebGPU || !wasm) {
        let activeBranchCount = 1;
        function updatePanicDisplay() {
            if (!wasm) return;
            const panicEl = document.getElementById('kp-panic-scores');
            const branchEl = document.getElementById('kp-branch-list');
            const sceneEl = document.getElementById('kp-scene-data');
            if (!panicEl || !branchEl) return;
            let panicHtml = '';
            let branchHtml = '';
            for (let i = 0; i < activeBranchCount; i++) {
                const score = wasm.sim_panic_score(i);
                const isPanic = score > 1.0;
                const color = i === 0 ? '#FFFFFF' : i === 1 ? '#00C8FF' : i === 2 ? '#FFC800' : '#FF8000';
                panicHtml += `<div class="${isPanic ? 'panic-alert' : ''}">b${i}: ${score.toFixed(4)}</div>`;
                branchHtml += `<div style="color:${color}">b${i} ${isPanic ? '⚠ PANIC' : ''}</div>`;
            }
            panicEl.innerHTML = panicHtml;
            branchEl.innerHTML = branchHtml;
            if (!sceneEl) return;
            const sceneData = window._kpSceneData || {};
            applyVisualState(sceneData, wasm.sim_panic_score(0));
            const sceneRows = [
                ['source', sceneData.source ? sceneData.source.toUpperCase() : '-'],
                ['location', sceneData.location || '-'],
                ['time', sceneData.time_of_day || '-'],
                ['weather', sceneData.weather || '-'],
                ['atmosphere', sceneData.atmosphere || '-'],
                ['valence', Number.isFinite(sceneData.emotion_valence) ? sceneData.emotion_valence.toFixed(3) : '-'],
                ['intensity', Number.isFinite(sceneData.emotion_intensity) ? sceneData.emotion_intensity.toFixed(3) : '-'],
                ['llm_status', sceneData.llm_status || '-'],
                ['latency_ms', sceneData.llm_latency_ms ?? '-'],
                ['fallback_reason', sceneData.fallback_reason || '-'],
            ];
            sceneEl.innerHTML = sceneRows.map(([key, value]) => (
                `<div class="scene-row"><span class="scene-key">${key}</span><span class="scene-value">${value}</span></div>`
            )).join('');
        }
        setInterval(updatePanicDisplay, 250);
        console.log('[INIT] UI-only mode (no render) - polling active');
        return;
    }

    // ============================================================
    // WebGPU render path — below only runs if hasWebGPU && wasm
    // ============================================================
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

    // Track active branch count from JS side (mirrors wasm internal state)
    let activeBranchCount = 1;

    // DataView for reading WASM linear memory (must be recreated on memory.growth)
    let mem = new DataView(wasm.memory.buffer);

    console.log('[INIT] WASM loaded, sim running, WebGPU render active');

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
            ['llm_status', sceneData.llm_status || '-'],
            ['latency_ms', sceneData.llm_latency_ms ?? '-'],
            ['fallback_reason', sceneData.fallback_reason || '-'],
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
            const visualState = buildVisualState(window._kpSceneData || {}, wasm.sim_panic_score(0));
            const jitter = visualState.jitter_scalar * (1 + visualState.distortion_scalar) * 0.035;
            const phase = performance.now() * 0.008 + i * 1.7;

            // Write interleaved [x, y, z, r, g, b] into vertex buffer
            const off = i * 6;
            vertexData[off + 0] = x + Math.sin(phase) * jitter;
            vertexData[off + 1] = y + Math.cos(phase * 1.37) * jitter;
            vertexData[off + 2] = z;
            vertexData[off + 3] = r;
            vertexData[off + 4] = g;
            vertexData[off + 5] = b;
        }

        // Upload vertex data to GPU — only active branches
        device.queue.writeBuffer(vertexBuffer, 0, vertexData, 0, activeBranchCount * 6);

        // Self-test: log branch stats every 250ms
        const now = performance.now();
        if (now - lastLogTime > 250) {
            logStatus();
            updatePanicDisplay();
            lastLogTime = now;
        }

        // Standard WebGPU render pass
        const vpMatrix = getViewProjMatrix();
        device.queue.writeBuffer(uniformBuffer, 0, vpMatrix);
        const activeVisualState = applyVisualState(window._kpSceneData || {}, wasm.sim_panic_score(0));

        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
            colorAttachments: [{
                view: context.getCurrentTexture().createView(),
                clearValue: {
                    r: activeVisualState.clear_color[0],
                    g: activeVisualState.clear_color[1],
                    b: activeVisualState.clear_color[2],
                    a: 1.0,
                },
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

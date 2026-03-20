# WebGPU Base Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working WebGPU 3D scene in `gfx/index.html` that renders 20 nodes (5 red "PANIC" nodes, 15 white nodes) with a first-person camera controlled by WASD + mouse.

**Architecture:** Single `index.html` file with ALL JavaScript and WGSL inline — zero dependencies, zero imports. WebGPU pipeline: vertex buffer (interleaved position+color), uniform buffer (4x4 view-projection matrix updated each frame), WGSL vertex/fragment shaders. Camera uses pointer-lock for mouse look and keyboard for WASD movement. Render loop via requestAnimationFrame.

**Tech Stack:** Vanilla JS (no framework), WebGPU API, WGSL (WebGPU Shading Language)

---

## File Structure

| File | Responsibility |
|------|----------------|
| `gfx/index.html` | Everything: HTML canvas, inline JS (init, shaders, camera, render loop), inline WGSL vertex+fragment shaders |

Single file. No modules. No imports. All code inline as template literals (WGSL) and script blocks (JS).

---

## Verification Method

This project has no automated test framework. Each task includes **manual verification** steps:
- Open `gfx/index.html` in a WebGPU-capable browser (Chrome 113+, Edge 113+, Firefox Nightly with flag)
- Check browser DevTools console for errors or expected log messages
- Visual checks: color, position, movement responsiveness
- Press specific keys to trigger diagnostic output

---

### Task 1: HTML Canvas + WebGPU Device Initialization

**Files:**
- Create: `gfx/index.html`

**Goal:** Get a canvas on screen, detect WebGPU, obtain GPUDevice, clear background to `#0a0a0a`.

- [ ] **Step 1: Create the HTML skeleton with canvas, styles, and WebGPU init**

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kernel Panic — GFX</title>
    <style>
        /* Fullscreen canvas, no scrollbars, no margin */
        * { margin: 0; padding: 0; }
        body { overflow: hidden; background: #000; }
        canvas { display: block; width: 100vw; height: 100vh; }
    </style>
</head>
<body>
    <canvas id="c"></canvas>
    <script>
        async function init() {
            const canvas = document.getElementById('c');

            // WebGPU availability check — show plain text error if unsupported
            if (!navigator.gpu) {
                document.body.innerHTML = '<p style="color:red;padding:2em;font-size:1.5em">WebGPU not supported. Use Chrome 113+ or Edge 113+.</p>';
                return;
            }

            // Request adapter + device — powerPreference high-performance for discrete GPU
            // WHY high-performance: this is a continuous 3D render loop, not occasional compute
            const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
            if (!adapter) {
                document.body.innerHTML = '<p style="color:red;padding:2em;font-size:1.5em">No WebGPU adapter found.</p>';
                return;
            }
            const device = await adapter.requestDevice();

            // Configure canvas context — format from system, no tone mapping
            // WHY preferred format: avoids sRGB/linear mismatch on different GPUs
            const context = canvas.getContext('webgpu');
            const format = navigator.gpu.getPreferredCanvasFormat();
            context.configure({ device, format, alphaMode: 'premultiplied' });

            // Resize canvas to match window pixel density
            // WHY devicePixelRatio: 1x canvas on retina looks blurry
            function resize() {
                const dpr = window.devicePixelRatio || 1;
                canvas.width = window.innerWidth * dpr;
                canvas.height = window.innerHeight * dpr;
            }
            resize();
            window.addEventListener('resize', resize);

            // Test render: clear to #0a0a0a
            // RGB 0x0a/255 ≈ 0.039 — near-black, very dim grey
            function frame() {
                const encoder = device.createCommandEncoder();
                const pass = encoder.beginRenderPass({
                    colorAttachments: [{
                        view: context.getCurrentTexture().createView(),
                        clearValue: { r: 0.039, g: 0.039, b: 0.039, a: 1.0 },
                        loadOp: 'clear',
                        storeOp: 'store',
                    }],
                });
                pass.end();
                device.queue.submit([encoder.finish()]);
                requestAnimationFrame(frame);
            }
            requestAnimationFrame(frame);
        }
        init();
    </script>
</body>
</html>
```

- [ ] **Step 2: Open in browser and verify**

Open `gfx/index.html` in Chrome/Edge. Expected:
- Canvas fills entire window
- Background is dark grey (`#0a0a0a`, not pure black)
- No console errors
- If WebGPU unsupported: red error text visible

- [ ] **Step 3: Commit**

```bash
git add gfx/index.html
git commit -m "feat(gfx): WebGPU canvas init with #0a0a0a clear"
```

---

### Task 2: WGSL Shaders + Render Pipeline

**Files:**
- Modify: `gfx/index.html` — add WGSL shaders (inline template literals) and GPURenderPipeline creation

**Goal:** Define vertex+fragment shaders, create the render pipeline with correct vertex layout. No geometry yet — just pipeline creation that succeeds without errors.

- [ ] **Step 1: Add WGSL shader code as template literals inside init()**

After `context.configure(...)` and before the `frame()` function, add:

```javascript
            // WGSL shaders — inline as template literals, zero imports
            // Vertex shader: reads per-node position+color, transforms via view-projection matrix
            // WHY uniform buffer for VP matrix: same for all vertices, updated once per frame by CPU
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

                // Fragment: pass-through color, no lighting yet
                // WHY no lighting: spec says "no lighting calculations yet"
                @fragment
                fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
                    return vec4<f32>(in.frag_color, 1.0);
                }
            `;
```

- [ ] **Step 2: Add bind group layout and pipeline creation**

After the shader code, add:

```javascript
            // Bind group layout: single uniform buffer at binding 0
            // WHY explicit layout: WebGPU requires layout declaration before pipeline creation
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

            // Render pipeline: links shaders + vertex layout + blend state
            // Vertex buffer layout: interleaved [x,y,z, r,g,b] = 24 bytes per node
            // WHY interleaved: single buffer bind, better cache locality for point sprites
            const pipeline = device.createRenderPipeline({
                layout: pipelineLayout,
                vertex: {
                    module: device.createShaderModule({ code: shaderCode }),
                    entryPoint: 'vs_main',
                    buffers: [{
                        arrayStride: 24, // 6 floats * 4 bytes = 24 bytes per vertex
                        attributes: [
                            { shaderLocation: 0, offset: 0, format: 'float32x3' },  // position
                            { shaderLocation: 1, offset: 12, format: 'float32x3' }, // color (after 3 floats = 12 bytes)
                        ],
                    }],
                },
                fragment: {
                    module: device.createShaderModule({ code: shaderCode }),
                    entryPoint: 'fs_main',
                    targets: [{ format }],
                },
                primitive: {
                    topology: 'point-list',
                    // WHY point-list: spec says "point sprites or small spheres" — points are simplest
                },
            });
```

- [ ] **Step 3: Verify pipeline creation succeeds**

Open in browser. Expected:
- No console errors (especially no WebGPU pipeline creation errors)
- Canvas still clears to dark grey
- If pipeline creation fails: WebGPU will throw — check console for shader compilation errors

- [ ] **Step 4: Commit**

```bash
git add gfx/index.html
git commit -m "feat(gfx): add WGSL shaders and render pipeline"
```

---

### Task 3: Uniform Buffer + View-Projection Matrix

**Files:**
- Modify: `gfx/index.html` — add GPUUniformBuffer, perspective projection, camera struct, bind group

**Goal:** Create the 64-byte uniform buffer, compute a perspective * view matrix in JS, upload it every frame. Camera starts at `(0, 0, -5)` looking at origin with 75° FOV.

- [ ] **Step 1: Add camera state and matrix math**

Add these before the `frame()` function. The camera struct and matrix math:

```javascript
            // Camera: first-person, position + pitch/yaw angles
            // WHY Euler angles: simpler than quaternion for WASD+mouse FPS controls
            const camera = {
                x: 0.0, y: 0.0, z: -5.0, // start position: behind origin looking forward
                pitch: 0.0, // vertical angle (radians), 0 = horizontal
                yaw: 0.0,   // horizontal angle (radians), 0 = looking along +Z
            };

            // 4x4 matrix as Float32Array (column-major, WebGPU convention)
            // WHY column-major: WGSL mat4x4 stores columns contiguously, matches Float32Array layout
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

            // Look-at matrix: camera at `eye`, looking at `target`, up = (0,1,0)
            function mat4LookAt(eye, target, up) {
                const zx = eye[0] - target[0], zy = eye[1] - target[1], zz = eye[2] - target[2];
                let len = Math.sqrt(zx * zx + zy * zy + zz * zz);
                const fz = [zx / len, zy / len, zz / len]; // forward (normalized)
                const sx = up[1] * fz[2] - up[2] * fz[1];
                const sy = up[2] * fz[0] - up[0] * fz[2];
                const sz = up[0] * fz[1] - up[1] * fz[0];
                len = Math.sqrt(sx * sx + sy * sy + sz * sz);
                const fx = [sx / len, sy / len, sz / len]; // right (normalized)
                const ux = [fz[1] * fx[2] - fz[2] * fx[1], fz[2] * fx[0] - fz[0] * fx[2], fz[0] * fx[1] - fz[1] * fx[0]]; // up
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

            // 4x4 matrix multiply: C = A * B (column-major)
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
                // Compute look-at target from yaw/pitch
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
```

- [ ] **Step 2: Create uniform buffer and bind group**

```javascript
            // GPUUniformBuffer: 64 bytes = one 4x4 f32 matrix
            // WHY uniform: written once per frame by CPU, read by every vertex — uniform semantics
            const uniformBuffer = device.createBuffer({
                size: 64,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            });

            // Bind group: binds uniform buffer to the pipeline layout
            const bindGroup = device.createBindGroup({
                layout: bindGroupLayout,
                entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
            });
```

- [ ] **Step 3: Update the render loop to write matrix and draw (empty draw call for now)**

Replace the existing `frame()` function:

```javascript
            function frame() {
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
                // No vertex buffer yet — draw call will come in Task 4
                pass.end();
                device.queue.submit([encoder.finish()]);
                requestAnimationFrame(frame);
            }
```

- [ ] **Step 4: Verify in browser**

Open in browser. Expected:
- Canvas still renders dark grey background
- No console errors
- Uniform buffer write succeeds silently

- [ ] **Step 5: Commit**

```bash
git add gfx/index.html
git commit -m "feat(gfx): uniform buffer, perspective matrix, camera state"
```

---

### Task 4: Vertex Buffer + 20 Node Geometry

**Files:**
- Modify: `gfx/index.html` — add node data, vertex buffer, draw call

**Goal:** Create interleaved vertex buffer with 20 nodes (5 red PANIC, 15 white). Render them as points.

- [ ] **Step 1: Add node data array**

After the uniform buffer creation, before the `frame()` function:

```javascript
            // 20 nodes: 5 red (PANIC) + 15 white
            // WHY hardcoded: spec says hardcoded positions, no dynamic generation yet
            // Spread across (-5,-5,-5) to (5,5,5)
            const NODES = [
                // 5 PANIC nodes — red (1.0, 0.0, 0.0)
                { pos: [-3.0,  2.0,  1.0], color: [1.0, 0.0, 0.0] },
                { pos: [ 4.0, -1.0, -3.0], color: [1.0, 0.0, 0.0] },
                { pos: [-1.0, -4.0,  4.0], color: [1.0, 0.0, 0.0] },
                { pos: [ 2.0,  3.0, -2.0], color: [1.0, 0.0, 0.0] },
                { pos: [-4.0,  0.0,  3.0], color: [1.0, 0.0, 0.0] },
                // 15 white nodes (0.9, 0.9, 0.9) — slightly off-white for visibility against grey bg
                { pos: [ 1.0,  1.0,  1.0], color: [0.9, 0.9, 0.9] },
                { pos: [-2.0,  3.0, -1.0], color: [0.9, 0.9, 0.9] },
                { pos: [ 3.0, -2.0,  2.0], color: [0.9, 0.9, 0.9] },
                { pos: [-3.0, -3.0, -3.0], color: [0.9, 0.9, 0.9] },
                { pos: [ 5.0,  0.0,  0.0], color: [0.9, 0.9, 0.9] },
                { pos: [ 0.0,  5.0,  0.0], color: [0.9, 0.9, 0.9] },
                { pos: [ 0.0,  0.0,  5.0], color: [0.9, 0.9, 0.9] },
                { pos: [-5.0, -1.0,  2.0], color: [0.9, 0.9, 0.9] },
                { pos: [ 1.0, -5.0, -2.0], color: [0.9, 0.9, 0.9] },
                { pos: [ 2.0,  2.0, -5.0], color: [0.9, 0.9, 0.9] },
                { pos: [-1.0,  4.0,  3.0], color: [0.9, 0.9, 0.9] },
                { pos: [ 3.0, -4.0,  1.0], color: [0.9, 0.9, 0.9] },
                { pos: [-4.0,  2.0, -4.0], color: [0.9, 0.9, 0.9] },
                { pos: [ 4.0,  1.0,  4.0], color: [0.9, 0.9, 0.9] },
                { pos: [-2.0, -2.0,  0.0], color: [0.9, 0.9, 0.9] },
            ];

            // Interleave into Float32Array: [x,y,z, r,g,b] per node = 6 floats = 24 bytes
            // WHY interleaved: single vertex buffer read, better GPU cache utilization
            const vertexData = new Float32Array(NODES.length * 6);
            for (let i = 0; i < NODES.length; i++) {
                const off = i * 6;
                vertexData[off + 0] = NODES[i].pos[0];
                vertexData[off + 1] = NODES[i].pos[1];
                vertexData[off + 2] = NODES[i].pos[2];
                vertexData[off + 3] = NODES[i].color[0];
                vertexData[off + 4] = NODES[i].color[1];
                vertexData[off + 5] = NODES[i].color[2];
            }

            // GPUVertexBuffer: all node geometry in one buffer
            // WHY vertex: per-node data, read once per vertex in shader
            const vertexBuffer = device.createBuffer({
                size: vertexData.byteLength,
                usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            });
            device.queue.writeBuffer(vertexBuffer, 0, vertexData);
```

- [ ] **Step 2: Update frame() to draw all 20 nodes**

Inside `frame()`, after `pass.setBindGroup(0, bindGroup)`, add:

```javascript
                pass.setVertexBuffer(0, vertexBuffer);
                pass.draw(NODES.length); // 20 vertices, one draw call
```

Remove the comment `// No vertex buffer yet`.

- [ ] **Step 3: Verify in browser**

Open in browser. Expected:
- 20 colored dots visible on dark background
- 5 dots are red, 15 are white/off-white
- Dots appear as tiny squares (point-list topology)
- Moving the view later (Task 5) will confirm 3D placement

- [ ] **Step 4: Commit**

```bash
git add gfx/index.html
git commit -m "feat(gfx): 20 nodes (5 red PANIC, 15 white) as point sprites"
```

---

### Task 5: WASD Movement + Pointer Lock Mouse Look

**Files:**
- Modify: `gfx/index.html` — add keyboard and mouse input handlers

**Goal:** First-person camera control. WASD moves in camera-local directions. Mouse (with pointer lock) controls pitch/yaw. Pressing P logs camera position.

- [ ] **Step 1: Add keyboard input tracking**

Add this before the `frame()` function (after camera state):

```javascript
            // Keyboard state — tracks which keys are currently held
            // WHY object: O(1) lookup per key, clean press/release toggling
            const keys = {};
            window.addEventListener('keydown', (e) => { keys[e.code] = true; });
            window.addEventListener('keyup', (e) => { keys[e.code] = false; });
```

- [ ] **Step 2: Add pointer lock for mouse look**

```javascript
            // Pointer Lock: mouse controls camera rotation
            // WHY pointer lock: mouse can leave the window in FPS mode; lock keeps it centered
            let mouseLocked = false;
            canvas.addEventListener('click', () => {
                if (!mouseLocked) canvas.requestPointerLock();
            });
            document.addEventListener('pointerlockchange', () => {
                mouseLocked = document.pointerLockElement === canvas;
            });
            document.addEventListener('mousemove', (e) => {
                if (!mouseLocked) return;
                const sensitivity = 0.002; // radians per pixel — tune to taste
                camera.yaw += e.movementX * sensitivity;
                camera.pitch += e.movementY * sensitivity;
                // Clamp pitch to ±89° to prevent gimbal flip
                // WHY clamp: at exactly ±90° the look-at target becomes ambiguous
                const maxPitch = 89 * Math.PI / 180;
                if (camera.pitch > maxPitch) camera.pitch = maxPitch;
                if (camera.pitch < -maxPitch) camera.pitch = -maxPitch;
            });
```

- [ ] **Step 3: Add WASD movement in the render loop**

At the beginning of `frame()`, before `getViewProjMatrix()`:

```javascript
                // WASD movement — camera-relative direction
                // speed in units per second, scaled by ~60fps timestep
                const moveSpeed = 0.1;
                // Forward direction from yaw (pitch doesn't affect movement direction)
                // WHY ignore pitch for movement: FPS convention, you walk horizontally even when looking up
                const fwdX = Math.sin(camera.yaw);
                const fwdZ = Math.cos(camera.yaw);
                // Right = forward rotated 90° around Y
                const rightX = Math.cos(camera.yaw);
                const rightZ = -Math.sin(camera.yaw);
                if (keys['KeyW']) { camera.x += fwdX * moveSpeed; camera.z += fwdZ * moveSpeed; }
                if (keys['KeyS']) { camera.x -= fwdX * moveSpeed; camera.z -= fwdZ * moveSpeed; }
                if (keys['KeyA']) { camera.x -= rightX * moveSpeed; camera.z -= rightZ * moveSpeed; }
                if (keys['KeyD']) { camera.x += rightX * moveSpeed; camera.z += rightZ * moveSpeed; }
                // Space/Shift for vertical movement
                if (keys['Space'])     camera.y += moveSpeed;
                if (keys['ShiftLeft']) camera.y -= moveSpeed;
```

- [ ] **Step 4: Add P key diagnostic**

Still inside `frame()`, at the very beginning:

```javascript
                // P key: log camera position (self-test diagnostic)
                if (keys['KeyP']) {
                    console.log(`Camera: (${camera.x.toFixed(2)}, ${camera.y.toFixed(2)}, ${camera.z.toFixed(2)}) yaw=${(camera.yaw * 180 / Math.PI).toFixed(1)}° pitch=${(camera.pitch * 180 / Math.PI).toFixed(1)}°`);
                    keys['KeyP'] = false; // debounce: prevent spam while held
                }
```

- [ ] **Step 5: Verify in browser**

Open in browser. Expected:
- Click canvas to activate pointer lock
- Mouse movement rotates camera view
- WASD moves camera position (dots shift relative to camera)
- Space/Shift move up/down
- Press P → console logs camera position
- Click away or press Escape to release pointer lock

- [ ] **Step 6: Commit**

```bash
git add gfx/index.html
git commit -m "feat(gfx): WASD movement, pointer-lock mouse look, P key diagnostic"
```

---

### Task 6: Startup Self-Test + Final Polish

**Files:**
- Modify: `gfx/index.html` — add init success log, ensure all spec requirements are met

**Goal:** Add the startup self-test console message. Verify all spec requirements are satisfied. Clean up.

- [ ] **Step 1: Add startup console message**

Inside `init()`, after all buffers and pipeline are created, before `requestAnimationFrame(frame)`:

```javascript
            // Self-test: confirm pipeline ready
            console.log(`Kernel Panic GFX v0.1: WebGPU OK, ${NODES.length} nodes, 5 panic`);
```

- [ ] **Step 2: Verify all spec requirements**

Open in browser and check each requirement:

| Requirement | How to Verify |
|---|---|
| Zero dependencies, no CDN, no npm | `gfx/index.html` is self-contained, no `<script src>` or `import` |
| Single index.html, all JS+WGSL inline | File structure check |
| WebGPU only (navigator.gpu) | No WebGL code anywhere in file |
| Plain text error if no WebGPU | Tested in unsupported browser or disable flag |
| 20 nodes as point sprites | Visual: 20 dots on screen |
| 5 red nodes, 15 white | Visual: 5 red, 15 off-white |
| Hardcoded positions -5 to 5 | Code review of NODES array |
| Background #0a0a0a | Visual: dark grey background |
| First-person WASD + mouse look | Interactive test |
| FOV 75°, near 0.1, far 100.0 | Code review: `mat4Perspective(75 * Math.PI / 180, aspect, 0.1, 100.0)` |
| Start position (0, 0, -5) | Code review: `camera = { x:0, y:0, z:-5 }` |
| Vertex shader: position+color, VP matrix | Code review of shader code |
| Fragment shader: output vertex color | Code review |
| GPUUniformBuffer 64 bytes, updated each frame | Code review: `size: 64`, `writeBuffer` in `frame()` |
| GPUVertexBuffer interleaved position+color | Code review: `arrayStride: 24`, attributes |
| requestAnimationFrame loop | Code review |
| Console.log on init | DevTools: "Kernel Panic GFX v0.1: WebGPU OK, 20 nodes, 5 panic" |
| P key logs camera position | DevTools: press P, see position |
| WHY comments, not WHAT | Code review |

- [ ] **Step 3: Commit**

```bash
git add gfx/index.html
git commit -m "feat(gfx): startup self-test, spec compliance verification"
```

---

## Summary

6 tasks, all modifying a single file `gfx/index.html`. Each task produces a working, testable increment:

| Task | What Works After |
|------|-----------------|
| 1 | Canvas on screen, dark grey clear, WebGPU error handling |
| 2 | Shaders compiled, pipeline created |
| 3 | Camera matrix computed and uploaded each frame |
| 4 | 20 colored dots visible |
| 5 | Interactive FPS camera, P key diagnostic |
| 6 | Self-test log, full spec compliance |

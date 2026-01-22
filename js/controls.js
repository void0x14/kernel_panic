import { CONFIG } from './utils/constants.js';

export class Controls {
    constructor(camera) {
        this.camera = camera;

        // Physics State
        this.velocity = { z: 0, r: 0 }; // z = forward/back, r = rotation
        this.position = { z: 0, r: 0 };

        // Input State
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            brake: false
        };

        this.mouse = {
            isDragging: false,
            previousX: 0,
            deltaX: 0
        };

        // Binding
        this.initListeners();
    }

    initListeners() {
        // Keyboard
        window.addEventListener('keydown', (e) => this.onKey(e, true));
        window.addEventListener('keyup', (e) => this.onKey(e, false));

        // Mouse / Touch
        window.addEventListener('mousedown', (e) => this.onMouseDown(e));
        window.addEventListener('mousemove', (e) => this.onMouseMove(e));
        window.addEventListener('mouseup', () => this.onMouseUp());
        window.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    }

    onKey(event, isPressed) {
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
                this.keys.forward = isPressed;
                break;
            case 'ArrowDown':
            case 'KeyS':
                this.keys.backward = isPressed;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                this.keys.left = isPressed;
                break;
            case 'ArrowRight':
            case 'KeyD':
                this.keys.right = isPressed;
                break;
            case 'Space':
                this.keys.brake = isPressed;
                break;
        }
    }

    onMouseDown(event) {
        this.mouse.isDragging = true;
        this.mouse.previousX = event.clientX;
    }

    onMouseMove(event) {
        if (!this.mouse.isDragging) return;
        const delta = event.clientX - this.mouse.previousX;
        this.mouse.deltaX = delta;
        this.mouse.previousX = event.clientX;

        // Direct rotation influence from mouse drag
        // Negative delta = drag left = rotate left (positive angle)
        // Sensitivity factor
        const sensitivity = 0.005;
        this.position.r += delta * sensitivity;
    }

    onMouseUp() {
        this.mouse.isDragging = false;
        this.mouse.deltaX = 0;
    }

    onWheel(event) {
        // Scroll to move? Or simple acceleration pulse?
        // Let's make scroll add to velocity momentarily
        // Removing default scroll behavior
        // event.preventDefault(); // Optional, might block page scroll if needed

        const sensitivity = 0.5;
        // DeltaY positive = scroll down = backward (positive Z in threejs usually, but we move negative)
        // We want scroll down = move forward? Or scroll up = move forward?
        // Standard: Scroll Down (pulling content up) -> Move Forward
        this.velocity.z -= (event.deltaY * sensitivity);
    }

    update(delta) {
        const { MOVEMENT } = CONFIG;

        // --- 1. Linear Movement (Z-Axis) ---
        // Target velocity based on input
        let targetAcc = 0;
        if (this.keys.forward) targetAcc -= MOVEMENT.ACCELERATION;
        if (this.keys.backward) targetAcc += MOVEMENT.ACCELERATION;

        // Apply acceleration
        this.velocity.z += targetAcc * delta;

        // Apply friction/damping (Deceleration)
        if (!this.keys.forward && !this.keys.backward) {
            if (Math.abs(this.velocity.z) > 0.1) {
                this.velocity.z -= Math.sign(this.velocity.z) * MOVEMENT.DECELERATION * delta;
            } else {
                this.velocity.z = 0;
            }
        }

        // Braking
        if (this.keys.brake) {
            this.velocity.z *= 0.9; // Hard damp
        }

        // Clamp speed
        this.velocity.z = Math.max(Math.min(this.velocity.z, MOVEMENT.SPEED_MAX), -MOVEMENT.SPEED_MAX);

        // Update Position
        this.position.z += this.velocity.z * delta;


        // --- 2. Rotation (Radial) ---
        // Keyboard Input
        let rotAcc = 0;
        if (this.keys.left) rotAcc += MOVEMENT.ROTATION_SPEED;  // Rotate CCW
        if (this.keys.right) rotAcc -= MOVEMENT.ROTATION_SPEED; // Rotate CW

        // Apply input to rotation
        this.position.r += rotAcc * delta;

        // Mouse drag is handled directly in events for 1:1 feel, but could have momentum here
        // For now, let's keep rotation absolute from mouse + velocity from keys

        // Apply state to Camera
        this.camera.position.z = this.position.z;
        this.camera.rotation.z = this.position.r;
    }
}

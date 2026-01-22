import * as THREE from 'three';
import { Tunnel } from './js/tunnel.js';
import { Controls } from './js/controls.js';
import { CONFIG } from './js/utils/constants.js';

class App {
    constructor() {
        this.container = document.querySelector('#app');
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.tunnel = null;
        this.controls = null;
        this.clock = new THREE.Clock();

        this.init();
    }

    init() {
        // 1. Setup Scene
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(CONFIG.COLORS.ATMOSPHERE, 0.015); // Fade to distance
        this.scene.background = new THREE.Color(CONFIG.COLORS.ATMOSPHERE);

        // 2. Setup Camera
        this.camera = new THREE.PerspectiveCamera(
            CONFIG.CAMERA.FOV,
            window.innerWidth / window.innerHeight,
            CONFIG.CAMERA.NEAR,
            CONFIG.CAMERA.FAR
        );
        this.camera.position.z = 0;
        this.camera.position.y = 0; // Centered

        // 3. Setup Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap pixel ratio for performance
        this.container.appendChild(this.renderer.domElement);

        // 4. Setup Lights
        this.setupLights();

        // 5. Initialize Tunnel
        this.tunnel = new Tunnel(this.scene);
        this.tunnel.init();

        // 6. Initialize Controls
        this.controls = new Controls(this.camera);

        // 7. Events
        window.addEventListener('resize', this.onWindowResize.bind(this));

        // 8. Start Loop
        this.animate();
    }

    setupLights() {
        // Ambient Light (Base fill)
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.3); // Cool white, dim
        this.scene.add(ambientLight);

        // Directional Light (Simulating 'engine' or 'forward' light)
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(0, 50, 20); // Top down, slightly back
        this.scene.add(dirLight);

        // Optional: Point light attached to camera (Headlight)
        const headlight = new THREE.PointLight(CONFIG.COLORS.GRID_LINES, 0.5, 100);
        this.camera.add(headlight);
        this.scene.add(this.camera); // Add camera to scene for children to work
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));

        const delta = this.clock.getDelta();

        // Update Controls (Movement & Rotation)
        if (this.controls) {
            this.controls.update(delta);
        }

        // Update Tunnel Generation (Pooling)
        if (this.tunnel) {
            this.tunnel.update(this.camera.position.z);
        }

        this.render();
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }
}

// Start Application
new App();

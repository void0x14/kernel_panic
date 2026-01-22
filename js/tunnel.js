import * as THREE from 'three';
import { CONFIG } from './utils/constants.js';

class Ring {
    constructor(index, zPosition) {
        this.index = index;
        // CylinderGeometry(radiusTop, radiusBottom, height, radialSegments, heightSegments, openEnded)
        const geometry = new THREE.CylinderGeometry(
            CONFIG.TUNNEL.RADIUS,
            CONFIG.TUNNEL.RADIUS,
            CONFIG.TUNNEL.SEGMENT_LENGTH,
            32, // Radial segments for roundness
            1,  // Height segments
            true // Open ended (tube)
        );

        // Rotate geometry so cylinder aligns with Z axis (by default it's Y)
        geometry.rotateX(-Math.PI / 2);

        // Material - Using Wireframe initally for "clean sci-fi" look testing, solid later
        // Using a group to hold multiple visual elements (main structure + details)
        this.mesh = new THREE.Group();

        // Main Hull
        const material = new THREE.MeshStandardMaterial({
            color: CONFIG.COLORS.WALL_BASE,
            side: THREE.BackSide, // Render inside only
            roughness: 0.7,
            metalness: 0.2
        });
        this.hull = new THREE.Mesh(geometry, material);
        this.mesh.add(this.hull);

        // Grid Line Visuals (Wireframe overlay to emphasize segments)
        const wireframeGeo = new THREE.EdgesGeometry(geometry);
        const wireframeMat = new THREE.LineBasicMaterial({ color: CONFIG.COLORS.GRID_LINES, opacity: 0.6, transparent: true });
        this.wireframe = new THREE.LineSegments(wireframeGeo, wireframeMat);
        this.mesh.add(this.wireframe);

        // Set initial position
        this.mesh.position.z = zPosition;
    }

    setPosition(z) {
        this.mesh.position.z = z;
    }
}

export class Tunnel {
    constructor(scene) {
        this.scene = scene;
        this.rings = [];
        this.chunkSize = CONFIG.TUNNEL.SEGMENT_LENGTH;
        this.visibleSegments = CONFIG.TUNNEL.SEGMENTS_COUNT;
    }

    init() {
        // Determine start position (slightly behind camera to avoid clipping pop-in)
        // We generate along negative Z
        for (let i = 0; i < this.visibleSegments; i++) {
            // Position: 0, -50, -100...
            const z = -i * this.chunkSize;
            const ring = new Ring(i, z);
            this.rings.push(ring);
            this.scene.add(ring.mesh);
        }
        console.log(`Tunnel initialized with ${this.rings.length} rings.`);
    }

    update(cameraZ) {
        // Pooling Logic: Re-position rings as camera moves
        // We assume movement is primarily towards negative Z

        // Find the ring that is furthest behind the camera
        // "Behind" in negative Z movement means Z > cameraZ
        // But we want to recycle rings that are excessively behind (positive offset)

        // Simple logic:
        // Sorted or unsorted? We can just check boundaries.
        // If a ring is at z = 0, and camera is at -100.
        // Distance = 100.
        // If distance > Threshold, move ring to the front (deep negative Z).

        // However, keeping strict order is better for seamless content.
        // Let's assume rings are strictly ordered in the array by Z index descending (0, -50, -100).

        // Actually, simple "infinite scrolling" logic:
        // First ring in array is at highest Z (closest to 0 or positive).
        // If (firstRing.z > cameraZ + buffer), move it to (lastRing.z - chunkSize).

        // Buffer: One segment length behind camera.
        const recycleThreshold = cameraZ + this.chunkSize;

        // We might need to handle multiple rings if moving fast (looping).
        // But usually one per frame is enough or we sort.

        // Sort rings by Z descending (Logic: 0, -50, -100...)
        this.rings.sort((a, b) => b.mesh.position.z - a.mesh.position.z);

        const rearmostRing = this.rings[0]; // Z is largest (e.g. 0)
        const foremostRing = this.rings[this.rings.length - 1]; // Z is smallest (e.g. -500)

        if (rearmostRing.mesh.position.z > recycleThreshold) {
            // Move to front
            const newZ = foremostRing.mesh.position.z - this.chunkSize;
            rearmostRing.setPosition(newZ);

            // We don't need to re-sort the array if we just assume efficiency, 
            // but strictly debugging, sorting next frame handles it.
        }
    }
}

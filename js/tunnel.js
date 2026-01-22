import * as THREE from 'three';
import { CONFIG } from './utils/constants.js';
import { Panel } from './components/Panel.js';
import { generateMockData } from './data/mockData.js';

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

        // Grid Line Visuals
        const wireframeGeo = new THREE.EdgesGeometry(geometry);
        const wireframeMat = new THREE.LineBasicMaterial({ color: CONFIG.COLORS.GRID_LINES, opacity: 0.6, transparent: true });
        this.wireframe = new THREE.LineSegments(wireframeGeo, wireframeMat);
        this.mesh.add(this.wireframe);

        // Panels Container
        this.panelsGroup = new THREE.Group();
        this.mesh.add(this.panelsGroup);

        // Set initial position
        this.mesh.position.z = zPosition;
    }

    setPosition(z) {
        this.mesh.position.z = z;
    }

    // Method to populate ring with data panels
    loadContent(segmentData) {
        // Clear existing panels
        while (this.panelsGroup.children.length > 0) {
            this.panelsGroup.remove(this.panelsGroup.children[0]);
        }

        if (!segmentData || !segmentData.items) return;

        const panelPositions = [];

        // Create new panels
        segmentData.items.forEach(item => {
            const panel = new Panel(item, CONFIG.TUNNEL.RADIUS);
            this.panelsGroup.add(panel.mesh);
            panelPositions.push(panel.mesh.position.clone());
        });

        // Create Synaptic Lines (Connecting panels in the same ring)
        if (panelPositions.length > 1) {
            const lineGeo = new THREE.BufferGeometry().setFromPoints(panelPositions);
            // Use LineLoop to close the shape
            const lineLoop = new THREE.LineLoop(
                lineGeo,
                new THREE.LineBasicMaterial({
                    color: CONFIG.COLORS.GRID_LINES,
                    opacity: 0.4,
                    transparent: true
                })
            );
            this.panelsGroup.add(lineLoop);
        }
    }
}

export class Tunnel {
    constructor(scene) {
        this.scene = scene;
        this.rings = [];
        this.chunkSize = CONFIG.TUNNEL.SEGMENT_LENGTH;
        this.visibleSegments = CONFIG.TUNNEL.SEGMENTS_COUNT;

        // Data Source
        // We generate a "infinite" stream usually, but for now let's just create a large set
        // or generate on the fly. Let's pre-generate a batch.
        this.mockData = generateMockData(100); // 100 segments worth of data
        this.dataOffset = 0; // Tracks which data index correlates to rings[0]
    }

    init() {
        // We generate along negative Z
        for (let i = 0; i < this.visibleSegments; i++) {
            // Position: 0, -50, -100...
            const z = -i * this.chunkSize;
            const ring = new Ring(i, z);

            // Load initial data
            if (this.mockData[i]) {
                ring.loadContent(this.mockData[i]);
            }

            this.rings.push(ring);
            this.scene.add(ring.mesh);
        }
        console.log(`Tunnel initialized with ${this.rings.length} rings.`);

        // Initial sorting to ensure rings array matches visual Z order
        // this.rings[0] = z=0 (Index 0 data), this.rings[11] = z=-550 (Index 11 data)
    }

    update(cameraZ) {
        // Pooling Logic: Re-position rings as camera moves
        // Buffer: One segment length behind camera.
        const recycleThreshold = cameraZ + this.chunkSize;

        // Sort rings by Z descending (0, -50, -100...)
        // This ensures rings[0] is always the rearmost one we might want to pop
        this.rings.sort((a, b) => b.mesh.position.z - a.mesh.position.z);

        const rearmostRing = this.rings[0];
        const foremostRing = this.rings[this.rings.length - 1];

        if (rearmostRing.mesh.position.z > recycleThreshold) {
            // Move to front
            const newZ = foremostRing.mesh.position.z - this.chunkSize;
            rearmostRing.setPosition(newZ);

            // Determine the data index for this new position
            // The initial set was 0..11.
            // If we just moved ring 0 to position -600 (index 12 spot effectively),
            // We need to fetch data index based on position.
            // Position z = -index * chunkSize
            // index = -z / chunkSize
            const newDataIndex = Math.abs(Math.round(newZ / this.chunkSize));

            // Safety check for data bounds (In real app, we'd gen more on fly)
            const content = this.mockData[newDataIndex % this.mockData.length]; // Loop data if runs out

            rearmostRing.loadContent(content);
        }
    }
}

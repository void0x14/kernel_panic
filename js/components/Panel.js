import * as THREE from 'three';
import { CONFIG } from '../utils/constants.js';

export class Panel {
    constructor(data, radius) {
        this.data = data;
        this.radius = radius - 2; // Slightly offset from wall to avoid z-fighting

        // Panel Dimensions
        const width = 12;
        const height = 8;

        // Geometry
        const geometry = new THREE.PlaneGeometry(width, height);

        // Material (Placeholder colors based on type for now)
        let color = 0xffffff;
        switch (data.type) {
            case 'video': color = 0xe11d48; break; // Red-ish
            case 'image': color = 0x2563eb; break; // Blue
            case 'text': color = 0x059669; break;  // Greenish (but decent one)
            case 'audio': color = 0xf59e0b; break; // Amber
        }

        // Use Basic for visibility mostly, Standard needed for light interaction
        const material = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.2, // Slight glow
            side: THREE.DoubleSide,
            roughness: 0.4,
            metalness: 0.6
        });

        this.mesh = new THREE.Mesh(geometry, material);

        // Position on Ring
        this.updatePosition(this.data.angle, 0); // zOffset is relative to ring center

        // Add User Data for Raycasting
        this.mesh.userData = {
            id: data.id,
            type: data.type,
            title: data.title
        };
    }

    updatePosition(angle, zOffset) {
        // Polar to Cartesian
        // x = r * cos(theta)
        // y = r * sin(theta)

        const x = this.radius * Math.cos(angle);
        const y = this.radius * Math.sin(angle);

        this.mesh.position.set(x, y, zOffset);

        // Rotation: The panel should face the center (0,0,z) - actually (0,0) in local space
        // We want the "front" of the plane (positive Z local) to face the center of the cylinder.
        // normal vector is (x, y, 0).

        // Math.atan2(y, x) gives the angle from positive X axis.
        // The panel needs to be rotated by this angle - PI/2?
        // Let's just use lookAt.

        // Since this mesh handles local coordinates relative to the Ring parent,
        // (0,0,0) is the center of the Ring.
        this.mesh.lookAt(0, 0, 0);

        // Note: PlaneGeometry by default faces +Z.
        // lookAt(0,0,0) makes the +Z face point TO 0,0,0. This is what we want (content facing inwards).
    }
}

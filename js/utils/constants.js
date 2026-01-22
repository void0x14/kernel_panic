/**
 * Visualization Constants
 */

export const CONFIG = {
    // Tunnel Geometry
    TUNNEL: {
        RADIUS: 50,
        SEGMENT_LENGTH: 50, // Length of each ring/segment along Z
        SEGMENTS_COUNT: 12, // Number of segments visible at once (pooling size)
    },

    // Navigation
    MOVEMENT: {
        SPEED_MAX: 80,         // Units per second
        ACCELERATION: 60.0,    // Units per second squared
        DECELERATION: 40.0,    // Friction/Damping
        ROTATION_SPEED: 2.0,   // Radians per second
        ROTATION_DAMPING: 5.0, // Drag on rotation
    },

    // Visuals
    COLORS: {
        ATMOSPHERE: 0x050a14, // Matches CSS
        GRID_LINES: 0x3b82f6,
        WALL_BASE: 0x111827,
    },

    // Camera
    CAMERA: {
        FOV: 75,
        NEAR: 0.1,
        FAR: 1000,
    }
};

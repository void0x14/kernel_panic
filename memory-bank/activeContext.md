# Active Context

## Current Work Focus
- Implementing **Phase 3: Data & Panels**.
- Generating random mock content (Images, Video, Text).
- Placing panels procedurally on ring inner walls using polar coordinates.
- Drawing synaptic lines between related panels.

## Recent Changes
- Set up Vite + Three.js project structure.
- Implemented `Tunnel` class with infinite object pooling.
- Configured "Museum Sci-Fi" lighting and color palette (No purple).
- Verified 60fps rendering in browser.

## Next Steps
1. Implement `Controls.js` for handling inputs.
2. Update `Camera` logic to follow "Rail" physics (Linear acceleration).
3. Add rotation controls for checking ring contents.

## Active Decisions
- Use `CylinderGeometry` for ring structures.
- Use Math.sin/cos for panel placement on walls.
- Multi-input controller (Keyboard: WASD/Arrows/Space, Mouse: Drag/Click).
- Using Vite for modern ES module support.

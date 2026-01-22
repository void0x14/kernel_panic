# System Patterns

## Architecture
- **Rendering Engine:** THREE.js (WebGL).
- **Structure:** Procedurally generated infinite tunnel.
- **Component Model:** Individual `Ring` objects containing `Panel` entities.

## Technical Decisions
- **Geometry:** `CylinderGeometry` for segments.
- **Data Placement:** Radial positioning using polar coordinates ($r, \theta$) converted to $(x, y)$ for inner wall layout.
- **Navigation:** Linear movement along the Z-axis (Z-offset defines time). Rotation around Z-axis allows "exploration within a ring".
- **State Management:** Simple object-based state for current position and focused panel content.
- **Content Overlay:** 360-degree immersive state when a panel "opens".

## Key Patterns
- **Object Pooling:** Reusing rings that fall behind the camera for the "infinite" feel.
- **Multi-modal Controller Pattern:** A centralized input handler that maps Keyboard, Mouse, and potentially Touch events to the same camera movement actions.

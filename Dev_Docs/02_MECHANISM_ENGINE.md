# 02_MECHANISM_ENGINE.md

# Urania Mechanism Engine

## Purpose

The Mechanism Engine is responsible for transforming scene graph data into a functioning paper mechanism.

The Scene Graph answers:

> What exists?

The Mechanism Engine answers:

> How does it behave?

The engine is the authoritative source for:

* Ring rotation
* Parent-child transform propagation
* Pattern expansion
* Visibility calculations
* Reveal simulation
* Runtime interaction
* State serialization

The engine must operate identically in:

* Editor
* Interactive Preview
* Exported Interactive Volvelles

No separate behavior implementations should exist.

---

# Design Goals

The engine must:

* Be deterministic
* Be platform-independent
* Avoid editor-specific assumptions
* Support future mechanism types
* Operate entirely client-side

The engine should not know:

* React
* Konva
* PixiJS
* HTML UI

The engine should only understand scene graph data and mechanism rules.

---

# Core Responsibilities

## Transform Resolution

The engine computes world-space transforms.

Example:

```text
Ring Rotation
+
Local Object Rotation
+
Pattern Rotation
=
Final Rotation
```

The renderer should never manually reconstruct transforms.

The renderer consumes resolved output from the engine.

---

## Ring Rotation

Rings are independently rotatable entities.

Example:

```text
Ring 1 = 45°
Ring 2 = 120°
Ring 3 = 10°
```

Each ring maintains its own state.

Rotation is expressed in degrees.

Clockwise rotation should be considered positive.

---

# Rotation State

Rotation is project state.

Not editor state.

Example:

```json
{
  "ringId": "ring_03",
  "rotation": 120
}
```

This allows:

* Save/Load
* Interactive exports
* Runtime scripting

to operate consistently.

---

# Transform Pipeline

Order of operations:

```text
Parent Transform
↓
Ring Rotation
↓
Sector Transform
↓
Object Transform
↓
Pattern Transform
↓
World Transform
```

This pipeline should remain stable.

---

# Pattern Expansion

Patterns are stored as instructions.

The engine generates instances at runtime.

Example:

```json
{
  "copies": 12,
  "spacingDegrees": 30,
  "rotateCopies": true
}
```

The engine produces:

```text
Instance 1
Instance 2
Instance 3
...
Instance 12
```

without modifying source data.

---

# Pattern Instance Rules

Instances are ephemeral.

Instances should:

* render
* participate in hit testing
* participate in export generation

Instances should not:

* be saved as independent nodes

The source pattern remains authoritative.

---

# Visibility System

Visibility is computed.

Visibility should never be stored.

The engine determines:

* what can be seen
* what is obscured
* what is revealed

for any mechanism state.

---

# Reveal Simulation

Reveal simulation is a core feature.

Users should be able to:

* Rotate rings
* Observe lower layers
* Verify windows
* Check alignment

without entering a separate preview mode.

---

# Reveal Calculation Model

For MVP:

```text
Top Ring
↓
Window Mask
↓
Lower Ring
↓
Artwork
```

Visibility is computed using mask intersections.

The engine determines visible regions.

The renderer displays them.

---

# Simplification Rule

The MVP is a visual simulation.

Not a physical simulation.

The engine does not simulate:

* Paper thickness
* Friction
* Fasteners
* Collision
* Mechanical stress

Future versions may add those systems.

---

# Ring Stack Model

Example:

```text
Ring 5 (Top)
Ring 4
Ring 3
Ring 2
Ring 1 (Bottom)
```

Visibility calculations evaluate from top to bottom.

---

# Active Editing Behavior

When editing a ring:

Users must be able to:

* Rotate that ring
* Rotate lower rings
* Observe reveals
* Inspect alignment

without changing modes.

This is a core requirement.

---

# Visibility Modes

The engine should support:

## Full View

Displays all artwork.

Useful during layout.

---

## Reveal View

Displays visibility exactly as windows permit.

Useful during mechanism design.

---

## Hybrid View

Displays hidden content with reduced opacity.

Useful for alignment and planning.

---

# Hit Testing

The engine provides hit testing.

The renderer should not implement separate hit-testing logic.

Hit testing must support:

* Shapes
* Text
* Images
* Pattern instances
* Windows

---

# Selection Resolution

When selecting a pattern instance:

Default behavior:

```text
Select Source Pattern
```

not

```text
Select Generated Instance
```

Generated instances are projections of source data.

---

# State Snapshot System

The engine should support snapshots.

Example:

```json
{
  "ring_01": 0,
  "ring_02": 45,
  "ring_03": 180
}
```

Useful for:

* Save states
* Undo
* Interactive exports

---

# Undo Integration

The engine should expose commands.

Examples:

```text
Rotate Ring
Move Object
Create Window
Delete Object
```

Undo should reverse commands.

Avoid snapshot-based undo for MVP.

Command-based undo scales better.

---

# Runtime API

Interactive exports should expose:

```javascript
volvelle.setRingRotation(id, degrees)

volvelle.getRingRotation(id)

volvelle.reset()

volvelle.loadState(state)

volvelle.exportState()
```

These methods should call directly into the mechanism engine.

---

# Export Integration

Exports should consume engine output.

Example:

```text
Scene Graph
↓
Mechanism Engine
↓
Resolved State
↓
Exporter
```

Exporters should not perform their own simulation logic.

---

# Engine Output

The engine should produce:

```typescript
interface ResolvedNode {
  id: string;
  type: string;

  worldTransform: Transform;

  visible: boolean;

  bounds: Bounds;

  renderData: unknown;
}
```

Renderers consume resolved nodes.

---

# Future Mechanism Support

The engine should be extensible.

Future modules may include:

```text
VolvelleModule
TunnelBookModule
CarouselBookModule
SlideChartModule
```

Each module provides:

* movement rules
* visibility rules
* validation rules

while sharing core engine infrastructure.

---

# Validation Layer

The engine should provide validation.

Examples:

## Ring Overlap

Detect invalid radius relationships.

---

## Empty Window

Detect windows revealing nothing.

---

## Out-of-Bounds Content

Detect artwork extending beyond printable regions.

---

## Export Warnings

Detect unsupported export conditions.

---

# Future Extension Points

Reserved for later:

```text
Rotation Limits
Snap Positions
Pointers
Mechanical Linkages
Gear Ratios
Sliders
Folds
Tabs
Connectors
```

The MVP should not implement these systems.

The architecture should not prevent them.

---

# Architectural Rule

The engine owns behavior.

Renderers own presentation.

Editors own interaction.

Exporters own output formatting.

Do not allow behavior logic to migrate into renderers, editors, or exporters.

If a feature affects how the mechanism functions, it belongs in the Mechanism Engine.

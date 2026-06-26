# 04_RENDERING_ARCHITECTURE.md

# Urania Rendering Architecture

## Purpose

The Rendering Layer is responsible for visualizing mechanism state.

The renderer consumes:

* Scene Graph data
* Mechanism Engine output
* Editor State

and produces visual output.

The renderer does not:

* own project data
* own mechanism behavior
* own editor interaction

Those concerns belong elsewhere.

---

# Architectural Position

The rendering layer exists to accurately represent paper mechanisms.

Urania is not an illustration application.

Rendering should prioritize:

* geometric correctness
* visibility correctness
* mechanism fidelity

over artistic effects.

---

# Rendering Pipeline

```text
Scene Graph
        ↓
Mechanism Engine
        ↓
Resolved Scene
        ↓
Renderer
        ↓
Canvas Output
```

The renderer should never perform mechanism calculations.

The renderer consumes already-resolved data.

---

# Technology Stack

## Rendering Surface

Canvas

Chosen over SVG.

Reasons:

* Better performance
* Better masking support
* Better interaction support
* Better scalability
* Better future mechanism support

SVG remains an export format.

SVG is not the editing surface.

---

## Rendering Framework

Konva

Chosen because:

* Faster MVP development
* Strong editor-oriented tooling
* Built-in transforms
* Built-in selection support
* Mature ecosystem

Performance optimization can occur later if necessary.

---

# Renderer Responsibilities

The renderer is responsible for:

* drawing objects
* displaying guides
* displaying selections
* displaying handles
* displaying windows
* displaying reveal states
* displaying drafting overlays

The renderer is not responsible for:

* project validation
* export generation
* behavior calculations

---

# Render Layers

The canvas should be internally organized into render layers.

Example:

```text
Background

Guides

Mechanism

Selections

Handles

Overlays

UI Controls
```

This organization is internal.

Users do not interact with render layers directly.

---

# Canvas Coordinate System

The mechanism center is the origin.

Example:

```text
0,0
```

represents the center pivot.

This simplifies:

* ring rotation
* sector calculations
* radial placement
* future mechanism support

---

# Zoom System

The renderer should support large zoom ranges.

Target behavior:

* Comfortable overview
* Extreme detail inspection

Specific limits should remain configurable.

The implementation should support significantly larger ranges than are exposed through the UI.

Presentation constraints may be added later.

---

# Pan System

Users may freely pan the canvas.

Pan state belongs to editor state.

Not project data.

---

# Rulers

Optional.

If implemented:

* horizontal ruler
* vertical ruler

Rulers are editor aids.

Not project elements.

---

# Rendering Modes

The renderer must support multiple viewing modes.

These modes do not alter project data.

---

## Full View

Displays all visible content normally.

Used for general editing.

---

## Solo View

Displays only the active ring.

Used for isolated artwork creation.

---

## Focus View

Example:

```text
Active Ring = 100%

Lower Rings = 80%

Upper Rings = 30%
```

Supports detailed drafting workflows.

Opacity values remain configurable.

---

## Reveal View

Displays actual mechanism visibility.

Only content visible through windows appears.

Used to evaluate mechanism behavior.

---

## X-Ray View

Displays all visible content with drafting opacity controls.

Supports alignment and planning.

---

# Ring Rendering

Rings render according to mechanism stack order.

Example:

```text
Top Ring

Ring 4

Ring 3

Ring 2

Bottom Ring
```

Higher rings obscure lower rings.

Windows reveal lower layers.

This behavior must match physical assembly.

---

# Window Rendering

Windows are functional masking elements.

They are not decorative shapes.

Renderer responsibilities:

* display windows
* display window outlines
* apply visibility masks

The renderer should support window visualization without altering underlying geometry.

---

# Reveal Simulation

Reveal simulation is a core rendering feature.

Users must be able to:

* rotate rings
* inspect reveals
* verify alignments

without changing modes.

Reveal calculations originate from the Mechanism Engine.

The renderer visualizes the result.

---

# Masking Requirements

Masking should be pixel-accurate.

Reason:

The visual result should closely match exported fabrication files.

Approximate masking is insufficient.

Accuracy takes priority over visual shortcuts.

---

# Text Rendering

Text remains editable text.

Renderer responsibilities:

* draw text
* draw arc text
* display text selections

Text should not be converted into vector geometry during editing.

Conversion occurs only during export when requested.

---

# Arc Text Rendering

Arc text should be generated dynamically.

Stored parameters:

* content
* radius
* start angle
* sweep angle

Renderer computes glyph placement.

This preserves editability.

---

# Image Rendering

Supported:

* PNG
* JPG
* SVG placement

Images render from embedded asset data.

No external file dependency should be required.

---

# Pattern Rendering

Patterns are rendered from pattern instructions.

The renderer generates temporary visual instances.

Generated instances:

* are visible
* participate in hit testing

Generated instances are not scene graph nodes.

---

# Pattern Selection

Selecting a generated instance selects the source pattern.

Selection handles should appear only on source objects.

Generated instances should not display independent handles.

---

# Selection Rendering

Selection visuals belong to the renderer.

Examples:

* bounding boxes
* resize handles
* rotation handles

Selection state originates from editor state.

---

# Guide Rendering

Guides render above artwork.

Reason:

Guides are drafting aids.

They should remain visible regardless of artwork complexity.

---

# Supported Guide Types

## Radial Guides

Examples:

```text
0°
30°
45°
90°
```

---

## Circular Guides

Concentric circles.

---

# Drafting Overlays

Drafting overlays are editor-only visuals.

Examples:

* opacity controls
* ring highlighting
* focus mode effects
* guide displays

These overlays must never affect exports.

---

# Rotation Controls

Rotation controls are renderer-visible UI elements.

Supported methods:

## Rotation Tabs

Default method.

Persistent controls positioned outside ring boundaries.

---

## Direct Ring Rotation

Optional mode.

May be enabled or disabled.

---

## Numeric Controls

Always available through editor UI.

Not rendered directly on the canvas.

---

# Hit Testing

Hit testing should operate on rendered geometry.

Supports:

* shapes
* text
* images
* windows
* pattern instances

Hit testing should ignore hidden objects.

---

# Export Preview

Artwork, cut, and fold content share the same workspace.

Renderer should support independent visibility toggles.

Example:

```text
Show Artwork

Show Cut

Show Fold
```

Users should not switch workspaces to inspect export layers.

---

# Future Rendering Support

Future renderers may include:

```text
2D Renderer

3D Preview Renderer
```

The scene graph and mechanism engine should remain renderer-independent.

Future mechanism types may require depth visualization.

The architecture should support this without modifying project data structures.

---

# Rendering Parity Guidelines

To maintain visual and vector correctness between the canvas editor (HTML5 Canvas/Konva.js) and the runtime/export output (SVG), the following rules must be followed:

## Single Source of Truth
* All mathematical transformations, coordinate translations (Cartesian to Polar), bounds calculations, and masking geometries must occur inside the Mechanism Engine.
* Renderers must act as pure presentation components that consume resolved output. No rendering layer may implement proprietary layout or geometry math.

## Unified Masking & Path Generation
* Complex geometries, windows, and cutouts must be computed as standard SVG Path strings (`d` attribute format) within the core engine.
* The editor canvas must use `Konva.Path` initialized with these exact strings, guaranteeing absolute shape parity with exported vector SVG elements.

## Regression Verification
* Automated visual testing must validate editor canvas screenshots against rendered SVG export containers for a set of test scenarios, raising warnings on any parity deviation.

---

# Architectural Rule

The renderer visualizes state.

It does not create state.

If a feature changes how a mechanism behaves, it belongs in the Mechanism Engine.

If a feature changes how the mechanism is displayed, it belongs in the Rendering Layer.

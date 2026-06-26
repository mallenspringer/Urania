# 01_SCENE_GRAPH_SCHEMA.md

# Urania Scene Graph Schema

## Purpose

The Urania Scene Graph is the authoritative representation of all projects.

The scene graph is the single source of truth for:

* Editing
* Rendering
* Simulation
* SVG Export
* PNG Export
* Interactive Export

No export format should ever become the primary project representation.

---

# Design Goals

The schema must support:

* Volvelles
* Tunnel Books
* Carousel Books
* Slide Charts

without requiring major redesign.

The schema should model:

* Structure
* Geometry
* Motion
* Visibility
* Export Intent

rather than specific UI behaviors.

---

# Core Principles

## Stable IDs

Every node receives a stable UUID.

```json
{
  "id": "ring_01"
}
```

IDs must never be position-dependent.

---

## Tree-Based Structure

Projects are represented as a hierarchy.

```text
Project
├── Mechanism
├── Assets
├── Layers
└── Nodes
```

---

## Transform-Based Positioning

Objects store local transforms.

Parent transforms propagate automatically.

```json
{
  "transform": {
    "x": 0,
    "y": 0,
    "rotation": 0,
    "scaleX": 1,
    "scaleY": 1
  }
}
```

---

## Logical vs Visual Separation

Nodes represent logical entities.

Rendering engines determine visual representation.

Example:

```json
{
  "type": "sector"
}
```

does not define how sectors are drawn.

It defines their existence and behavior.

---

# Root Structure

```json
{
  "format": "urania",
  "version": "1.0.0",
  "mechanismType": "volvelle",
  "metadata": {},
  "settings": {},
  "assets": [],
  "mechanism": {}
}
```

---

# Metadata

```json
{
  "name": "My Volvelle",
  "author": "",
  "description": "",
  "createdAt": "",
  "updatedAt": ""
}
```

---

# Project Settings

```json
{
  "units": "inches",
  "canvasSize": {
    "width": 12,
    "height": 12
  }
}
```

---

# Asset Library

Assets are stored centrally.

Objects reference assets by ID.

```json
{
  "id": "asset_01",
  "type": "image",
  "mimeType": "image/png",
  "embeddedData": "..."
}
```

Supported MVP asset types:

* png
* jpg
* svg

---

# Mechanism Node

Every project contains one mechanism root.

```json
{
  "id": "mechanism_01",
  "type": "volvelle",
  "children": []
}
```

Future values:

```text
volvelle
tunnel_book
carousel_book
slide_chart
```

---

# Base Node Definition

All scene graph nodes inherit:

```json
{
  "id": "",
  "type": "",
  "name": "",
  "visible": true,
  "locked": false,
  "transform": {},
  "children": []
}
```

---

# Transform Definition

```json
{
  "x": 0,
  "y": 0,
  "rotation": 0,
  "scaleX": 1,
  "scaleY": 1
}
```

Rotation stored in degrees.

---

# Volvelle Hierarchy

```text
Mechanism
├── Ring
│   ├── Sector
│   ├── Artwork Objects
│   ├── Window Objects
│   └── Labels
```

Objects may exist:

* directly under Ring
* under individual Sectors

---

# Ring Node

```json
{
  "id": "ring_01",
  "type": "ring",
  "innerRadius": 120,
  "outerRadius": 240,
  "rotation": 0,
  "children": []
}
```

---

# Ring State

Ring rotation is project state.

Not editor state.

```json
{
  "rotation": 45
}
```

This allows exports to open in a chosen configuration.

---

# Sector Node

```json
{
  "id": "sector_01",
  "type": "sector",
  "startAngle": 0,
  "endAngle": 30
}
```

---

# Artwork Nodes

All drawable content derives from Artwork Node.

```json
{
  "id": "",
  "type": "",
  "style": {},
  "transform": {}
}
```

---

# Shape Nodes

## Circle

```json
{
  "type": "circle",
  "radius": 50
}
```

---

## Rectangle

```json
{
  "type": "rectangle",
  "width": 100,
  "height": 50
}
```

---

## Line

```json
{
  "type": "line",
  "length": 100,
  "thickness": 1
}
```

---

## Polygon

```json
{
  "type": "polygon",
  "sides": 6,
  "radius": 100,
  "cornerRadius": 8
}
```

---

# Text Nodes

## Standard Text

```json
{
  "type": "text",
  "content": "January",
  "fontFamily": "",
  "fontSize": 24
}
```

---

## Arc Text

```json
{
  "type": "arcText",
  "content": "January",
  "radius": 180,
  "startAngle": 0,
  "sweepAngle": 30
}
```

---

## Sector Label

```json
{
  "type": "sectorLabel",
  "content": "January"
}
```

Renderer determines placement.

---

# Image Node

```json
{
  "type": "image",
  "assetId": "asset_01"
}
```

---

# SVG Placement Node

```json
{
  "type": "svgAsset",
  "assetId": "asset_02"
}
```

MVP behavior:

Placed but not editable.

---

# Window Nodes

Windows define visibility masks.

They are not merely decorative geometry.

```json
{
  "type": "window",
  "shape": {}
}
```

---

# Window Example

```json
{
  "type": "window",
  "shape": {
    "type": "circle",
    "radius": 20
  }
}
```

---

# Pattern Nodes

Patterns are stored as instructions.

Not duplicated geometry.

Example:

```json
{
  "type": "radialPattern",
  "copies": 12,
  "spacingDegrees": 30,
  "rotateCopies": true
}
```

---

# Visibility Model

Visibility should be computed.

Not stored.

Example:

```text
Upper Ring
Window
Lower Ring
Artwork
```

Renderer determines resulting visibility.

---

# Export Layers

Every drawable node contains export flags.

```json
{
  "export": {
    "artwork": true,
    "cut": false,
    "fold": false
  }
}
```

Examples:

Artwork:

```json
{
  "artwork": true
}
```

Cut Path:

```json
{
  "cut": true
}
```

Fold Guide:

```json
{
  "fold": true
}
```

---

# Interaction State

Not stored in scene graph.

Examples:

* selected object
* hovered object
* editor zoom
* viewport position

belong in editor state.

Never in project data.

---

# Runtime API State

Interactive exports should expose:

```javascript
volvelle.setRingRotation(id, degrees)

volvelle.getRingRotation(id)

volvelle.reset()

volvelle.loadState(state)
```

These operate against scene graph nodes.

---

# Future Extension Points

Reserved node types:

```text
pointer
slider
fold
tab
hinge
gear
spacer
connector
```

Do not implement in MVP.

Reserve schema space.

---

# Tradeoff Analysis

## Sector Ownership

### Option A

Objects belong only to sectors.

Pros:

* Cleaner sector logic

Cons:

* Difficult for objects spanning multiple sectors

### Option B (Recommended)

Objects may belong to:

* ring
* sector

Pros:

* More flexible
* Supports labels and artwork crossing boundaries

Cons:

* Slightly more complex hierarchy

Recommendation:

Option B

---

## Pattern Storage

### Option A

Store duplicated geometry.

Pros:

* Simpler rendering

Cons:

* Large files
* Difficult editing

### Option B (Recommended)

Store pattern instructions.

Generate instances at render time.

Pros:

* Smaller files
* Easier editing
* Better future automation

Cons:

* More rendering complexity

Recommendation:

Option B

---

## Arc Text Representation

### Option A

Store generated glyph positions.

Pros:

* Faster rendering

Cons:

* Hard to edit

### Option B (Recommended)

Store arc parameters.

Generate layout dynamically.

Pros:

* Editable
* Reusable
* Cleaner exports

Recommendation:

Option B

---

## Windows

### Option A

Treat windows as normal shapes.

Pros:

* Simpler schema

Cons:

* Visibility semantics become ambiguous

### Option B (Recommended)

Treat windows as dedicated node types.

Pros:

* Clear reveal behavior
* Cleaner simulation model
* Better future mechanism support

Recommendation:

Option B

---

# Schema Rule

If a future feature can be represented as:

* structure
* geometry
* motion
* visibility

it belongs in the scene graph.

If it only affects editing convenience, it belongs in editor state.

Preserve this distinction aggressively.

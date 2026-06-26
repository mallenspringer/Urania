# 16_RUNTIME_SIMULATION_LAYER.md

# Urania Runtime Simulation Layer

## Purpose

This document defines how Urania projects behave when interpreted as interactive mechanisms rather than static exports.

The Runtime Simulation Layer bridges:

```text
Editor Model
    ↓
Runtime Model
    ↓
Runtime Engine
    ↓
Interactive Experience
```

It serves as the conceptual contract between:

* editor architecture
* runtime architecture
* export systems

---

# Core Philosophy

Runtime is not an animation preview.

Runtime is not an editor mode.

Runtime is an interactive execution target generated from project data.

---

# Architectural Principle

Urania uses:

```text
Single Authoring Model
        ↓
Runtime Generation
        ↓
Shared Runtime Engine
```

The editor and runtime share structural meaning.

They do not share implementation concerns.

---

# Design Goal

Everything meaningful in the editor must have a runtime interpretation.

No semantic information should be lost during export.

---

# Editor Model vs Runtime Model

## Editor Model

Contains:

* selection state
* undo state
* validation state
* drafting opacity
* guides
* editor metadata

Used exclusively by editor systems.

---

## Runtime Model

Contains:

* runtime geometry
* runtime interactions
* runtime configuration
* runtime state definitions
* animation definitions

Used exclusively by runtime systems.

---

# Runtime Generation

Runtime data is generated.

It is not a direct serialization of editor state.

```text
Editor Project
        ↓
Runtime Generator
        ↓
Runtime Model
```

This separation is mandatory.

---

# Mechanism Architecture

All runtime behavior executes through mechanism adapters.

```text
Runtime Engine
        ↓
Mechanism Adapter
        ↓
Volvelle Adapter
```

Future adapters:

```text
Carousel Adapter

Tunnel Adapter

Slide Chart Adapter
```

---

# Mechanism Type

Every runtime model declares:

```json
{
  "mechanismType": "volvelle"
}
```

The runtime engine dispatches to the appropriate adapter.

---

# Runtime Object Hierarchy

```text
Project

    Rings

        Layers

            Elements
```

This hierarchy remains consistent with editor architecture.

---

# Runtime Primitives

## Rings

Primary rotational containers.

Responsibilities:

* rotational state
* radial geometry
* sector ownership
* interaction handling

---

## Layers

Visual grouping structures.

Responsibilities:

* visibility
* ordering
* rendering organization

---

## Elements

Renderable entities.

Examples:

* text
* shapes
* images
* windows
* paths
* patterns

---

# Coordinate Systems

Runtime supports dual coordinate systems.

---

## Cartesian Coordinates

Used for rendering.

---

## Polar Coordinates

Used for:

* rotation logic
* sector logic
* radial behaviors

Polar coordinates are authoritative for rotational interactions.

---

# Rotation Model

## Ring Rotation

Rings maintain independent rotational state.

Rotation affects:

* contained elements
* sector alignment
* visual composition

Rotation is continuous by default.

---

## Element Rotation

Elements may define:

```text
Local Rotation
```

and inherit:

```text
Ring Rotation
```

Final rotation:

```text
Final Rotation
    =
Ring Rotation
    +
Element Rotation
```

---

# Sector Model

Sectors are runtime entities.

They are not merely editor guides.

Runtime sectors may provide:

* snapping references
* interaction references
* structural metadata

---

# Sector Configuration

Supports:

* sector count
* angular boundaries
* future constraints

---

# Visibility Model

Runtime uses a two-layer visibility system.

---

## Structural Visibility

Determines inclusion in runtime output.

Hidden structures may be excluded from export.

---

## Presentation Visibility

Determines runtime appearance.

Examples:

* opacity
* temporary hiding
* future animation states

---

# Interaction Model

Runtime supports:

* mouse interaction
* touch interaction
* keyboard interaction

---

# Ring Interaction

Rings may:

* rotate
* receive focus
* expose state
* participate in future mechanical systems

---

# Element Interaction

Elements may support:

* hover
* click
* drag
* focus

depending on runtime configuration.

---

# Transform Model

Runtime consumes exported transform data.

Runtime does not infer new geometry.

Runtime applies:

* stored transforms
* user interaction deltas
* animation deltas

only.

---

# Runtime State

Runtime state is distinct from authored state.

---

## Authored State

Represents designer intent.

Example:

```json
{
  "rotation": 0
}
```

---

## Current State

Represents runtime interaction results.

Example:

```json
{
  "rotation": 127
}
```

---

# State Modes

Supports:

## Always Reset

Return to authored state on load.

---

## Persist State

Restore previous state.

---

## Persist + Reset

Restore state and provide reset capability.

Default mode.

---

# State Storage

Uses:

```text
localStorage
```

No server dependency required.

---

# Runtime Sharing Infrastructure

Runtime state must be serializable.

Purpose:

* bookmarks
* puzzle states
* teaching references
* shared alignments

Visible sharing UI is not required in MVP.

Serialization infrastructure is required.

---

# Event Model

Runtime supports a minimal event system.

Required events:

```text
Pointer Enter

Pointer Leave

Click

Drag

Rotation Changed
```

---

# Composition Rules

Rendering hierarchy:

```text
Ring
    ↓
Layer
    ↓
Element
```

Inheritance flows downward.

---

# Z-Order Model

Runtime z-order derives from:

* ring order
* layer order
* element order

Arbitrary runtime z-index manipulation is not supported.

---

# Pattern Model

Patterns may be exported as:

```text
Pre-Baked Geometry
```

for MVP.

Runtime pattern generation is not required.

---

# Runtime API

Runtime exports expose a minimal public API.

Required functions:

```javascript
setRingRotation()

getRingRotation()

reset()
```

---

# Animation Infrastructure

Runtime models reserve animation support.

Example:

```json
{
  "animations": []
}
```

Animation support is not active in MVP.

The data structure is mandatory.

---

# Future Animation Support

Reserved for:

* automatic rotation
* timed motion
* linked motion
* gear systems
* playback systems

---

# Runtime Accessibility

Minimum support:

```text
Tab

Enter

Arrow Keys
```

Runtime must remain usable without pointer devices.

---

# Runtime Mobile Support

Required.

Supported devices:

* desktop
* tablet
* mobile

---

# Performance Model

Runtime assumes:

* high element counts
* multiple rings
* nested structures
* continuous rotation

Optimization strategies include:

* precomputed geometry
* flattened render structures
* minimal recalculation

---

# Security Requirements

Runtime exports must:

* operate offline
* require no external services
* require no CDN assets
* execute no arbitrary project code

Only structured runtime behaviors are permitted.

---

# Runtime Independence

Exported runtimes must function without:

* Urania editor
* Urania services
* internet connectivity

---

# Export Relationship

Runtime is the contract consumed by:

* HTML exports
* runtime packages
* future embeddable exports

Exports are generated from runtime models, not editor models.

---

# Agent Directives

## Directive 1

Runtime and editor share meaning, not implementation.

---

## Directive 2

Runtime models and editor models must remain separate.

---

## Directive 3

All runtime behavior must execute through mechanism adapters.

---

## Directive 4

Volvelle is the first adapter, not a special case.

---

## Directive 5

Runtime state and authored state must remain separate concepts.

---

## Directive 6

Animation infrastructure must exist even when inactive.

---

## Directive 7

Runtime exports must remain self-contained.

---

## Directive 8

Runtime APIs must remain intentionally small.

---

## Directive 9

Runtime geometry must be deterministic.

No hidden reinterpretation is allowed.

---

## Directive 10

Future mechanism families must integrate without runtime redesign.

---

# Architectural Outcome

The Runtime Simulation Layer establishes a stable contract between Urania's editor, runtime generator, and exported experiences. It ensures that authored mechanisms preserve their structural meaning while allowing runtime-specific interaction, persistence, accessibility, and future extensibility through a shared mechanism-adapter architecture.

# 15_SNAPPING_AND_GUIDES.md

# Urania Snapping and Guides System

## Purpose

This document defines how spatial assistance behaves during transforms in Urania.

It specifies:

* snapping behavior
* guide systems
* alignment rules
* radial and angular assistance
* interaction feedback
* constraint hierarchy
* validation integration

Snapping is an assist layer only.

It does not constrain user intent.

---

# Core Philosophy

Snapping is:

```text
Suggestive, not authoritative
```

It assists alignment but never overrides explicit transform intent.

Users remain in full control at all times.

---

# Fundamental Principle

Snapping is a geometric assistance system.

It is not:

* a constraint solver
* a layout engine
* an auto-correction engine

Users must always be able to intentionally place geometry off-grid or off-guide.

---

# Snapping Model

## Fundamental Rule

Snapping operates as:

* real-time suggestion during interaction
* optional soft correction on release

Snapping never locks movement during interaction.

---

# Snap Scope

Snapping operates as a hybrid system:

* globally available engine
* tool-aware filtering
* context-sensitive activation

---

# Snap Activation

Snapping infrastructure is always available.

Individual snap categories may be:

* enabled
* disabled
* temporarily ignored

based on user preferences and active tool context.

---

# Snap Categories

## Cartesian Snapping

Supports:

* grid alignment
* horizontal alignment
* vertical alignment
* bounding box alignment

---

## Radial Snapping

Supports:

* angular increments
* sector boundaries
* radial positioning
* concentric alignment

---

## Structural Snapping

Supports:

* ring boundaries
* sector boundaries
* center alignment
* ring centerlines

---

## Object Snapping

Supports:

* object centers
* object edges
* object midpoints
* object anchors

---

## Semantic Snapping

Supports:

* custom guides
* user-defined references
* intersection points
* constructed geometry references

---

# Guide System

Guides are persistent spatial references used during drafting.

Guides exist only within the editor.

Guides are never exported.

---

# Guide Types

## Linear Guides

Arbitrary directional guides.

May be horizontal, vertical, or angled.

---

## Angular Guides

Lines extending radially from project center.

Examples:

```text
0°

30°

45°

90°
```

---

## Circular Guides

Concentric circular references.

Useful for:

* text placement
* window placement
* artwork alignment

---

## Sector Guides

Derived from sector boundaries.

May be displayed independently of sector rendering.

---

## Custom Guides

User-created guides.

May be:

* linear
* angular
* circular

Custom guides persist within project data.

---

# Guide Creation

Guides may be created through:

## Precision Workflow

Sidebar or inspector controls.

Used for exact values.

---

## Direct Workflow

Canvas-based creation tools.

Used for rapid drafting.

---

# Guide Persistence

Guides are project data.

Guides:

* save with project
* load with project
* participate in validation
* participate in snapping

Guides are not runtime data.

Guides are not exported.

---

# Snap Priority Hierarchy

When multiple snap targets are available:

1. Active Context Anchors
2. User Guides
3. Structural Geometry
4. Object Geometry
5. Optional Grid

Higher-priority targets win.

---

# Snap Behavior

## During Interaction

Snapping remains visual.

Supported feedback:

* ghost previews
* guide highlights
* snap indicators
* candidate alignment markers

Objects are not forcibly repositioned.

---

## On Release

If enabled:

```text
Within Threshold
    ↓
Soft Settle

Outside Threshold
    ↓
No Adjustment
```

Soft settle is optional.

---

# Snap Strength Model

Supports:

## Visual Suggestion

Display only.

No position changes.

---

## Soft Settle

Minor adjustment on release.

---

# Hard Locking

Not supported.

Users must always retain direct control.

---

# Radial Snapping

## Angular Snapping

Supports:

* configurable degree increments
* sector-derived increments
* angular guide alignment

Examples:

```text
5°

10°

15°

30°
```

---

## Radial Snapping

Supports:

* ring boundaries
* ring centerlines
* custom circular guides

---

## Arc Alignment

Supports:

* arc edges
* curved windows
* circular geometry

---

# Sector Awareness

Objects may be aware of:

* sector index
* angular position
* sector boundaries

This information is advisory only.

---

# Sector Snapping

Sector snapping is an independent snap category.

Users may disable it without disabling other snapping systems.

---

# Object-to-Object Snapping

Supports:

* center alignment
* edge alignment
* midpoint alignment
* radial alignment
* concentric alignment

---

# Guide Visibility

Guides support:

## Always Visible

Persistent display.

---

## Context Visible

Visible only when relevant.

---

## Hidden

Retained but not displayed.

---

# Default Visibility

MVP default:

```text
Context Visible
```

---

# Grid System

Cartesian grid support exists.

Default state:

```text
Disabled
```

Grid may be enabled by users.

Grid never overrides radial systems.

---

# Snap Visualization

Visual feedback is mandatory.

Supported feedback includes:

* ghost alignment previews
* highlighted targets
* guide emphasis
* snap indicators
* alignment markers

Feedback must update continuously.

---

# Stability Rules

The snap engine must prevent:

* oscillation
* target thrashing
* jitter
* rapid target switching

Snap stability is more important than snap aggressiveness.

---

# Zoom-Aware Behavior

Snap visualization may scale with zoom level.

Examples:

* reduced clutter when zoomed out
* additional indicators when zoomed in

Snap calculations themselves remain consistent regardless of zoom level.

---

# Temporary Snap Override

Users may temporarily bypass snapping.

Implementation may use modifier keys.

This behavior must remain discoverable through tooltips and help documentation.

---

# Validation Integration

Validation may inspect:

* near-miss alignments
* inconsistent spacing
* sector inconsistencies
* guide conflicts

Validation may recommend snap corrections.

Validation may not automatically alter geometry.

---

# Performance Requirements

Snap evaluation must:

* operate in real time
* remain stable under rapid pointer movement
* avoid full scene recomputation
* scale to large projects

---

# Integration Targets

The snapping engine integrates with:

* move transforms
* rotate transforms
* scale transforms
* radial resize transforms
* angular resize transforms
* ring rotation
* guide editing
* group transforms

through a shared snapping subsystem.

---

# Runtime Relationship

Guides and snapping are editor-only systems.

Runtime exports:

* do not include guides
* do not include snapping logic
* do not include drafting aids

Runtime interaction remains independent.

---

# Agent Directives

## Directive 1

Snapping assists users.

It never controls users.

---

## Directive 2

Guides are editor data.

Not runtime data.

---

## Directive 3

Snapping remains optional and configurable.

---

## Directive 4

Radial systems are first-class citizens.

Cartesian systems are supplementary.

---

## Directive 5

Visual feedback is required for all snap operations.

---

## Directive 6

Validation may recommend corrections but may never silently apply them.

---

## Directive 7

Snap stability takes precedence over snap aggressiveness.

---

## Directive 8

Users must always be able to intentionally place geometry off-guide.

---

# Architectural Outcome

The Urania snapping and guide system provides powerful spatial assistance while preserving user agency, supporting radial drafting workflows, and maintaining compatibility with future mechanism families. Snapping remains a non-invasive geometric aid rather than a constraint system, ensuring predictable and intuitive editing behavior.

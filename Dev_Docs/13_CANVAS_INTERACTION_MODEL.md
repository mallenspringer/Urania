# 13_CANVAS_INTERACTION_MODEL.md

# Urania Canvas Interaction Model

## Purpose

This document defines how users interact with the Urania workspace.

It establishes:

* pointer behavior
* selection behavior
* navigation
* hit testing
* ring interaction
* touch interaction
* canvas feedback
* editing context rules

This document does not define transformation behavior. Transform operations are specified separately in the Transform System.

---

# Core Philosophy

The canvas exists to support direct manipulation.

Users should interact primarily with objects and rings rather than dialog boxes.

The interaction model prioritizes:

1. Direct manipulation
2. Visual feedback
3. Active-ring workflow
4. Low-friction drafting
5. Discoverability

---

# Active Ring Principle

Urania is an active-ring editor.

At any given time:

```text
One Ring
=
Primary Editing Context
```

The active ring receives selection priority over all other rings.

This rule overrides normal visual stacking behavior.

---

# Selection Priority

When multiple selectable entities overlap:

Selection order:

1. Active ring objects
2. Other ring objects
3. Ring controls
4. Background

This minimizes accidental selection of reference layers while drafting.

---

# Active Ring Bias

Hit testing is biased toward the active ring.

Users are expected to:

* edit one ring
* compare against others

simultaneously.

The interaction model supports this workflow explicitly.

---

# Mouse Wheel Behavior

Mouse wheel controls canvas zoom.

Wheel scrolling does not perform canvas scrolling.

---

# Zoom Center

Zoom is cursor-centered.

The point beneath the cursor remains the focal point during zoom operations.

---

# Zoom Model

Canvas zoom uses logarithmic scaling.

Zoom should feel:

* precise at low velocity
* fast at high velocity

---

# Zoom Acceleration

Zoom acceleration is velocity-sensitive.

Slow wheel movement:

```text
Precision Zoom
```

Fast wheel movement:

```text
Accelerated Zoom
```

The system should favor user intent over numerical precision.

---

# Zoom Presets

The editor should expose common zoom levels.

Examples:

```text
25%
50%
100%
200%
400%
```

Exact values may evolve.

---

# Zoom Commands

The editor should provide:

```text
Fit All
Fit Selected
100%
```

commands.

---

# Zoom Limits

Initial recommendation:

```text
5%
to
6400%
```

Implementation may adjust if required.

---

# Pan Controls

Canvas panning supports:

```text
Middle Mouse Drag
Space + Drag
```

Both methods are required.

---

# Touchpad Support

Trackpad pinch-to-zoom is supported.

Native platform behaviors should be respected whenever practical.

---

# Touch Device Support

MVP target:

```text
Desktop First
Mobile Functional
```

Mobile editing is supported but not optimized to the same degree as desktop workflows.

---

# Mobile Gesture Set

Required MVP gestures:

```text
Tap
Pan
Pinch
```

Advanced gesture systems are out of scope for MVP.

---

# Pointer Capture

During drag operations:

Pointer capture remains with the initiating object.

Objects continue receiving events even if the cursor leaves their bounds.

---

# Drag Threshold

Dragging begins only after a small movement threshold.

This prevents accidental drags from minor pointer movement.

---

# Cursor System

Dynamic cursors are required.

Cursor appearance should communicate:

* selection
* movement
* rotation
* resize
* text editing
* panning
* zoom operations

Users should rarely need to guess what interaction is available.

---

# Hover Feedback

Interactive entities provide hover feedback.

Hover should communicate:

* selectability
* editability
* interaction affordances

---

# Drag Hover Behavior

During active drag operations:

Hover feedback for unrelated objects is suppressed.

Interaction focus remains on the dragged object.

---

# Empty Canvas Click

Clicking empty canvas:

```text
Clears Selection
```

---

# Right Click

Canvas supports context menus.

Context menus should be context-sensitive.

---

# Locked Objects

Locked objects remain selectable.

Locked objects are not editable.

This allows inspection without modification.

---

# Hidden Objects

Hidden objects do not participate in hit testing.

---

# Visibility vs Drafting Opacity

Visibility and drafting opacity are separate systems.

---

## Visibility

Visibility is Project State.

Visibility affects:

* rendering
* export
* save data
* hit testing

Invisible project elements are excluded from export.

---

## Drafting Opacity

Drafting opacity is Editor State.

Drafting opacity exists to assist visual comparison while editing.

Drafting opacity is not exported.

Drafting opacity is not serialized as mechanism state.

---

# Opacity = 0%

When drafting opacity reaches:

```text
0%
```

the layer:

* is visually hidden
* does not participate in hit testing

The underlying project data remains unchanged.

---

# Layer State Summary

| State               | Visible | Selectable | Exported |
| ------------------- | ------- | ---------- | -------- |
| Normal              | Yes     | Yes        | Yes      |
| Drafting Opacity 0% | No      | No         | Yes      |
| Hidden              | No      | No         | No       |

---

# Selection Cycling

When multiple valid targets exist:

Modifier-assisted selection cycling is used.

Repeated-click cycling is not used.

This provides greater user control and predictability.

---

# Marquee Selection

Marquee selection begins from empty canvas space.

Supported modes:

```text
Touching Objects
Fully Enclosed Objects
```

Modifier keys determine behavior.

---

# Text Editing Entry

Text editing may be entered through:

```text
Double Click
Enter Key
```

Both methods are supported.

---

# Text Editing Mode

While actively editing text:

Canvas editing interactions are suspended.

Ring manipulation controls are unavailable.

Text editing is treated as a modal editing state.

---

# Selection Visualization

Selection visualization depends on object type.

Supported visualizations include:

* bounding boxes
* geometry outlines
* specialized editors

The most appropriate representation should be used.

---

# Coordinate Readout

The editor provides live coordinate feedback.

Display includes:

* Cartesian position
* Radius
* Angle

This information updates continuously.

---

# Active Ring Visualization

The active ring must be visually obvious.

Users should never need to guess which ring is currently active.

---

# Ring Rotation Readout

While rotating a ring:

Display:

* live angle
* current rotation value

both near the cursor and within sidebar controls.

---

# Ring Rotation Tabs

Rotation tabs are the primary direct-manipulation control for ring rotation.

Tabs are displayed only for the active ring.

---

# Rotation Tab Visibility

Inactive rings do not display active rotation controls.

This reduces visual clutter.

---

# Rotation Tab Styling

Rotation tabs function as:

```text
Interaction Control
+
Ring Status Indicator
```

Their appearance communicates ring state.

---

## Normal Ring

Tab displays normally.

---

## Drafting Opacity = 0%

Tab remains visible.

Tab appearance becomes muted or partially transparent.

Purpose:

* indicate existence
* permit recovery of visibility
* distinguish from hidden state

---

## Hidden Ring

Tab appearance becomes clearly disabled.

Examples:

* darkened appearance
* disabled styling
* hidden-state iconography

Hidden rings must remain visually distinguishable from opacity-hidden rings.

---

# Focus Mode

Focus Mode hides all non-active rings.

Purpose:

```text
Isolation Editing
```

Opacity controls remain available outside Focus Mode.

Focus Mode does not introduce alternate opacity systems.

---

# Multi-Layer Drafting

Outside Focus Mode:

Users may simultaneously view multiple rings.

Per-ring controls include:

* visibility
* drafting opacity

Changes update immediately.

---

# Ring Manipulation During Editing

Users may manipulate ring rotation while editing other ring content.

This supports continual visual comparison during drafting.

Exception:

Text-edit mode suspends ring interaction.

---

# Hit Testing Rules

Hit testing follows:

1. Active ring bias
2. Visibility checks
3. Opacity checks
4. Object priority rules

Hidden or opacity-zero layers are excluded.

---

# Background Interaction

Background interaction supports:

* deselection
* marquee initiation
* context menus

Background clicks never select hidden content.

---

# Escape Key Behavior

Escape follows hierarchical cancellation.

Priority:

1. Cancel active operation
2. Exit editing mode
3. Clear selection

---

# Keyboard Navigation

Arrow keys perform object nudging.

Canvas panning is not bound to arrow keys.

---

# Spacebar

Spacebar is reserved for temporary panning.

---

# Canvas Rotation

Workspace rotation is out of scope for MVP.

---

# Minimap

Minimap functionality is out of scope for MVP.

---

# Validation Expectations

Canvas interactions must:

* respect lock state
* respect visibility state
* respect active-ring bias
* preserve direct-manipulation workflows

---

# Agent Directives

## Directive 1

Prioritize direct manipulation over dialog-driven interaction.

---

## Directive 2

The active ring is the primary editing context.

---

## Directive 3

Selection behavior must favor active-ring content.

---

## Directive 4

Visibility and drafting opacity are separate systems.

---

## Directive 5

Rotation tabs serve both interaction and state-indication purposes.

---

## Directive 6

Focus Mode hides non-active rings.

---

## Directive 7

Text editing is modal.

---

## Directive 8

Canvas zoom should optimize for user intent rather than numerical precision.

---

## Directive 9

Users should receive continuous visual feedback regarding interaction state.

---

## Directive 10

The canvas should remain usable with both mouse and touch input.

---

# Architectural Rule

Users should spend their time interacting with the mechanism itself, not managing the editor.

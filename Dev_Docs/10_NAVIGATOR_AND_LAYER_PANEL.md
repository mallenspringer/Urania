# 10_NAVIGATOR_AND_LAYER_PANEL.md

# Urania Navigator & Layer Panel Architecture

## Purpose

The Navigator Panel provides a hierarchical view of project structure.

It serves as the primary interface for:

* hierarchy navigation
* object discovery
* visibility management
* locking
* naming
* structural organization
* z-order management

The navigator is the authoritative structural view of the project.

The canvas is the authoritative visual view.

Both must remain synchronized.

---

# Core Philosophy

The navigator is not a separate representation of the project.

The navigator is a view of the Scene Graph.

All navigator operations ultimately modify Scene Graph data through commands.

---

# Architectural Rule

The navigator never owns project data.

The navigator displays project data.

The Scene Graph remains the source of truth.

---

# Panel Structure

Urania uses a combined:

```text
Navigator + Layer Panel
```

approach.

Separate navigator and layer panels are prohibited.

Hierarchy, visibility, locking, and ordering should exist in a single integrated view.

---

# Hierarchy Structure

Default hierarchy:

```text
Project
│
├── Ring 1
│   ├── Sector 1
│   │   ├── Objects
│   │   └── Windows
│   │
│   ├── Sector 2
│   └── ...
│
├── Ring 2
│   ├── Sector 1
│   └── ...
│
└── Guides
```

This hierarchy mirrors logical project structure.

---

# Rings

Rings appear as top-level editable entities.

Ring nodes expose:

* name
* visibility
* lock state
* sector children
* z-order position

Rings must be selectable from the navigator.

---

# Sectors

Sectors appear as children of rings.

Sectors are first-class entities.

Sectors must be visible within the hierarchy.

Reason:

* supports navigation
* supports selection
* supports future sector-specific workflows
* mirrors actual mechanism structure

---

# Sector Display

Sector entries should display:

```text
Name
Angle Information
```

Example:

```text
Aries
0° – 30°
```

or equivalent presentation.

Users should be able to rename sectors.

---

# Objects

Objects appear beneath their owning sector.

Examples:

```text
Text

Arc Text

Shape

Window

Image
```

Object hierarchy should reflect ownership.

Example:

```text
Ring
    Sector
        Object
```

rather than:

```text
Ring
    Object
```

Sector membership is structural.

The hierarchy should make it visible.

---

# Guides

Guides exist in a dedicated top-level section.

Example:

```text
Guides
    Radial Guide
    Circular Guide
```

Guides must not be mixed into ring hierarchies.

Reason:

Guides support drafting.

They are not mechanism content.

---

# Pattern Instances

Generated pattern instances should not appear in the navigator.

Only source objects appear.

Pattern instances are derived representations.

They are not independent scene graph entities.

---

# Visibility Controls

All navigator entries should expose visibility controls.

Example:

```text
👁 Visible
```

Visibility controls must operate through commands.

Visibility changes modify project data.

Visibility changes participate in:

* save/load
* undo/redo
* exports

---

# Lock Controls

All navigator entries should expose lock controls.

Example:

```text
🔒 Locked
```

Lock state participates in project data.

Lock changes must operate through commands.

---

# Hidden Object Behavior

Hidden objects remain visible in the navigator.

Example:

```text
Object
👁 Off
```

Users must be able to:

* locate hidden objects
* re-enable visibility
* edit metadata

without making them visible first.

---

# Selection Synchronization

Navigator selection and canvas selection represent the same editor state.

Canvas:

```text
Select Object
```

must update:

```text
Navigator Selection
```

Navigator:

```text
Select Object
```

must update:

```text
Canvas Selection
```

Both views remain synchronized.

---

# Multi-Selection

Navigator supports multi-selection.

Examples:

```text
Shift Click

Ctrl Click
```

or platform-equivalent interactions.

Multi-selection behavior must match canvas selection behavior.

---

# Active Selection

The active selection should be visually indicated.

Example:

```text
Selected Objects

Active Object
```

The active selection indicator must remain synchronized with the Selection System.

---

# Active Ring Indicator

The currently active ring should be visually distinguished.

Examples:

```text
Highlight

Marker

Badge
```

Implementation is flexible.

Visibility of active ring state is mandatory.

---

# Ring Color Markers

Rings may display editor-only identification colors.

Examples:

```text
Ring 1
🟦

Ring 2
🟩

Ring 3
🟨
```

These colors:

* belong to Editor State
* are not project data
* are not exported
* are not serialized

Purpose:

Improved visual navigation.

---

# Collapse Behavior

All hierarchy nodes should support collapse and expansion.

Examples:

```text
Ring

Sector

Guides
```

Collapse state belongs to Editor State.

Collapse state is never exported.

---

# Context Menus

Navigator entries support context menus.

Context menus should mirror canvas operations whenever practical.

Examples:

```text
Rename

Duplicate

Delete

Visibility

Lock

Properties
```

The same command system must be used regardless of entry point.

---

# Empty Area Context Menu

Empty navigator space may expose context actions.

Examples:

```text
Create Ring

Paste

Expand All

Collapse All
```

Implementation is flexible.

---

# Renaming

Navigator supports inline renaming.

Examples:

```text
Ring Name

Sector Name

Object Name
```

Renaming must execute through commands.

Direct mutation is prohibited.

---

# Ring Ordering

Ring z-order is managed through navigator drag-and-drop.

Example:

Before:

```text
Ring 1
Ring 2
Ring 3
```

After:

```text
Ring 1
Ring 3
Ring 2
```

This operation changes scene graph ordering.

The operation must be undoable.

---

# Object Ordering

Objects may be reordered within their owning container.

Object ordering affects rendering order.

Ordering changes must execute through commands.

---

# Sector Ordering

Sector ordering is not user-editable.

Sector order derives from sector geometry.

Users should not drag sectors to reorder them.

---

# Ring Creation Placement

New rings should be inserted above the currently selected ring.

Example:

Before:

```text
Ring 1
Ring 2 (selected)
Ring 3
```

Create Ring:

```text
Ring 1
Ring 2
New Ring
Ring 3
```

If no ring is selected, use application defaults.

---

# Search

Search is not required for MVP.

The navigator architecture should not depend on search functionality.

Future search support may be added later.

---

# Performance Requirements

Navigator updates should be incremental.

Avoid rebuilding the entire hierarchy for localized changes.

Examples:

```text
Rename Object

Visibility Change

Selection Change
```

should update only affected nodes.

---

# Navigator State

Navigator-specific UI state belongs to Editor State.

Examples:

```text
Collapsed Nodes

Scroll Position

Ring Colors
```

Navigator state is never exported.

Navigator state is never stored as project data.

---

# Command Integration

All navigator actions must use commands.

Examples:

```text
Rename

Delete

Visibility

Lock

Reorder
```

Direct scene graph mutation is prohibited.

---

# Agent Directives

## Directive 1

The navigator is a view of the Scene Graph.

Never treat it as a separate hierarchy.

---

## Directive 2

Navigator and canvas selections must remain synchronized.

---

## Directive 3

All navigator actions execute through commands.

---

## Directive 4

Pattern instances must not appear as independent navigator entries.

---

## Directive 5

Hidden objects remain visible in the navigator.

---

## Directive 6

Ring ordering occurs through navigator drag-and-drop.

---

## Directive 7

Sector ordering is derived from geometry and is not directly editable.

---

## Directive 8

Ring identification colors belong to Editor State.

Never Project State.

---

## Directive 9

Visibility and lock controls belong directly within navigator entries.

---

## Directive 10

The navigator must scale cleanly to projects containing multiple rings and large object counts.

---

# Architectural Rule

The navigator exposes project structure.

The Scene Graph owns project structure.

The navigator must never become a second source of truth.

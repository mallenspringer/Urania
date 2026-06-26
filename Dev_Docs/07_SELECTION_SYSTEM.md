# 07_SELECTION_SYSTEM.md

# Urania Selection System Architecture

## Purpose

The Selection System determines:

* what may be selected
* how selection behaves
* how selection interacts with tools
* how selection interacts with commands
* how selection interacts with rendering

Selection is editor state.

Selection is not project data.

---

# Core Philosophy

Selection should behave predictably.

Users should generally be able to select what they can see.

Selection behavior should remain consistent across all object types whenever possible.

---

# Architectural Rule

Selection belongs to Editor State.

Never Project State.

Example:

```typescript
EditorState.selection
```

Correct.

Example:

```typescript
Project.selection
```

Incorrect.

---

# Selection Types

The editor supports explicit selection types.

Examples:

```typescript
RingSelection

SectorSelection

ObjectSelection

GuideSelection
```

Selection should not be represented as a generic collection of IDs without type information.

Explicit selection types simplify:

* property panels
* context menus
* transform behavior
* validation

---

# Selectable Entities

The following entities are selectable.

## Rings

Selectable.

Supports:

* naming
* visibility
* locking
* sector operations
* ring properties

Users should be able to select rings directly from the canvas.

Users should also be able to select rings from navigator panels.

---

## Sectors

Selectable.

Supports:

* sector editing
* sector labeling
* sector properties

---

## Shapes

Selectable.

Examples:

```text
Rectangle

Circle

Polygon

Line
```

---

## Windows

Selectable.

Examples:

```text
Circular Window

Polygon Window

Custom Window
```

Windows should select directly when clicked.

Window clicks do not pass through to revealed content.

---

## Text

Selectable.

Examples:

```text
Text

Arc Text

Labels
```

---

## Images

Selectable.

---

## Guides

Selectable.

Supports:

* repositioning
* editing
* deletion

---

# Selection Priority

Selection follows hierarchy priority.

Smallest visible selectable entity receives selection first.

Example:

```text
Text
inside Sector
inside Ring
```

Click:

```text
Text Selected
```

---

# Hierarchy Traversal

Users may traverse upward through hierarchy using modifier-assisted selection.

Example:

```text
Text
↓
Sector
↓
Ring
```

This behavior should not rely on repeated click cycling.

Repeated click cycling is prohibited.

Reason:

Modifier-based traversal is more predictable.

---

# Empty Canvas Behavior

Clicking empty canvas:

```text
Clear Selection
```

Selection should be removed immediately.

---

# Mixed Selection

Mixed-type selections are allowed.

Example:

```text
Text
+
Image
+
Window
```

Valid.

Property panels should display:

* common properties
* mixed-state indicators

where appropriate.

---

# Parent Child Selection Rule

Parent and child entities may not be selected simultaneously.

Example:

```text
Ring
+
Text On Ring
```

Invalid.

The selection system should prevent ambiguous parent-child selections.

---

# Selection Order

Selection order should be preserved.

Example:

```text
A
B
C
```

Results in:

```typescript
[A, B, C]
```

Selection order may be used by future tools.

Examples:

* alignment
* distribution
* automation

---

# Active Selection

Multi-selection supports an active object.

Example:

```text
Selected:
A
B
C

Active:
C
```

The active object may determine:

* property display
* transform origin
* context menus

---

# Locked Objects

Locked objects are excluded from editing.

Locked objects should not participate in hit testing.

Clicking a locked object:

```text
No Selection Change
```

---

# Hidden Objects

Hidden objects should not participate in hit testing.

Example:

```text
Visible = False
```

Results in:

```text
Not Clickable
```

---

# Hidden Object Access

Hidden objects may still be selected through navigator panels.

This allows:

* management
* unlocking
* visibility restoration

without requiring temporary visibility changes.

---

# Marquee Selection

The Selection Tool supports marquee selection.

Workflow:

```text
Click
Drag
Release
```

Creates:

```text
Selection Rectangle
```

---

# Marquee Rule

Touch selection.

Objects touched by the marquee become selected.

Full enclosure is not required.

Reason:

Simpler interaction model.

More approachable for casual users.

---

# Marquee And Locked Objects

Locked objects should be ignored.

Marquee selection should not include them.

---

# Marquee And Hidden Objects

Hidden objects should be ignored.

Marquee selection should not include them.

---

# Pattern Instance Selection

Pattern instances are not independent objects.

Clicking a generated instance:

```text
Select Pattern Source
```

The source object becomes selected.

---

# Pattern Visualization

When selecting through a pattern instance:

Display:

```text
Source Object

Selected Instance
```

Both should be visually highlighted.

This improves clarity.

---

# Sector Boundary Selection

Sector boundaries are directly selectable.

Clicking a sector divider selects:

```text
Boundary Handle
```

Not the sector body.

This supports direct sector resizing workflows.

---

# Ring Boundary Rule

Ring inner radius and outer radius are not directly draggable canvas handles.

Ring dimensions should be edited through:

* property panels
* ring controls
* numeric inputs

Reason:

Reduces accidental edits.

Separates structural editing from drafting interactions.

---

# Ring Rotation Tabs

Ring rotation tabs are interaction controls.

Not selection controls.

Dragging a rotation tab:

```text
Rotate Ring
```

must preserve existing selection.

Example:

```text
Text Selected
↓
Rotate Ring
↓
Text Still Selected
```

Selection should not change.

---

# Future Selection Interaction

Future versions may add:

```text
Double Click Tab
↓
Select Ring
```

Such features should remain additive.

Default tab dragging behavior remains unchanged.

---

# Double Click Behavior

Double click is context-sensitive.

Examples:

```text
Text
↓
Edit Text
```

```text
Sector
↓
Sector Properties
```

Double click behavior should remain object-specific.

---

# Context Menus

Right click opens context menus.

---

## Selection Context

When selection exists:

Display object-specific actions.

Examples:

```text
Delete

Duplicate

Pattern

Properties
```

---

## Empty Canvas Context

When no selection exists:

Display canvas actions.

Examples:

```text
Paste

Create Guide

Zoom To Fit

Reset View
```

---

# Navigator Synchronization

Selection must remain synchronized.

Canvas Selection:

```text
Canvas
↓
Navigator Updates
```

Navigator Selection:

```text
Navigator
↓
Canvas Updates
```

Both views represent the same editor state.

---

# Undo Behavior

Selection is editor state.

Selection does not participate in undo history.

However:

If an object remains valid after undo:

```text
Selection Should Be Preserved
```

Example:

```text
Select Object

Move Object

Undo
```

Object remains selected.

---

# Selection Rendering

Selection visuals belong to the renderer.

Examples:

```text
Bounding Boxes

Handles

Highlights

Selection Indicators
```

Selection rendering should remain separate from project data.

---

# Agent Directives

These directives are mandatory.

---

## Directive 1

Selection belongs to Editor State.

Never Project State.

---

## Directive 2

Selection must support explicit selection types.

Avoid generic ID-only selection systems.

---

## Directive 3

Users should generally be able to select visible entities directly.

---

## Directive 4

Locked objects must be excluded from hit testing.

---

## Directive 5

Hidden objects must be excluded from hit testing.

---

## Directive 6

Pattern instances select their source object.

---

## Directive 7

Parent-child simultaneous selection is prohibited.

---

## Directive 8

Ring rotation interactions must not alter selection.

---

## Directive 9

Selection order must be preserved.

---

## Directive 10

Selection behavior should prioritize predictability over clever interaction patterns.

Avoid repeated-click cycling and other hidden behaviors.

Use explicit interactions whenever possible.

---

# Architectural Rule

Selection represents user focus.

Selection is temporary.

Selection is editor state.

The Scene Graph remains the source of truth.

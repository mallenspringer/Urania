# 06_TOOL_SYSTEM.md

# Urania Tool System Architecture

## Purpose

The Tool System defines how users create and manipulate content within Urania.

This document establishes:

* Tool behavior
* Tool lifecycle
* Tool registration
* Tool interaction rules
* Tool responsibilities
* Agent implementation requirements

The goal is consistency.

Every tool should behave predictably regardless of purpose.

---

# Core Philosophy

Tools represent user intentions.

Examples:

```text
Create Rectangle

Create Window

Create Text

Create Guide
```

Tools should not own project state.

Tools should not mutate project data directly.

Tools collect intent and produce commands.

---

# Tools vs Interactions

Urania explicitly separates tools from interactions.

---

## Tools

Examples:

```text
Rectangle Tool

Text Tool

Arc Text Tool

Guide Tool

Window Circle Tool
```

Tools create or modify content.

---

## Global Interactions

Examples:

```text
Ring Rotation

Zoom

Pan

Undo

Redo

Selection
```

Global interactions remain available regardless of active tool.

Users should never switch tools simply to inspect or operate a mechanism.

---

# Architectural Rule

Tools do not modify project data.

Tools generate commands.

Commands modify project data.

Required flow:

```text
Tool
    ↓
Command
    ↓
Scene Graph
```

Direct mutation is prohibited.

---

# Tool Categories

The toolbox is organized into categories.

---

## Selection

Primary editing tools.

Examples:

```text
Select
```

---

## Mechanism

Mechanism-specific operations.

Examples:

```text
Create Ring

Create Sector
```

---

## Shapes

Examples:

```text
Rectangle

Circle

Polygon

Line
```

---

## Windows

Examples:

```text
Window Circle

Window Rectangle

Window Polygon
```

Windows receive dedicated creation tools.

---

## Text

Examples:

```text
Text

Arc Text

Sector Label
```

---

## Images

Examples:

```text
Import Image
```

---

## Guides

Examples:

```text
Radial Guide

Circular Guide
```

---

## Patterns

Patterning is not a tool category.

Patterning is a capability applied to existing objects.

---

# Pattern Philosophy

Patterning should operate on selections.

Workflow:

```text
Select Object
    ↓
Apply Pattern
```

Examples:

```text
Radial Pattern

Sector Pattern

Alternating Pattern
```

Pattern creation should not require entering a dedicated tool mode.

---

# Tool Lifecycle

Every tool must follow the same lifecycle.

---

## Phase 1

Activate

Tool becomes active.

Example:

```text
Rectangle Tool Selected
```

---

## Phase 2

Preview

User interaction creates temporary visual feedback.

Examples:

```text
Rectangle Preview

Window Preview

Guide Preview
```

Preview geometry is not project data.

Preview geometry is not part of the scene graph.

---

## Phase 3

Validate

Tool validates proposed operation.

Examples:

```text
Minimum Radius

Valid Sector Span

Valid Geometry
```

---

## Phase 4

Generate Command

Tool creates command object.

Example:

```text
CreateRectangleCommand
```

---

## Phase 5

Commit

Command executes.

Scene graph updates.

History updates.

Renderer updates.

---

## Phase 6

Deactivate

Optional.

Depends on tool persistence settings.

---

# Architectural Rule

Every creation tool must follow:

```text
Activate
Preview
Validate
Command
Commit
```

No exceptions.

---

# Selection Tool

The Selection Tool is the primary editing tool.

Most object editing should occur here.

---

## Responsibilities

Supports:

```text
Move

Rotate

Scale

Resize

Multi-Select

Property Editing
```

for applicable object types.

---

# Sector Editing

Sector editing should behave like object transformation.

Users edit sector boundaries directly.

Examples:

```text
Drag Boundary

Numeric Entry
```

Sector editing should not require a dedicated editing mode.

This maintains consistency with other geometry editing workflows.

---

# Window Editing

Window creation uses dedicated tools.

Window editing uses the Selection Tool.

Workflow:

```text
Create Window Tool
```

then

```text
Select Tool
```

for modification.

---

# Guide Creation

Guides use dedicated tools.

Reason:

Guide creation differs conceptually from object creation.

Supported guide types:

```text
Radial Guide

Circular Guide
```

Additional guide types may be added later.

---

# Tool Persistence

Tool persistence is configurable.

---

## Default Behavior

After creation:

```text
Return To Select Tool
```

This is the default Urania behavior.

---

## Locked Tool Mode

Users may lock a tool.

Example:

```text
Rectangle Tool 🔒
```

Allows:

```text
Rectangle

Rectangle

Rectangle
```

without reselecting the tool.

---

# Esc Behavior

Esc should behave consistently.

---

## Active Operation

Example:

```text
Drawing Rectangle
```

Esc:

```text
Cancel Current Operation
```

---

## No Active Operation

Esc:

```text
Return To Select Tool
```

---

# Double Click Behavior

Double click is supported.

Examples:

```text
Double Click Text
    ↓
Edit Text

Double Click Arc Text
    ↓
Edit Text

Double Click Sector
    ↓
Edit Sector Properties
```

Double click should be context-sensitive.

---

# Right Click Behavior

Right click opens context menus.

Examples:

```text
Delete

Duplicate

Pattern

Properties
```

Context menus depend on selection type.

---

# Tool Shortcuts

Tools may expose keyboard shortcuts.

Examples:

```text
V = Select

R = Rectangle

T = Text

G = Guide
```

Shortcut assignments should remain configurable.

---

# Tool State Persistence

Projects should always open with:

```text
Select Tool
```

Tool state should not persist between sessions.

Reason:

Predictable startup behavior.

---

# Tool Settings

Tools may maintain persistent settings.

Examples:

```text
Polygon Sides

Default Radius

Guide Style
```

Tool settings should persist across uses.

Tool settings are editor preferences.

Not project data.

---

# Tool Previews

All creation tools should provide live previews.

Examples:

```text
Shape Creation

Window Creation

Guide Placement
```

Users should understand the result before committing.

---

# Preview Rules

Preview geometry:

* is temporary
* is renderer-owned
* is not scene graph data
* is not exportable
* is not saved

Previews exist solely for interaction feedback.

---

# Marquee Selection

Selection Tool supports marquee selection.

Example:

```text
Click Drag
    ↓
Selection Rectangle
```

Supports:

```text
Replace Selection

Add To Selection

Remove From Selection
```

depending on modifier keys.

---

# Multi-Selection

Multiple objects may be selected simultaneously.

Selection Tool should support:

```text
Move

Scale

Delete

Property Changes
```

across all selected objects.

---

# Tool Registry

Tools must be registered.

Avoid hardcoded tool systems.

Example:

```typescript
ToolRegistry.register(
    RectangleTool
);
```

---

# Registry Responsibilities

Provides:

```text
Discovery

Activation

Shortcut Mapping

Tool Metadata
```

Centralizing tool management simplifies future expansion.

---

# Future Expansion

New tools should be implementable without modifying existing tools.

Examples:

```text
Bezier Tool

Custom Window Tool

Measurement Tool

Future Mechanism Tools
```

The architecture should support extension through registration.

---

# Agent Directives

These directives are mandatory.

---

## Directive 1

Tools may not mutate scene graph data.

Ever.

---

## Directive 2

Tools must generate commands.

Commands perform mutations.

---

## Directive 3

All creation tools follow:

```text
Activate
Preview
Validate
Generate Command
Commit
```

---

## Directive 4

Preview geometry must remain separate from project data.

---

## Directive 5

Patterning is a capability.

Not a tool mode.

---

## Directive 6

Selection Tool is the primary editing tool.

Avoid creating specialized editing tools unnecessarily.

---

## Directive 7

Ring rotation remains available regardless of active tool.

Never require a rotation tool.

---

## Directive 8

Global interactions must remain available across all tools.

---

## Directive 9

New tools must register through the Tool Registry.

Do not hardcode tool activation.

---

## Directive 10

Tool behavior should remain consistent across the entire application.

User expectations established by one tool should apply to all others whenever possible.

---

# Architectural Rule

Tools exist to collect intent.

Commands exist to change data.

The Scene Graph remains the source of truth.

The Tool System must never bypass the Command System.

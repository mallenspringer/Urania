# 19_EDITOR_UI_SPEC.md

# Urania Editor UI Specification

## Purpose

This document defines the visual layout, navigation model, panel organization, interaction surfaces, and user-facing workflows of the Urania editor.

This specification governs:

* workspace layout
* panel responsibilities
* toolbar organization
* selection workflows
* property editing
* runtime preview access
* validation access
* project navigation

The goal is to provide a powerful design environment while maintaining a low learning curve and minimizing UI clutter.

---

# Core UX Philosophy

Urania is a direct-manipulation editor.

Users should primarily interact with:

* the canvas
* ring grab tabs
* selection handles
* contextual controls

Panels and menus exist to provide precision and configuration, not as the primary editing surface.

---

# Primary Workspace Layout

```text
┌─────────────────────────────────────────────┐
│ Top Toolbar                                 │
├────────┬──────────────────────┬─────────────┤
│ Left   │                      │ Right       │
│ Panel  │      Canvas          │ Panel       │
│        │                      │             │
├────────┴──────────────────────┴─────────────┤
│ Status Bar                                  │
└─────────────────────────────────────────────┘
```

---

# Sidebar Behavior

## Left Sidebar

Collapsible.

Default state: visible.

Purpose:

Project structure and navigation.

---

## Right Sidebar

Collapsible.

Default state: visible.

Purpose:

Property inspection and editing.

---

# Left Sidebar Responsibilities

The left sidebar answers:

```text
What exists in this project?
```

---

# Project Tree Structure

Hierarchy:

```text
Project

  Ring

    Layer

      Object
```

---

# Tree Presentation

Collapsible hierarchy.

Example:

```text
▼ Outer Ring

    ▼ Artwork Layer

        Text

        Window

        Polygon

▶ Middle Ring

▶ Inner Ring
```

---

# Tree Item Controls

## Ring Rows

Display:

* visibility toggle
* lock toggle
* name
* current rotation indicator

Example:

```text
👁 🔒 Outer Ring     45°
```

Rotation indicator may support drag-to-scrub interaction.

---

## Layer Rows

Display:

* visibility toggle
* lock toggle
* name

---

## Object Rows

Display:

* visibility toggle
* lock toggle
* name

---

# Object Naming

Users may rename:

* rings
* layers
* objects

Names are optional.

Unnamed objects use generated names.

Examples:

```text
Rectangle 12

Window 4

Text 3
```

---

# Ring Management

Ring selection available through:

* project tree
* canvas interaction
* grab tabs

Ring creation, deletion, and configuration are handled through project controls and property panels.

---

# Canvas Workspace

The canvas is the primary editing environment.

Most editing actions should be available directly on the canvas.

---

# Canvas Responsibilities

Supports:

* object editing
* ring rotation
* runtime inspection
* guide placement
* snapping feedback
* selection visualization

---

# Ring Grab Tabs

Each ring exposes a grab tab.

Purpose:

* rotate ring
* identify ring
* provide immediate drafting feedback

---

# Tab Behavior

Supports:

* click
* drag
* hover feedback

Hidden rings do not display active grab tabs.

Transparent rings retain active tabs.

---

# Object Mode vs Slice Mode

Urania supports two primary editing modes.

---

## Object Mode

Default.

Users manipulate individual objects.

---

## Slice Mode

Users manipulate sector-level structures.

---

# Mode Control

Large persistent toggle located above the canvas.

Not hidden inside menus.

---

# Runtime Preview

Runtime preview is a workspace-level feature.

---

# Access

Primary preview control appears adjacent to the canvas workspace.

---

# Modes

Supports:

* split view
* dedicated preview mode

---

# Toolbar Specification

Location:

Top of workspace.

---

# Layout

Responsive toolbar.

Supports overflow behavior.

Avoid multi-row toolbars in normal operation.

---

# Tool Categories

## Selection

```text
Select

Marquee Select
```

---

## Creation

```text
Shapes

Windows

Text

Images

Guides
```

Presented as grouped controls.

---

## Transform

```text
Move

Rotate

Scale

Radial Resize

Angular Resize
```

Available through:

* toolbar
* direct manipulation handles

---

# Active Tool Display

Current active tool remains continuously visible.

Example:

```text
Active Tool: Polygon
```

---

# Tool Persistence

MVP behavior:

After object creation:

```text
Return To Select Tool
```

---

# Keyboard Tool Switching

Supported.

Examples:

```text
V = Select

T = Text

G = Guide
```

Tooltips must expose shortcuts.

---

# Context Menus

Context menus are fully supported.

Right-click menus are context-sensitive.

---

# Example Actions

```text
Duplicate

Delete

Move To Layer

Convert To Pattern

Bring Forward

Send Backward
```

---

# Property Panel

The right sidebar functions as an inspector.

---

# Inspector Behavior

Selection drives inspector contents.

---

## No Selection

Display project-level properties.

Examples:

```text
Project Name

Canvas Size

Export Settings
```

---

## Ring Selected

Display ring inspector.

---

## Layer Selected

Display layer inspector.

---

## Object Selected

Display object inspector.

---

# Inspector Organization

Uses fixed collapsible sections.

Example:

```text
Transform ▼

Appearance ▼

Pattern ▶

Metadata ▶
```

---

# Transform Section

Transform section is always pinned to the top.

Transform controls are considered primary controls.

---

# Property Editing

Numeric properties support:

* direct entry
* arrow increments
* drag-to-scrub

---

# Units

Users may switch between:

* internal units
* inches
* millimeters

---

# Property Updates

All property changes apply immediately.

No Apply button.

No Commit button.

---

# Multi-Selection Editing

Supported.

Inspector displays only shared properties.

Example:

```text
Position

Rotation

Visibility
```

Non-shared properties remain hidden.

---

# Validation Integration

Validation access lives in the right sidebar.

---

# Validation Display

Supports:

* inline warnings
* field-level indicators
* project validation panel

---

# Validation Philosophy

Validation should appear as close as possible to the property being validated.

Avoid separate error-only workflows.

---

# Visibility Controls

Visibility and lock state are exposed directly in the project tree.

---

# Drafting Opacity

Drafting opacity is a ring-level editor property.

Configured from the inspector.

Not exposed in the project tree.

---

# Drafting Opacity Rules

Drafting opacity:

* affects editor display only
* does not affect exports
* does not affect runtime output

---

# Zoom Controls

Primary zoom controls reside in the status bar.

---

# Zoom Interaction

Supports:

* mouse wheel
* trackpad pinch
* zoom control display

---

# Status Bar

Moderate information density.

Displays:

```text
Zoom Level

Snap Status

Canvas Coordinates
```

Selection count excluded from MVP.

---

# Snap Controls

Accessed through toolbar popover.

Not persistently displayed.

---

# Creation Workflow

Supports two workflows.

---

## Workflow A

Choose object type.

Place object.

---

## Workflow B

Activate tool.

Configure parameters.

Place object.

---

# Dangerous Operations

Confirmation dialogs appear only when significant data loss is possible.

Examples:

```text
Delete Ring

Delete Populated Layer

Clear Project
```

---

# Export Access

Export is a primary workflow.

Prominent toolbar button required.

---

# Validation Access

Validation lives in the right sidebar.

No dedicated toolbar button required for MVP.

---

# Template Workflow

Application launch opens Home Screen.

---

# Home Screen

Provides:

```text
New Project

Open Project

Help
```

---

# New Project Workflow

```text
Home Screen

    ↓

Template Picker

    ↓

Create Project
```

All new projects originate from the template picker.

Blank template appears first.

---

# Help System

MVP includes:

```text
Controls

Gestures

Shortcuts

Terminology
```

Presented as a help modal.

---

# Modifier Key Discovery

Dedicated shortcut reference modal required.

Tooltips should expose relevant shortcuts where appropriate.

---

# Agent Directives

## Directive 1

Canvas is the primary editing surface.

---

## Directive 2

Project tree is navigation, not configuration.

---

## Directive 3

Property inspector is configuration, not navigation.

---

## Directive 4

Object Mode and Slice Mode must remain highly visible.

---

## Directive 5

Transform controls remain immediately accessible.

---

## Directive 6

Validation appears near the data being validated.

---

## Directive 7

Runtime preview is treated as a core workflow.

---

## Directive 8

Export remains a first-class action.

---

## Directive 9

UI complexity must never obscure primary editing workflows.

---

## Directive 10

Every advanced feature should remain discoverable without requiring external documentation.

---

# Architectural Outcome

The Urania editor presents a direct-manipulation workspace centered on the canvas while providing structured navigation, precise configuration, and advanced tooling through carefully separated interface regions.

The resulting interface supports both novice hobbyists and advanced designers without requiring multiple editing modes, floating windows, or CAD-style panel complexity.

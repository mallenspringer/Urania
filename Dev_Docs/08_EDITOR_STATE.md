# 08_EDITOR_STATE.md

# Urania Editor State Architecture

## Purpose

This document defines the boundary between:

```text
Project State
```

and

```text
Editor State
```

This distinction is fundamental to Urania.

Many editor bugs, save/load issues, undo problems, and export inconsistencies originate from mixing these two concepts.

This document establishes strict rules for where information belongs.

---

# Core Principle

Project State and Editor State serve different purposes.

---

## Project State

Project State represents the mechanism being designed.

Project State answers:

> What is this thing?

Project State must:

* save with the project
* load with the project
* participate in exports
* participate in undo/redo
* be shared when a project file is shared

---

## Editor State

Editor State represents the current editing session.

Editor State answers:

> How am I currently viewing or interacting with this thing?

Editor State must not:

* affect exports
* affect saved project content
* participate in undo/redo
* alter project meaning

---

# Litmus Test

When deciding where data belongs, ask:

> If I send this `.urania` project file to another user, should they receive this information?

If:

```text
Yes
```

Store it in:

```text
Project State
```

If:

```text
No
```

Store it in:

```text
Editor State
```

---

# Examples

## Project State

Examples:

```text
Ring Geometry

Ring Rotation

Sector Layout

Window Geometry

Artwork

Text

Images

Object Visibility

Layer Visibility

Tool Defaults

Export Settings
```

These define the mechanism.

---

## Editor State

Examples:

```text
Selection

Hover State

Current Tool

Zoom

Pan

Focus Mode

Drafting Opacity

Guide Visibility

Snap Settings
```

These define the editing experience.

---

# Architectural Rule

Project State and Editor State must remain separate.

Editor State must never be embedded within project data structures.

Project State must never depend on editor state.

---

# State Categories

Editor State is divided into three categories:

```text
Session State

Workspace State

View State
```

---

# Session State

Represents temporary interaction state.

Examples:

```text
Selection

Hover Target

Drag Operation

Resize Operation

Preview Geometry

Active Handle
```

Session State exists only while editing.

Session State is never saved.

---

# Workspace State

Represents editor configuration.

Examples:

```text
Panel Layout

Sidebar Visibility

Inspector Visibility

Guide Visibility

Snapping Settings

Application Clipboard
```

Workspace State affects workflow.

Workspace State does not affect project content.

---

# View State

Represents the current viewport.

Examples:

```text
Zoom

Pan

Focus Mode

Drafting Opacity

Preview Modes
```

View State affects presentation.

View State does not affect exports.

---

# Project State Categories

Project State should be organized into logical domains.

---

## Scene Graph

Examples:

```text
Rings

Sectors

Shapes

Windows

Text

Images

Guides
```

---

## Mechanism State

Examples:

```text
Ring Rotation

Ring Ordering

Sector Definitions
```

---

## Visibility State

Examples:

```text
Ring Visible

Object Visible

Layer Visible
```

Visibility is project data.

Visibility affects exports.

Visibility is undoable.

Visibility must persist through save/load.

---

## Tool Defaults

Tool defaults are project-specific.

Examples:

```text
Default Polygon Sides

Default Guide Settings

Default Text Parameters
```

Tool defaults persist with the project.

---

## Export Configuration

Examples:

```text
Artwork Export Settings

Cut Export Settings

Fold Export Settings
```

Export behavior belongs to the project.

---

# Selection State

Selection belongs to Session State.

Examples:

```text
Selected Objects

Selected Ring

Selected Sector

Active Selection
```

Selection:

* is not saved
* is not exported
* is not undoable

Selection exists only during editing.

---

# Active Tool

Current tool belongs to Session State.

Examples:

```text
Rectangle Tool

Text Tool

Guide Tool
```

Projects should always open with:

```text
Select Tool
```

regardless of previous tool state.

---

# Hover State

Examples:

```text
Hovered Object

Hovered Handle

Hovered Guide
```

Hover state is temporary.

Hover state is never saved.

---

# Preview Geometry

Examples:

```text
Rectangle Preview

Guide Preview

Window Preview
```

Preview geometry belongs to Session State.

Preview geometry:

* is temporary
* is renderer-owned
* is not exportable
* is not project data

---

# Zoom State

Zoom belongs to View State.

Examples:

```text
50%

100%

400%
```

Zoom should not be saved with projects.

Projects should open using:

```text
Fit To View
```

or equivalent default framing behavior.

---

# Pan State

Pan belongs to View State.

Pan is temporary.

Pan is never saved with projects.

---

# Focus Mode

Focus Mode belongs to View State.

Examples:

```text
Solo Ring

Focus Ring

Drafting View
```

Focus Mode affects editing presentation.

Focus Mode does not affect project content.

Focus Mode is never saved.

---

# Drafting Opacity

Examples:

```text
Upper Rings = 30%

Lower Rings = 80%
```

Drafting opacity belongs to View State.

Drafting opacity:

* affects display
* does not affect exports
* is not project data

---

# Guide Visibility

Guide visibility belongs to Workspace State.

Examples:

```text
Show Guides

Hide Guides
```

Guide visibility does not alter guide existence.

Guide visibility is never exported.

---

# Snapping Settings

Examples:

```text
Snap To Guides

Snap To Objects

Snap To Sectors
```

Snapping belongs to Workspace State.

Snapping affects interaction.

Snapping does not affect project content.

---

# Undo Interaction

Editor State changes do not create undo entries.

Examples:

```text
Zoom

Pan

Selection

Tool Change

Guide Visibility

Snap Settings
```

These actions do not participate in command history.

---

# Visibility Model

Urania distinguishes between:

```text
Actual Visibility
```

and

```text
Drafting Visibility
```

---

## Actual Visibility

Project State.

Examples:

```text
Hide Ring

Hide Object

Hide Layer
```

Actual visibility:

* persists
* exports
* saves
* loads
* undoes

---

## Drafting Visibility

Editor State.

Examples:

```text
Focus Mode

Opacity Overrides

Temporary Inspection Modes
```

Drafting visibility affects only the editor view.

Drafting visibility never affects exports.

---

# Clipboard

Clipboard belongs to Workspace State.

Clipboard should persist across projects during the application session.

Example:

```text
Copy Object

Open Another Project

Paste Object
```

Valid workflow.

Clipboard contents are not saved inside project files.

---

# Panel State

Examples:

```text
Layers Open

Properties Open

Navigator Open
```

Panel configuration belongs to Workspace State.

Panel state may persist across sessions.

Panel state is never project data.

---

# Save And Load Behavior

Saving a project stores:

```text
Project State
```

only.

Saving a project does not store:

```text
Selection

Zoom

Pan

Focus Mode

Current Tool
```

or other editor state.

---

# Project Open Behavior

When opening a project:

Initialize:

```text
Select Tool

No Selection

Fit To View
```

and default editor state.

Load:

```text
Scene Graph

Visibility

Mechanism State

Tool Defaults

Export Settings
```

from the project.

---

# Future View Presets

The architecture should allow future support for:

```text
Artwork View

Alignment View

Window Layout View
```

These should remain editor-level concepts.

Not project-level geometry.

---

# Agent Directives

These directives are mandatory.

---

## Directive 1

Project State and Editor State must remain separate.

Never combine them.

---

## Directive 2

Use the project-sharing litmus test when uncertain.

If another user should receive the information, it belongs in Project State.

---

## Directive 3

Selection is Editor State.

Never Project State.

---

## Directive 4

Zoom and Pan are Editor State.

Never Project State.

---

## Directive 5

Visibility used for exports is Project State.

---

## Directive 6

Drafting visibility is Editor State.

---

## Directive 7

Editor State changes do not participate in undo history.

---

## Directive 8

Preview geometry is Editor State.

Never Scene Graph data.

---

## Directive 9

Projects must open with predictable default editor state.

---

## Directive 10

Project files must remain independent of temporary editing context.

A project file should describe the mechanism.

Not the editing session.

---

# Architectural Rule

Project State describes the mechanism.

Editor State describes the editing experience.

The two systems must remain independent.

Any implementation that mixes Project State and Editor State is architecturally incorrect.

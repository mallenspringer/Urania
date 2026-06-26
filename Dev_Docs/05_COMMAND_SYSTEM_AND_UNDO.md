# 05_COMMAND_SYSTEM_AND_UNDO.md

# Urania Command System and Undo Architecture

## Purpose

The Command System is the sole mechanism through which project data may be modified.

This document establishes strict architectural rules for all Urania applications.

These rules are mandatory.

The Command System exists to provide:

* Undo
* Redo
* Validation
* History
* Future scripting
* Future automation
* Future macros
* Predictable state management

---

# Core Principle

## Every Project Mutation Is A Command

All modifications to project data must occur through commands.

No exceptions.

Examples:

* Create Ring
* Delete Ring
* Rotate Ring
* Resize Sector
* Create Window
* Delete Object
* Move Object
* Import Image
* Change Text

All are commands.

---

# Architectural Rule

## Direct Scene Graph Mutation Is Forbidden

The following patterns are prohibited:

```typescript
ring.rotation = 45;
```

```typescript
sector.span = 20;
```

```typescript
project.rings.push(newRing);
```

```typescript
node.children.push(child);
```

Project data may only be changed through command execution.

---

# Required Mutation Path

```text
UI
    ↓
Command
    ↓
Validation
    ↓
Scene Graph Update
    ↓
History
    ↓
Render Update
```

All project modifications must follow this path.

---

# Responsibilities

## UI

Responsible for:

* collecting user intent
* presenting controls
* displaying results

UI components may not modify project data.

---

## Renderer

Responsible for:

* visualization
* hit testing
* display

Renderers may not modify project data.

---

## Mechanism Engine

Responsible for:

* calculations
* transforms
* visibility
* simulation

The Mechanism Engine may not modify project data.

---

## Command System

Responsible for:

* mutations
* validation
* history integration

Only the Command System may modify project data.

---

# Command Interface

All commands must implement:

```typescript
interface Command {
  execute(): void;

  undo(): void;

  getLabel(): string;
}
```

Future extensions may add:

```typescript
serialize()
```

but it is not required for MVP.

---

# Human-Readable Labels

Every command must expose a human-readable label.

Examples:

```text
Create Ring

Delete Ring

Rotate Ring

Resize Sector

Create Window

Import Image

Change Font Size
```

These labels should appear in undo history.

---

# Command Categories

## Structure Commands

Examples:

```text
Create Ring

Delete Ring

Create Sector

Delete Sector
```

---

## Geometry Commands

Examples:

```text
Move Object

Rotate Object

Scale Object

Resize Sector
```

---

## Mechanism Commands

Examples:

```text
Rotate Ring

Create Window

Modify Window
```

---

## Content Commands

Examples:

```text
Create Text

Edit Text

Import Image
```

---

## Pattern Commands

Examples:

```text
Create Pattern

Modify Pattern

Delete Pattern
```

---

# Undo Requirements

Every successful command must be undoable.

Every undoable command must implement:

```typescript
execute()
```

and

```typescript
undo()
```

Undo behavior should fully restore prior project state.

---

# Redo Requirements

Redo must replay the original command.

Redo should not execute alternate logic.

---

# History Size

Maximum undo history:

```text
100 Commands
```

When history exceeds this limit:

* oldest commands are discarded
* newest commands are retained

This limit should remain configurable.

---

# Command Granularity

Commands should reflect user intent.

Not implementation details.

---

## Correct

User creates a ring.

History:

```text
Create Ring
```

---

## Incorrect

History:

```text
Create Ring

Create Sectors

Rename Ring

Assign Radius
```

These implementation details should be contained within a single command.

---

# Multi-Object Operations

A single user action should produce a single command.

Example:

```text
Select 12 Labels

Change Font Size
```

History:

```text
Change Font Size
```

Not:

```text
Change Font Size
(Change repeated 12 times)
```

---

# Drag Operations

Continuous interaction should create a single command.

Example:

```text
Rotate Ring

0° → 87°
```

History:

```text
Rotate Ring
```

Not:

```text
Rotate Ring
Rotate Ring
Rotate Ring
Rotate Ring
...
```

---

# Slider Operations

Continuous slider movement should create a single command.

Example:

```text
Opacity

0 → 100
```

History:

```text
Change Opacity
```

Only one command should be recorded.

---

# Property Editing

Property edits should be grouped.

Example:

```text
Font Size

12 → 24
```

History:

```text
Change Font Size
```

Not one command per keystroke.

---

# Ring Rotation

Ring rotation is project state.

Not temporary editor state.

Example:

```text
Rotate Ring 2

45° → 120°
```

This operation must be undoable.

Reason:

Undo and redo act as mechanism comparison tools.

---

# Successful Commands

Only successful commands enter history.

Example:

```text
Import SVG
```

Success:

```text
Add To History
```

Failure:

```text
Do Not Add To History
```

---

# Validation

Commands are responsible for validation.

Validation occurs before mutation.

---

# Validation Philosophy

Most invalid states should be allowed temporarily.

Warnings are preferred over restrictions.

Example:

```text
Empty Window
```

may be intentional during design.

---

# Structural Validation

Certain invalid states must be prevented.

Examples:

```text
Negative Radius

Broken Hierarchy

Invalid Ring Geometry

Corrupted References
```

Commands creating structural corruption must fail.

---

# Automatic Corrections

Automatic corrections should be absorbed into the originating command.

Example:

User edits sectors.

Editor automatically rebalances angles.

History should display:

```text
Resize Sector
```

Not:

```text
Resize Sector

Auto Rebalance
```

Implementation details should remain invisible.

---

# Undo Boundaries

The following actions are NOT undoable.

---

## Selection Changes

Examples:

```text
Select Ring

Select Text

Select Window
```

Selection belongs to editor state.

Not project state.

---

## Viewport Changes

Examples:

```text
Zoom

Pan

Fit To Screen
```

Viewport belongs to editor state.

Not project state.

---

## Panel State

Examples:

```text
Open Panel

Close Panel

Collapse Section
```

UI state is not project state.

---

# Save Behavior

Saving a project does not create an undo command.

However, the history system should record save checkpoints.

Example:

```text
Rotate Ring

Create Window

----- Saved -----

Import Image
```

This improves user awareness.

---

# Project Boundaries

Loading a project creates a new history context.

Opening a project clears undo history.

---

# Template Boundaries

Templates are project creation events.

Example:

```text
Create Calendar Wheel
```

should create a new project.

Templates do not enter undo history.

Templates establish a new history boundary.

---

# Future Scriptability

Commands should be designed to support future automation.

The following style should be possible:

```typescript
project.execute(
  new CreateRingCommand(...)
);

project.execute(
  new RotateRingCommand(...)
);
```

This is not required for MVP implementation but should influence architecture.

---

# Future Macros

Commands should compose cleanly.

Future functionality may include:

```text
Create Calendar Wheel

Create Zodiac Wheel

Create Decoder Wheel
```

These should be implementable as collections of existing commands.

Avoid command architectures that prevent composition.

---

# Future Serialization

Commands should eventually support serialization.

Potential future uses:

* macros
* automation
* scripting
* replay
* diagnostics

MVP does not require persistence of command history.

The architecture should not prevent it.

---

# Testing Requirements

Every command should be independently testable.

Tests should verify:

```text
Execute

Undo

Redo

Validation

History Integration
```

Command testing should not require UI components.

---

# Agent Directives

These directives are mandatory.

---

## Directive 1

No direct scene graph mutation.

Ever.

---

## Directive 2

Every project mutation must be represented by a command.

No exceptions.

---

## Directive 3

UI components may not mutate project data.

---

## Directive 4

Renderers may not mutate project data.

---

## Directive 5

Mechanism engines may not mutate project data.

---

## Directive 6

Commands must represent user intent.

Not implementation details.

---

## Directive 7

Continuous interactions create one command.

Not many commands.

---

## Directive 8

Multi-object operations create one command.

Not many commands.

---

## Directive 9

Only successful commands enter history.

---

## Directive 10

Undo and redo correctness are more important than implementation convenience.

Do not introduce shortcuts that weaken command integrity.

---

# Architectural Rule

The Scene Graph is the source of truth.

The Command System is the only legal way to change that truth.

Any implementation that bypasses commands is considered architecturally incorrect.

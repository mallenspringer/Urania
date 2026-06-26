# 03_EDITOR_ARCHITECTURE.md

# Urania Editor Architecture

## Purpose

This document defines the internal architecture of the Urania editor.

It specifies:

* application structure
* state ownership
* rendering boundaries
* command architecture
* tool architecture
* runtime integration
* service organization

This document is the primary implementation reference for coding agents.

---

# Core Philosophy

Urania is a model-driven editor.

The project model is authoritative.

Everything else is derived.

```text
Project Model
    ↓
Application State
    ↓
Rendering
```

Renderers never own data.

UI never owns data.

Canvas never owns data.

---

# Architectural Principles

## Principle 1

The project model is the single source of truth.

---

## Principle 2

Rendering is disposable.

Any renderer must be able to reconstruct itself from project state.

---

## Principle 3

Editor and Runtime are separate execution environments consuming the same project model.

---

## Principle 4

Features own behavior.

Shared infrastructure owns coordination.

---

# Technology Stack

## Frontend Framework

React

---

## Rendering Layer

Konva

Canvas-based rendering.

---

## State Management

Zustand

Used for:

* project state
* selection state
* editor state
* runtime preview state

---

## Language

TypeScript

Strict mode enabled.

---

# Application Layers

```text
UI Layer
    ↓
Tool Layer
    ↓
Command Layer
    ↓
Project Model
    ↓
Renderer
```

---

# Project Model

## Authority

The project model owns:

* rings
* sectors
* layers
* elements
* transforms
* metadata

---

## Restrictions

Renderers may not mutate project data.

UI components may not mutate project data.

All mutations must flow through commands.

---

# State Architecture

## Global Stores

### Project Store

Owns:

```text
project
metadata
history
```

---

### Selection Store

Owns:

```text
selectedIds
hoveredIds
activeSelection
```

Single global selection model.

---

### Tool Store

Owns:

```text
activeTool
toolState
toolOptions
```

---

### View Store

Owns:

```text
zoom
pan
guideVisibility
snapSettings
```

---

### Runtime Preview Store

Owns:

```text
runtimeState
previewControls
simulationState
```

---

# Project Loading

## Strategy

Entire project loads into memory.

No lazy loading in MVP.

---

## Rationale

Project size constraints make full-memory loading practical.

Benefits:

* simpler architecture
* simpler undo
* simpler validation
* simpler runtime preview

---

# Command Architecture

## Purpose

All project modifications occur through commands.

Commands provide:

* undo
* redo
* validation checkpoints
* history tracking

---

# Command Structure

Each command implements:

```ts
execute()

undo()

redo()
```

---

# Command Examples

```text
CreateElementCommand

DeleteElementCommand

MoveElementCommand

RotateRingCommand

UpdatePropertyCommand

CreatePatternCommand
```

---

# Undo System

Undo history is command-based.

---

## Rule

One user interaction equals one history entry.

Examples:

```text
Drag Object
    = 1 Entry

Rotate Ring
    = 1 Entry

Resize Window
    = 1 Entry
```

---

# Tool Architecture

## Design Philosophy

Tools are registry-driven.

Tools are not hardcoded.

---

# Tool Registry

Each tool registers:

```text
id
name
icon
cursor
capabilities
handlers
```

---

## Tool Categories

### Selection Tools

```text
Select
Marquee Select
```

---

### Creation Tools

```text
Shape
Text
Image
Guide
```

---

### Transform Tools

```text
Move
Rotate
Ring Rotate
Scale
Radial Resize
Angular Resize
```

---

### Utility Tools

```text
Measure
Inspect
```

---

# Tool Ownership

Tools do not own project data.

Tools produce commands.

Commands mutate project data.

---

# Rendering Architecture

## Renderer Role

Renderer visualizes project state.

Renderer never owns project state.

---

# Konva Boundary

Konva is a rendering implementation.

Konva objects are disposable.

They must be reproducible from project data.

---

## Forbidden Pattern

```text
Mutate Konva Object
    →
Sync Back To Project
```

Never allowed.

---

## Required Pattern

```text
Mutate Project
    →
Re-render Konva
```

Always required.

---

# Runtime Preview Architecture

## Core Principle

Runtime preview uses the actual runtime engine.

Editor preview is not a simulation of runtime.

It is runtime.

---

# Preview Flow

```text
Project Model
    ↓
Runtime Adapter
    ↓
Runtime Instance
```

---

# Benefits

* export parity
* reduced bugs
* consistent interaction behavior
* simpler maintenance

---

# Pattern System Ownership

Patterns belong to the project model.

---

## Pattern Responsibilities

Pattern definitions own:

```text
source
rules
instances
metadata
```

---

## Renderer Responsibility

Renderer only visualizes pattern output.

---

# Validation Architecture

Validation operates as a service.

---

## Validation Triggers

### Continuous Validation

Lightweight checks.

Examples:

```text
invalid references
duplicate ids
missing parents
```

---

### On-Demand Validation

Full project scan.

Examples:

```text
export readiness
structural integrity
schema compliance
```

---

# Service Architecture

Feature-oriented organization.

---

# Directory Structure

```text
src/

features/

    project/

    selection/

    tools/

    transforms/

    patterns/

    runtime/

    validation/

    export/

    templates/

shared/

    ui/

    hooks/

    utils/

    types/
```

---

# Runtime Ownership

Runtime remains independent from editor UI.

---

## Runtime Responsibilities

```text
interaction

rotation

simulation

playback
```

---

## Editor Responsibilities

```text
editing

creation

inspection

configuration
```

---

# Autosave System

## Trigger Strategy

Command-count based.

---

## Default

Save snapshot every:

```text
100 commands
```

Configurable.

---

# Persistence Model

MVP persistence uses:

```text
project.json
```

as canonical storage.

---

# Plugin Readiness

MVP does not implement plugins.

Architecture must remain plugin-capable.

---

# Future Extension Targets

Support future registration of:

```text
Tools

Elements

Templates

Exporters

Validators

Mechanisms
```

without architectural refactoring.

---

# Runtime Separation

Editor state and runtime state must remain distinct.

---

## Editor State

```text
selection
tool state
view settings
draft actions
```

---

## Runtime State

```text
ring rotations
simulation state
animation state
playback state
```

---

# Error Handling

Errors must be isolated.

Feature failures should not crash the editor.

---

## Preferred Strategy

Feature-level boundaries.

Recovery where possible.

User-visible diagnostics when necessary.

---

# Testing Strategy

Each feature owns:

* unit tests
* command tests
* validation tests

---

## Required Coverage

Critical systems:

```text
commands
undo
runtime
export
validation
```

must maintain the highest coverage targets.

---

# Agent Directives

## Directive 1

Project model is authoritative.

---

## Directive 2

All mutations occur through commands.

---

## Directive 3

Konva is rendering-only.

---

## Directive 4

Tools generate commands.

Tools do not mutate state.

---

## Directive 5

Selection state is globally owned.

---

## Directive 6

Runtime preview uses the actual runtime engine.

---

## Directive 7

Feature-oriented architecture is required.

---

## Directive 8

Validation is both continuous and on-demand.

---

## Directive 9

Architecture must remain extensible for future mechanism types.

---

## Directive 10

Editor and runtime remain separate execution environments consuming the same model.

---

# Architectural Outcome

The Urania editor is a model-driven, command-oriented application with strict separation between data, behavior, rendering, and runtime execution.

This architecture enables parallel development by multiple coding agents while preserving long-term maintainability and supporting future mechanism families beyond volvelles.

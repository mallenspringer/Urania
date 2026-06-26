# 20_RUNTIME_GENERATOR.md

# Urania Runtime Generator

## Purpose

This document defines the architecture responsible for transforming Urania editor projects into self-contained interactive runtimes.

The runtime generator serves two distinct purposes:

1. Editor preview generation
2. Exported interactive project generation

The generated runtime must behave consistently across both contexts.

---

# Core Principle

## Single Runtime Engine

Editor preview and exported projects must use the same runtime engine.

```text
Editor Preview
    ↓
Runtime Engine

Exported Project
    ↓
Runtime Engine
```

No separate preview implementation is permitted.

No preview-specific rendering logic is permitted.

---

# Architectural Goals

The runtime system must:

* remain independent from editor UI
* support future mechanism families
* support future animation systems
* support future sharing systems
* support self-contained exports
* support mobile devices
* support touch interaction

---

# Runtime Architecture

```text
Project
    ↓
Runtime Generator
    ↓
Runtime Model
    ↓
Runtime Engine
    ↓
Interactive Experience
```

---

# Runtime Engine Structure

```text
Runtime Engine
    ↓
Mechanism Adapter
    ↓
Volvelle Adapter
```

Future:

```text
Runtime Engine
    ↓
Mechanism Adapter
        ↓
        Volvelle Adapter
        Carousel Adapter
        Tunnel Adapter
        Slide Chart Adapter
```

---

# Mechanism Dispatch

Every runtime model declares:

```json
{
  "mechanismType": "volvelle"
}
```

RuntimeEngine dispatches to the appropriate adapter.

---

# Runtime Generator Responsibilities

The generator transforms editor data into runtime-optimized data.

Responsibilities:

* flatten editor structures
* remove editor-only state
* generate runtime metadata
* generate interaction bindings
* generate runtime identifiers

---

# Runtime Philosophy

The runtime is a presentation environment.

It is not an editor.

It supports interaction.

It does not support authoring.

---

# Export Formats

MVP export targets:

```text
Interactive Runtime
PNG
SVG
```

Interactive runtime exports generate ZIP packages.

---

# Runtime Package Structure

Default export:

```text
project.zip

    index.html

    runtime.js

    styles.css

    runtime.json

    project.json
```

---

# Single File Export

Future-compatible architecture must support:

```text
single-file.html
```

containing:

* runtime
* styling
* runtime data

embedded into one file.

---

# Runtime Data Strategy

## Editor Model

Used exclusively by editor systems.

Contains:

* validation metadata
* editor state
* selection state
* drafting state
* undo information

---

## Runtime Model

Generated during export.

Contains only runtime-required data.

Example:

```text
Editor Project
    ↓
Runtime Generator
    ↓
Runtime Model
```

---

# Runtime Package Contents

## runtime.json

Primary runtime data source.

Contains:

* mechanism type
* ring definitions
* runtime geometry
* interaction metadata
* runtime configuration

---

## project.json

Included for:

* debugging
* future workflows
* inspection
* possible future re-import

Not used directly by runtime rendering.

---

# Rendering Technology

## Primary Renderer

SVG

---

# Rationale

SVG provides:

* resolution independence
* excellent print compatibility
* DOM interaction
* easy inspection
* accessibility advantages

---

# Canvas Usage

Canvas rendering is not used in MVP runtime generation.

---

# Runtime Controls

Runtime controls are export-configurable.

Supported modes:

```text
Ring Tabs Only

Ring Tabs + Control Panel
```

---

# Ring Controls

Runtime supports:

* drag rotation
* touch rotation
* direct manipulation

---

# Ring Labels

Ring identification is author-configurable.

Supported behaviors:

```text
Always Visible

Hover Visible

Hidden
```

---

# Runtime Interaction Model

Users may:

* rotate rings
* inspect content
* activate future interaction elements

Users may not:

* edit project structures
* create objects
* modify geometry

---

# Runtime State

Runtime state is distinct from authored project state.

---

## Authored State

Defined by project author.

Example:

```json
{
  "rotation": 0
}
```

Represents intended starting position.

---

## Current State

Represents current runtime interaction state.

Example:

```json
{
  "rotation": 135
}
```

---

# Runtime State Modes

## Mode A

Always Reset

```text
Page Load
    ↓
Authored State
```

---

## Mode B

Persist State

```text
Page Load
    ↓
Restore Saved State
```

---

## Mode C

Persist + Reset

```text
Page Load
    ↓
Restore Saved State

Reset
    ↓
Authored State
```

---

# Default Runtime State Mode

Default:

```text
Persist + Reset
```

---

# State Storage

Persistence uses:

```text
localStorage
```

No server dependency required.

---

# Reset Behavior

Reset always returns runtime to authored state.

Never to most recent saved state.

---

# Runtime Sharing Infrastructure

Runtime engine must support state serialization.

---

## Purpose

Future support for:

* shared alignments
* puzzle states
* bookmarks
* teaching references
* animation states

---

# MVP Sharing Behavior

No visible sharing UI required.

Infrastructure required.

---

# Runtime API

Runtime exports expose a minimal public API.

---

## Required Functions

```javascript
setRingRotation()

getRingRotation()

reset()
```

---

# API Philosophy

Small, stable API.

No editor functionality exposed.

---

# Runtime Accessibility

Minimum support:

```text
Tab

Enter

Arrow Keys
```

---

# Accessibility Goals

Runtime should remain usable without pointer devices.

---

# Mobile Support

Required.

Runtime must support:

* phones
* tablets
* touchscreens

---

# Interaction Methods

Supported:

```text
Mouse

Touch

Keyboard
```

---

# Runtime Zoom

Supported.

---

# Scope

Basic zoom only.

Not equivalent to editor zoom systems.

---

# Runtime Information Overlay

Optional.

May display:

```text
Title

Description
```

No detailed metadata panel required.

---

# Runtime Theming

Runtime appearance is project-controlled.

---

## Examples

```text
Light

Dark

Custom
```

---

# Runtime Configuration

Runtime export configuration may include:

```text
Theme

Persistence Mode

Control Style

Overlay Visibility
```

---

# Animation Infrastructure

Runtime model reserves animation support.

Example:

```json
{
  "animations": []
}
```

---

# MVP Behavior

Animation array remains unused.

---

# Future Uses

```text
Auto Rotation

Timed Motion

Gear Systems

Linked Motion

Playback Controls
```

---

# Runtime Assets

Supports:

```text
Embedded Assets

External Assets
```

Export workflow determines packaging strategy.

---

# Runtime Validation

Generator validates:

* runtime model structure
* mechanism compatibility
* asset references
* interaction bindings

before export.

---

# Runtime Error Handling

Invalid runtime generation must fail gracefully.

Generator produces:

* error descriptions
* warning messages
* export blocking status

---

# Runtime Security

Exported runtimes must:

* avoid remote dependencies
* avoid network requirements
* operate offline

by default.

---

# Performance Targets

Target devices:

```text
Desktop

Tablet

Modern Mobile
```

---

# Runtime Independence

Runtime packages must function without:

* Urania editor
* Urania services
* internet access

---

# Agent Directives

## Directive 1

Editor preview and exported runtime must share the same runtime engine.

---

## Directive 2

Runtime model and editor model must remain separate.

---

## Directive 3

Runtime architecture must dispatch through mechanism adapters.

---

## Directive 4

Volvelle is the first adapter, not a special case.

---

## Directive 5

Runtime exports must remain self-contained.

---

## Directive 6

SVG is the authoritative runtime rendering technology.

---

## Directive 7

Runtime state persistence and authored state must remain separate concepts.

---

## Directive 8

Runtime API must remain intentionally small.

---

## Directive 9

Animation infrastructure must exist in MVP data structures.

---

## Directive 10

Runtime architecture must support future mechanism families without requiring refactoring.

---

# Architectural Outcome

The Urania Runtime Generator converts editor-authored projects into portable, self-contained interactive experiences using a shared runtime engine and mechanism adapter architecture. The resulting system supports current volvelle projects while providing a stable foundation for future paper-engineering mechanisms, animation systems, sharing workflows, and embedded web experiences.

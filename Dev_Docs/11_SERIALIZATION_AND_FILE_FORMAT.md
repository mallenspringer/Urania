# 11_SERIALIZATION_AND_FILE_FORMAT.md

# Urania Serialization & File Format

## Purpose

Defines how Urania projects are stored, loaded, versioned, and migrated.

Serialization is responsible for representing:

- Scene Graph
- Mechanism State
- Properties
- Visibility
- Export Configuration
- Assets

Serialization explicitly excludes all Editor State.

---

# Core Philosophy

A Urania file describes a mechanism, not an editing session.

A valid project file must be usable by any compatible editor instance without reconstructing prior UI state.

---

# File Format

## Container

Urania uses a ZIP-based container format.

Example:

```text
project.urania
```

Internally:

```text
project.json
/assets/...
```

Rationale:

- supports embedded assets
- supports future expansion
- allows compression
- keeps a single user-facing file

---

# File Extension

All project files use:

```text
.urania
```

---

# Primary Data Format

Project metadata and scene graph are stored in JSON.

JSON must be:

- deterministic
- stable ordering preferred
- versioned
- human-readable

---

# Versioning

Each file must declare:

```json
{
  "format": "urania",
  "version": "1.0.0",
  "mechanismType": "volvelle"
}
```

Version is required for all files.

---

# Mechanism Type

Each project declares its mechanism domain.

Examples:

- volvelle
- tunnel_book (future)
- carousel_book (future)
- slide_chart (future)

This enables shared infrastructure across multiple applications.

---

# Scene Graph Storage

The Scene Graph is serialized as a hierarchical structure:

- Rings
- Sectors
- Objects
- Guides

Hierarchy must be preserved exactly as authored.

---

# Entity Identity

All scene graph entities must use stable UUIDs.

Examples:

- Ring
- Sector
- Shape
- Text
- Image
- Guide

UUIDs must remain stable across save/load cycles.

---

# Project State Inclusion

Serialized project data includes:

## Included

- Geometry
- Ring rotation
- Sector definitions
- Object placement
- Visibility states
- Lock states
- Tool defaults
- Export settings

## Excluded

- Selection state
- Zoom
- Pan
- Active tool
- Hover state
- UI layout
- Panel state
- Undo history

---

# Asset System

## Embedded Assets Only

All external assets must be embedded in the project.

No external file references are allowed.

---

## Asset Storage Structure

Assets are stored in:

```text
/assets/
```

Each asset has a UUID reference.

---

## Asset Representation

Assets are stored in two forms when applicable:

1. Original source data (e.g. SVG string)
2. Parsed internal representation

This ensures forward compatibility and re-import fidelity.

---

## Asset Deduplication

Identical assets must be stored once and referenced by UUID.

---

# Pattern Instances

Generated pattern instances are NOT serialized.

Only source definitions are stored.

Pattern instances are always derived at runtime.

---

# Undo History

Undo/redo history is never persisted.

Each session begins with a clean history stack.

---

# Clipboard

Clipboard state is never persisted.

---

# Determinism

Serialization must be deterministic.

Repeated saves of identical state must produce identical output.

---

# Save Scope

Only Project State is serialized.

Editor State is explicitly excluded.

---

# Unknown Data Handling

Unknown fields must be preserved.

Forward compatibility rule:

- Do not discard unknown properties
- Store them verbatim
- Re-emit them on save

---

# Migration System

Files must support schema migration:

- On load: upgrade older versions
- On save: write current version only

Migration must be automatic and silent unless failure occurs.

---

# Compatibility Rules

## Forward Compatibility

Newer versions may introduce unknown fields.

Old versions must preserve unknown data.

---

## Backward Compatibility

Older versions may lack support for new features.

Editor must degrade gracefully.

---

# Load Behavior

On loading a project:

- Validate structure
- Repair minor inconsistencies if safe
- Warn on unrecoverable issues
- Never silently corrupt data

---

# Validation Strategy

Validation occurs during load:

- Geometry validation
- Reference integrity checks
- Asset existence checks
- Structural correctness checks

---

# Error Handling

If errors occur:

- Load partial project if possible
- Preserve recoverable data
- Surface warnings to user
- Avoid destructive auto-fixes unless explicitly safe

---

# Export Metadata

Projects may store last-used export settings:

- SVG export configuration
- Cut/fold separation settings
- Canvas size preferences

Export metadata is part of Project State.

---

# Deterministic Output Requirement

Saving the same project twice must produce identical output.

This is required for:

- testing
- diffing
- version control
- reproducibility

---

# Template System

Templates are identical to project files.

No separate format exists.

---

# Cross-Application Compatibility

Urania project structure must support future mechanism applications:

- Volvelle (current)
- Tunnel books (future)
- Carousel books (future)
- Slide charts (future)

Shared schema evolution is required.

---

# External Asset Policy

External file references are not allowed.

All assets must be embedded within the project file.

---

# Validation on Load

Invalid projects must:

- load in degraded mode if possible
- never silently corrupt state
- preserve recoverable data
- surface warnings

---

# Agent Directives

## Directive 1

Project files describe mechanism state only.

---

## Directive 2

Editor state must never be serialized.

---

## Directive 3

All entities must use stable UUIDs.

---

## Directive 4

Assets must be embedded and deduplicated.

---

## Directive 5

Pattern instances must never be serialized.

---

## Directive 6

Unknown fields must be preserved.

---

## Directive 7

Serialization must be deterministic.

---

## Directive 8

Migration must be automatic and version-driven.

---

## Directive 9

Mechanism type must be explicitly declared.

---

## Directive 10

All valid projects must remain portable across compatible editor instances.

---

# Architectural Rule

A Urania file is a portable description of a mechanism.

It is not a record of how the mechanism was edited.
# 17_EXPORT_PIPELINE.md

# Urania Export Pipeline

## Purpose

This document defines how Urania projects are transformed into external outputs.

The export system supports two primary targets:

1. Physical Craft Outputs
2. Interactive Runtime Outputs

All exports originate from the same project graph and runtime model.

Export is deterministic.

No export process should reinterpret project meaning.

---

# Core Philosophy

```text
Project Model
    ↓
Runtime Model
    ↓
Export Preset
    ↓
Renderer
    ↓
Output Files
```

Exporters consume the runtime model.

Exporters do not inspect editor-specific state.

---

# Export Design Principles

## Principle 1

Exports are generated from a shared pipeline.

Physical and runtime exports are not separate systems.

They are separate renderers operating on a common model.

---

## Principle 2

Exports must preserve semantic meaning.

A ring remains a ring.

A sector remains a sector.

A pattern remains a pattern.

No export may silently alter structure.

---

## Principle 3

Exports must be reproducible.

Identical project state must always produce identical output.

---

# Export Presets

Export presets define output intent.

Presets select renderers and file generation rules.

---

## Preset: Physical Craft

Purpose:

* printing
* cutting
* assembly
* Cricut workflows
* Silhouette workflows
* Glowforge workflows
* manual construction

Outputs may include:

* artwork SVG
* cut SVG
* fold SVG
* PNG previews

---

## Preset: Interactive Web

Purpose:

* browser viewing
* educational tools
* digital volvelles
* embedded experiences

Outputs may include:

* HTML
* CSS
* JavaScript
* project data

---

## Preset: Embeddable Widget (Post-MVP)

Purpose:

* blogs
* websites
* CMS systems
* educational content

Outputs may include:

* snippets
* assets
* runtime package

---

# Physical Export System

## Supported Formats

### SVG

Primary format.

Used for:

* cutting
* printing
* fabrication workflows

---

### PNG

Raster preview format.

Used for:

* mockups
* sharing
* documentation

---

### PDF (Future)

Reserved for later implementation.

---

# SVG Export Rules

## Geometry Preservation

Vector geometry must remain vector geometry.

No unnecessary rasterization.

---

## Coordinate Accuracy

Exported geometry must match editor geometry exactly.

No simplification unless explicitly requested.

---

## Layer Preservation

SVG exports support:

* artwork layers
* cut layers
* fold layers

---

# Multi-Layer Export Modes

## Mode A

Separate files.

Example:

```text
artwork.svg
cut.svg
fold.svg
```

---

## Mode B

Single SVG with grouped layers.

Example:

```text
Artwork Layer
Cut Layer
Fold Layer
```

---

## Mode C

User-selectable.

MVP default.

---

# Ring Export Modes

## Entire Project Export

Exports all rings.

Used for complete assembly.

---

## Per-Ring Export

Exports selected rings individually.

Used for staged fabrication workflows.

---

## User-Selectable

Both modes must be supported.

---

# Registration Marks

Registration marks assist assembly.

---

## Included Marks

### Center Registration

Brad-hole reference.

---

### Radial Alignment Ticks

Optional.

Examples:

```text
0°
90°
180°
270°
```

Used for alignment verification.

---

## Advanced Registration Systems

Professional print registration systems are outside MVP scope.

---

# Hole Export Behavior

Brad holes are explicit project elements.

Export system may treat them specially.

Purpose:

* cutter compatibility
* fabrication optimization
* assembly support

---

## Runtime Exception

Web runtime exports may allow:

```text
holeDiameter = 0
```

while preserving attachment semantics.

---

# Text Export System

## Export Modes

### Preserve Text

Text remains editable text.

---

### Convert To Paths

Text becomes vector geometry.

---

### User Selectable

MVP default.

---

# Image Export System

## Embedded Mode

Images stored directly in output.

Example:

```text
base64
```

---

## External Asset Mode

Images exported as separate files.

---

## User Selectable

MVP default.

---

# Pattern Export System

## Physical Export

Patterns are expanded into final geometry.

All repeated elements become explicit geometry.

---

## Runtime Export

Patterns remain procedural where possible.

Pattern definitions may be preserved.

---

# Runtime Export System

## Supported Targets

### Self-Contained Runtime

Single HTML file.

Contains:

* HTML
* CSS
* JavaScript
* project data

---

### Developer Runtime Bundle

Multiple files.

Example:

```text
index.html
style.css
app.js
project.json
```

---

## Export Dialog

Users choose:

```text
Self-Contained HTML
Developer Bundle
```

Both modes are supported.

---

# Runtime Data Architecture

Runtime exports use a hybrid model.

---

## Visual Layer

SVG-based.

Contains:

* artwork
* geometry
* visual presentation

---

## Behavioral Layer

JSON-based.

Contains:

* rings
* sectors
* metadata
* interaction definitions
* runtime state

---

# Runtime Renderer

## Primary Renderer

SVG.

Reasons:

* fidelity
* inspectability
* editability
* accessibility

---

## Canvas Renderer

Reserved for future optimization scenarios.

Not MVP.

---

# Runtime Interaction

Exported runtimes support:

* ring rotation
* interactive viewing
* user manipulation

Exported runtimes do not support editor functionality.

---

# Runtime UI Modes

## Bare Mechanism

Only the volvelle.

---

## Mechanism With Controls

Includes:

* reset controls
* rotation controls
* interaction helpers

---

## User Selectable

MVP default.

---

# Runtime State Persistence

MVP behavior:

No persistence.

Opening a runtime starts from initial project state.

---

# Future Runtime Extensions

Reserved metadata support for:

* autoplay
* timelines
* scripted rotation
* interaction sequences
* educational demonstrations

Infrastructure should exist in exported data structures.

Implementation is post-MVP.

---

# Export Manifest

Every export generates a manifest.

---

## manifest.json

Contains:

```text
projectId
projectVersion
exportVersion
exportDate
ringMetadata
sectorMetadata
exportPreset
```

---

## Purpose

Provides:

* compatibility tracking
* migration support
* future import capability
* debugging information

---

# Validation Phase

All exports pass validation before generation.

Checks include:

* missing references
* invalid geometry
* duplicate identifiers
* unsupported export states

---

# Export Failure Policy

Export failures must:

* identify exact cause
* identify affected object
* provide recovery guidance

Exports must never fail silently.

---

# Asset Packaging

Exports are packaged according to preset.

---

## Physical Preset

May generate:

```text
project_export.zip
```

containing fabrication assets.

---

## Runtime Preset

May generate:

```text
runtime_export.zip
```

containing runtime assets.

---

# Future Export Targets

Reserved for:

* tunnel books
* carousel books
* slide charts
* educational widgets
* hosted publishing system

Export architecture must remain content-type agnostic.

---

# Agent Directives

## Directive 1

All exports originate from the runtime model.

---

## Directive 2

Physical and runtime exports share a common export pipeline.

---

## Directive 3

Export presets determine renderer selection.

---

## Directive 4

SVG is the primary visual export format.

---

## Directive 5

Runtime exports use SVG + JSON hybrid architecture.

---

## Directive 6

Every export generates a manifest.

---

## Directive 7

Exports must preserve project semantics.

---

## Directive 8

Export validation is mandatory.

---

## Directive 9

Exporters must be extensible for future mechanism types.

---

# Architectural Outcome

The export system transforms Urania from an editor into a publishing platform.

The editor, runtime, and export systems now share a single model architecture, allowing future mechanism types to inherit the same export infrastructure with minimal modification.

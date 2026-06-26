# 00_PROJECT_OVERVIEW.md

# Urania

## Project Overview

### Working Name

Urania

Named after the muse of astronomy and celestial mapping, reflecting the application's focus on circular information design, volvelles, star charts, decoder wheels, rotating reference systems, and other interactive paper mechanisms.

---

# Vision

Urania is a browser-based design environment for creating circular paper mechanisms and interactive rotational information systems.

The primary MVP focus is volvelles: multi-layer rotating disc systems composed of rings, sectors, windows, artwork, text, guides, and rotational relationships.

The long-term vision is a generalized paper-mechanism design platform supporting additional mechanism families through a shared architecture.

Examples include:

* Volvelles
* Zodiac Wheels
* Decoder Wheels
* Educational Wheels
* Rotating Reference Charts
* Carousel Books
* Tunnel Books
* Slide Charts
* Additional paper-engineering mechanisms

---

# Product Philosophy

Urania is not a CAD application.

Urania is not a vector illustration application.

Urania is a specialized mechanism design tool.

The editor prioritizes:

* direct manipulation
* immediate visual feedback
* low-friction experimentation
* approachable workflows
* precise output generation

The target user should be able to create a functioning project through exploration and intuition rather than extensive training.

At the same time, advanced users should have access to powerful alignment, snapping, validation, export, and drafting tools.

---

# MVP Scope

The MVP focuses on designing and exporting rotational disc-based mechanisms.

Core capabilities include:

* multi-ring projects
* sector-based ring layouts
* rotational drafting
* layered artwork
* window creation
* text placement
* image placement
* guide systems
* snapping systems
* validation systems
* print-ready exports
* interactive runtime exports

The MVP is intentionally offline-first and self-contained.

No user accounts are required.

No cloud services are required.

No server infrastructure is required.

---

# Core Architectural Principle

The project uses a mechanism-oriented architecture.

All projects declare a mechanism type.

Example:

```json
{
  "mechanismType": "volvelle"
}
```

The MVP includes only the Volvelle mechanism family.

Future mechanism types must integrate without requiring architectural redesign.

---

# Primary User Workflow

```text
Create Project
    ↓
Choose Template
    ↓
Design Mechanism
    ↓
Validate Project
    ↓
Preview Runtime
    ↓
Export
```

The editor exists primarily to support this workflow.

---

# Technology Stack

## Application Model

Single-page web application.

---

## Rendering

Konva.js

Canvas-based editor rendering.

---

## Runtime Export

SVG-based runtime rendering.

---

## Deployment

Static hosting compatible.

No server dependency.

---

# Workspace Philosophy

The canvas is the primary editing surface.

Most operations should be available through direct interaction.

Panels exist to provide:

* navigation
* organization
* precision editing
* validation
* configuration

Users should spend most of their time interacting with the canvas rather than menus.

---

# Editor Layout

```text
Top Toolbar

Left Sidebar
    Project Structure

Canvas Workspace
    Primary Editing Surface

Right Sidebar
    Inspector / Properties

Bottom Status Bar
```

This layout remains consistent throughout the application.

---

# Editing Modes

Urania supports two primary editing modes.

## Object Mode

Used for:

* text
* artwork
* images
* windows
* guides
* standard elements

---

## Slice Mode

Used for:

* sector-aware editing
* sector-level operations
* rotational structure workflows

Mode switching is intentionally prominent and always visible.

---

# Core Data Model

Hierarchy:

```text
Project

    Rings

        Layers

            Elements
```

---

# Ring-Centric Design

Rings are first-class objects.

Users may:

* rotate rings
* hide rings
* lock rings
* adjust drafting opacity
* reorder rings
* configure sectors

The ring is the primary organizational and interaction unit.

---

# Drafting Philosophy

Persistent visual comparison is a foundational feature.

Users must be able to:

* compare rings while editing
* inspect windows dynamically
* evaluate alignment continuously
* rotate neighboring rings during drafting

The editor should minimize workflow interruptions and mode switching.

---

# Direct Manipulation Philosophy

Whenever practical:

* click instead of dialog
* drag instead of typing
* preview instead of confirm

Numeric controls remain available for precision workflows.

Both interaction styles must coexist.

---

# Selection Philosophy

Selection behavior should remain predictable and visually clear.

The system supports:

* single selection
* multi-selection
* marquee selection
* hierarchy-aware selection
* modifier-assisted selection

Selection complexity must not create visual clutter.

---

# Transform Philosophy

Transforms are a primary workflow.

Supported operations include:

* move
* rotate
* scale
* radial resize
* angular resize

Transforms should feel immediate and visual.

Property panels provide precision editing when needed.

---

# Guides and Snapping

Guides are core drafting tools.

Supported guide types include:

* radial guides
* concentric guides
* custom guides

Snapping assists users but never overrides user intent.

Validation may recommend corrections.

Validation does not automatically modify project data.

---

# Validation Philosophy

Validation is advisory.

Validation may:

* detect issues
* explain issues
* recommend fixes

Validation may not:

* silently alter projects
* automatically repair geometry without user approval

Users remain in control of all project decisions.

---

# Template Philosophy

Templates are projects.

A template is not a separate document type.

```text
Template
=
Project
+
Manifest
```

Templates provide starting structures and examples.

They are not procedural generators.

---

# Runtime Philosophy

The editor and exported projects share the same runtime engine.

```text
Editor Preview
    ↓
Runtime Engine

Exported Runtime
    ↓
Runtime Engine
```

No separate preview implementation is permitted.

This guarantees preview/export consistency.

---

# Export Philosophy

Exports are first-class outputs.

Supported MVP exports:

* SVG
* PNG
* Interactive Runtime Package

The application exists to generate usable outputs.

Export workflows must remain visible and accessible.

---

# Runtime Packages

Interactive exports are self-contained.

No external services required.

No CDN dependencies required.

No internet connection required.

Runtime packages remain portable and archivable.

---

# Future Animation Support

Animation is not part of MVP functionality.

However, runtime architecture must reserve infrastructure for:

* automatic rotation
* linked motion
* playback systems
* gear systems
* scripted behaviors

Future animation support must not require redesigning the runtime architecture.

---

# Future Mechanism Support

The architecture is intentionally mechanism-agnostic.

Future adapters may include:

```text
Volvelle

Carousel Book

Tunnel Book

Slide Chart
```

The MVP implements only the Volvelle adapter.

The architecture must support future mechanism families through shared interfaces.

---

# Non-Goals (MVP)

The MVP intentionally excludes:

* user accounts
* cloud storage
* collaboration
* marketplace features
* plugin systems
* AI-assisted design
* automated content generation
* procedural template generators

These may be explored after MVP completion.

---

# Success Criteria

The MVP is successful when a user can:

1. Create a multi-ring project.
2. Design and align rotational content.
3. Preview behavior interactively.
4. Export printable assets.
5. Export an interactive runtime.
6. Complete the workflow without external software.

---

# Guiding Principle

Urania should feel less like operating software and more like manipulating a physical paper mechanism before it exists.

Every architectural, UX, and implementation decision should be evaluated against that goal.

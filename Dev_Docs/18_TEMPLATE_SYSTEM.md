# 18_TEMPLATE_SYSTEM.md

# Urania Template System

## Purpose

This document defines the template architecture for Urania.

Templates provide starting points for new projects while remaining fully compatible with the standard project model.

Templates are intentionally lightweight.

In MVP, templates are not generators, wizards, or procedural systems.

Templates are preconfigured Urania projects accompanied by metadata.

---

# Core Philosophy

Templates are projects.

A template is not a separate document type.

A template is a normal Urania project that has been designated as reusable.

```text
Template
    =
Project
    +
Template Manifest
```

This allows the editor to treat templates and projects as fundamentally compatible objects.

---

# Design Principles

## Principle 1

Templates must use the standard project schema.

No dedicated template schema is permitted in MVP.

---

## Principle 2

Loading a template creates a new project.

The original template is never modified.

---

## Principle 3

Templates should encourage user creativity rather than automate design decisions.

Templates provide starting structures.

Users provide content.

---

## Principle 4

Template architecture must support future expansion without requiring a redesign.

---

# Template Architecture

Each template consists of:

```text
template/

    template.json

    manifest.json

    thumbnail.png
```

---

# Template Components

## template.json

A valid Urania project.

Contains:

* rings
* sectors
* layers
* elements
* defaults
* metadata

The editor must be capable of opening a template project exactly as it opens a normal project.

---

## manifest.json

Contains template metadata.

Used by:

* template picker
* categorization
* version tracking
* future template systems

---

## thumbnail.png

Visual preview displayed in template selection UI.

---

# Template Loading Workflow

```text
User
    ↓
New Project
    ↓
Template Picker
    ↓
Select Template
    ↓
Clone Template Project
    ↓
Assign New Project ID
    ↓
Open Editor
```

---

# Template Isolation

Template files are never modified during editing.

Editing always occurs on the newly created project.

---

# MVP Template Library

Initial template set:

```text
Blank

Zodiac Wheel

Decoder Wheel

Game Wheel
```

---

# Blank Template

Blank is the default template.

Blank appears first in the template picker.

---

## Blank Template Structure

Contains:

```text
1 Ring

Default Layer Structure

Default Project Settings
```

Contains no artwork.

Contains no instructional content.

---

# Demonstration Templates

Example templates may include:

* artwork
* labels
* decorative elements
* completed examples

Purpose:

* demonstrate features
* demonstrate workflows
* showcase capabilities

---

# Working Templates

Working templates focus on structure.

Purpose:

* provide useful starting configurations
* accelerate design work
* encourage customization

Typical contents:

```text
Ring Structure

Sector Configuration

Guide Elements

Basic Labels
```

---

# Template Categories

MVP categories:

```text
Blank

Examples

Utilities

Games
```

Categories are organizational only.

They do not affect project behavior.

---

# Template Metadata

## Required Fields

```json
{
  "id": "",
  "name": "",
  "description": "",
  "version": 1,
  "mechanismType": "",
  "thumbnail": ""
}
```

---

# Recommended Fields

```json
{
  "author": "",
  "createdDate": "",
  "updatedDate": "",
  "tags": []
}
```

---

# Mechanism Awareness

Every template must declare:

```json
{
  "mechanismType": "volvelle"
}
```

---

## Future Values

Examples:

```text
volvelle

carousel_book

tunnel_book

slide_chart
```

The template system must remain mechanism-agnostic.

---

# Template Versioning

Templates maintain independent versions.

Example:

```text
Decoder Wheel
Version 1

Decoder Wheel
Version 2
```

---

# Project Origin Tracking

Projects created from templates record:

```json
{
  "originTemplateId": "",
  "originTemplateVersion": 1
}
```

---

## Purpose

Supports:

* debugging
* migration
* analytics
* future update workflows

---

# Default Values

Templates may define:

```text
Default Ring Count

Default Sector Count

Default Guides

Default Visibility Settings
```

---

## Rule

Defaults are not constraints.

Users may modify them immediately.

---

# Template Preview UI

Each template displays:

```text
Thumbnail

Title

Short Description
```

---

## Excluded From MVP

No advanced metadata panels.

No detailed configuration dialogs.

No multi-step selection process.

---

# New Project Workflow

```text
New Project
    ↓
Template Picker
    ↓
Create Project
```

Template selection and project creation occur within a single workflow.

---

# Save As Template

Not required in MVP.

Architecture must support future implementation.

---

## Future Workflow

```text
Open Project
    ↓
Save As Template
    ↓
Generate Manifest
    ↓
Generate Thumbnail
    ↓
Store Template
```

---

# User Templates

Architecture must support future user-created templates.

Future sources may include:

```text
Local Templates

Imported Templates

Shared Templates
```

---

# Future Template Features

Reserved for post-MVP development.

Examples:

```text
Template Wizards

Parameterized Templates

Template Generators

Guided Setup Flows
```

---

# Template Extensibility

Manifest reserves a future extension section.

Example:

```json
{
  "templateFeatures": {}
}
```

---

## MVP Usage

Empty object.

---

## Future Usage

May contain:

```json
{
  "wizard": true,
  "generator": "decoderGenerator"
}
```

or similar feature declarations.

---

# Validation Rules

Template validation includes:

* valid project schema
* valid manifest schema
* valid thumbnail reference
* valid mechanism type
* valid version information

---

# Import Rules

Template import uses existing project import systems wherever possible.

Avoid creating parallel import pipelines.

---

# Export Rules

Templates are not export targets.

Templates generate projects.

Projects generate exports.

---

# Storage Strategy

Templates remain independent assets.

Templates are not embedded into created projects.

Projects only retain origin metadata.

---

# Agent Directives

## Directive 1

Templates must use the standard Urania project schema.

---

## Directive 2

No dedicated template schema is permitted in MVP.

---

## Directive 3

Template loading creates a new project instance.

---

## Directive 4

Templates are never edited directly.

---

## Directive 5

All templates must declare mechanism type.

---

## Directive 6

Template metadata must support future expansion.

---

## Directive 7

Defaults are not constraints.

---

## Directive 8

Template selection must remain simple and lightweight.

---

## Directive 9

Architecture must support future user-created templates.

---

## Directive 10

Template infrastructure must remain compatible with future mechanism families.

---

# Architectural Outcome

The Urania Template System provides lightweight, project-based starting points while preserving a single project model across the entire application.

This approach minimizes complexity in MVP while establishing a foundation that can support future generators, wizards, user templates, and additional paper-engineering mechanism types without architectural refactoring.

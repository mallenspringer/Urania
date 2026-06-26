# 12_VALIDATION_SYSTEM.md

# Urania Validation System

## Purpose

The Validation System is responsible for:

* maintaining project integrity
* preventing invalid project state
* protecting user data
* detecting fabrication issues
* supporting migration and recovery

Validation exists to prevent corruption, not to restrict creativity.

---

# Core Philosophy

Urania follows three principles:

```text
Prevent Corruption
Allow Experimentation
Warn About Fabrication Risks
```

The validator should never reject a design merely because it is unusual.

The validator should reject data only when it would create invalid project state.

---

# Validation Scope

Validation operates at three levels:

```text
Object
Ring
Project
```

All three levels are required.

---

# Object Validation

Examples:

* shape geometry
* text properties
* image references
* window definitions
* pattern settings

---

# Ring Validation

Examples:

* ring dimensions
* sector definitions
* rotation constraints
* ring-specific mechanism rules

---

# Project Validation

Examples:

* UUID uniqueness
* reference integrity
* asset integrity
* serialization correctness
* export readiness

---

# Validation Timing

Validation occurs during:

```text
Command Execution
Project Load
Project Save
Export Generation
Migration
```

Validation must be integrated throughout the application lifecycle.

---

# Validation Severity Levels

Every validation issue must have a severity.

## Error

Project state is invalid.

Examples:

* negative radius
* duplicate UUID
* invalid geometry definition

Errors may block export.

---

## Warning

Project state is valid but potentially problematic.

Examples:

* ring overlap
* tiny fabrication features
* self-intersecting paths

Warnings never block editing.

---

## Info

Informational observations.

Examples:

* export recommendations
* fabrication suggestions

Informational messages never block operations.

---

# Validation Issue Model

Validation results must be represented as structured objects.

Example:

```typescript
interface ValidationIssue {
    id: string;
    severity: "error" | "warning" | "info";
    code: string;
    message: string;
    entityId?: string;
}
```

Validation systems must not rely on plain strings.

---

# Validation Repair Philosophy

Validation may detect freely.

Validation may repair conservatively.

Validation must never guess.

---

# Three Validation Outcomes

Validation actions fall into three categories:

```text
Validate
Repair
Recover
```

---

## Validate

Issue is detected.

No modification occurs.

Examples:

* negative radius
* invalid property value
* self-intersection warning

---

## Repair

Single deterministic correction exists.

System may repair automatically.

Examples:

* duplicate UUID
* stale cache data
* derived pattern regeneration

Repair must be:

* deterministic
* reversible
* logged

---

## Recover

Project data is damaged.

Multiple possible repairs exist.

System preserves data without guessing.

Examples:

* missing references
* missing assets
* orphaned entities

Recovery prioritizes data preservation.

---

# Validation Repair Rule

Validators should prefer:

```text
Detect
→
Report
```

over:

```text
Detect
→
Modify
```

Automatic modification is allowed only when a single deterministic correction exists.

If multiple plausible corrections exist:

* preserve data
* quarantine invalid entities
* notify the user

Never guess.

Preserving user work is more important than restoring perfect structure.

---

# Geometry Validation

Geometry validation ensures mathematical correctness.

Examples:

* positive radii
* valid dimensions
* finite values
* valid angles

---

# Ring Radius Rules

The following are invalid:

```text
Negative Radius
Outer Radius < Inner Radius
Outer Radius == Inner Radius
```

These conditions produce validation errors.

Commands creating these states must be rejected.

---

# Ring Overlap

Example:

```text
Ring A
overlaps
Ring B
```

Overlap is allowed.

Overlap generates a warning.

Overlap does not block editing or export.

---

# Object Bounds

Objects may extend beyond:

* ring boundaries
* sector boundaries

This behavior is allowed.

No validation error is generated.

No warning is required.

---

# Window Bounds

Windows may cross sector boundaries.

This behavior is allowed.

No warning is required.

No automatic correction is performed.

---

# Self-Intersecting Geometry

Self-intersecting paths are allowed.

Examples:

* figure-eight shapes
* overlapping custom paths

Generate a warning.

Do not reject.

Do not modify.

---

# Sector Validation

Sector count minimum:

```text
1
```

Single-sector rings are valid.

---

# Future Sector Rules

Future support for variable-width sectors must satisfy:

```text
Sum of sector proportions = 100%
```

within numerical tolerance.

---

# Pattern Validation

Pattern definitions must be valid.

Examples:

Invalid:

```text
Pattern Count = 0
```

Result:

Validation error.

Command rejected.

---

# Asset Validation

All asset references must resolve.

Examples:

* image assets
* imported SVG assets

Missing assets generate recovery actions.

---

# Missing Asset Recovery

Missing assets must not destroy project content.

Replace missing assets with:

```text
Placeholder Asset
```

Generate warning.

Preserve object placement and metadata.

---

# UUID Validation

Every entity UUID must be unique.

Examples:

* rings
* sectors
* shapes
* text
* guides

Duplicate UUIDs generate repair actions.

---

# UUID Repair

Duplicate UUID repair is permitted.

Repair process:

1. Generate new UUID
2. Update references
3. Log repair

This repair is deterministic.

---

# Reference Integrity

All references must be validated.

Examples:

```text
Object
→ Sector

Pattern
→ Source Object

Asset
→ Asset Table
```

Broken references generate recovery actions.

---

# Orphan Recovery

Missing references must not be guessed.

Invalid entities should be moved into a recovery container.

Example:

```text
Recovered Objects
```

or equivalent implementation.

Recovery containers preserve user work.

---

# Serialization Validation

Validate:

* schema version
* required fields
* structure correctness
* identifier integrity

during load operations.

---

# Migration Validation

Migration must validate:

* migrated fields
* migrated references
* migrated geometry

before project load completes.

---

# Export Validation

Export validation runs before export generation.

Examples:

* invalid geometry
* unresolved assets
* fabrication concerns

---

# Fabrication Validation

Fabrication validation identifies potentially fragile designs.

Examples:

* extremely small cutouts
* tiny features
* narrow bridges

These generate warnings only.

They do not block export.

---

# Future Fabrication Checks

Potential future checks:

* unsupported material thickness
* weak structural regions
* excessive cut complexity
* printability concerns

Architecture should support expansion.

---

# Save Validation

Validation runs during save operations.

Save validation should:

* surface issues
* preserve data
* avoid destructive corrections

Save operations should not be blocked unnecessarily.

---

# Export Blocking Rules

Errors may block export.

Warnings must not block export.

Informational messages never block export.

---

# Save Blocking Rules

Validation errors should not prevent project saves.

Users must be able to preserve unfinished work.

Saving invalid projects is preferable to data loss.

---

# Load Validation

Validation runs during project load.

Load process:

1. Parse
2. Validate
3. Repair
4. Recover
5. Load

This order is mandatory.

---

# Validation Panel

The editor should provide a dedicated validation panel.

The panel displays:

* errors
* warnings
* informational messages

Validation results should remain accessible outside export workflows.

---

# Validation Navigation

Validation entries should support:

```text
Select Entity
Zoom To Entity
Inspect Entity
```

where applicable.

---

# Validator Registration

Validation architecture must support registration.

Examples:

```text
Volvelle Validator
Tunnel Book Validator
Carousel Book Validator
```

Future mechanism types may contribute validators.

---

# Validator Independence

Validators should be modular.

Avoid monolithic validation systems.

Validators should operate independently and report issues through a common interface.

---

# Agent Directives

## Directive 1

Validation exists to prevent corruption, not unusual designs.

---

## Directive 2

Prefer reporting over modification.

---

## Directive 3

Automatic repairs require deterministic outcomes.

---

## Directive 4

Never guess when recovering damaged data.

---

## Directive 5

Preserve user work whenever possible.

---

## Directive 6

Warnings must not block editing.

---

## Directive 7

Validation must occur during command execution, save, load, export, and migration.

---

## Directive 8

Broken references should be quarantined rather than discarded.

---

## Directive 9

Validators must produce structured validation issues.

---

## Directive 10

Validation systems must remain extensible for future mechanism types.

---

# Architectural Rule

Validation protects project integrity.

Recovery protects user work.

When these goals conflict, preserving user work takes priority.

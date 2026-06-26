# 09_PROPERTY_SYSTEM_AND_INSPECTOR.md

# Urania Property System & Inspector Architecture

## Purpose

The Property System provides a unified mechanism for viewing and editing object attributes.

The Property System serves as the bridge between:

- Scene Graph
- Selection System
- Command System
- User Interface

Property editing must remain consistent across all editable entities.

---

# Core Philosophy

Properties describe objects.

The inspector edits properties.

The inspector never edits objects directly.

Required flow:

User Input
↓
Property Change Request
↓
Command Creation
↓
Scene Graph Update
↓
UI Refresh

Direct mutation is prohibited.

---

# Architectural Rule

Inspector components must never modify scene graph objects directly.

All edits must be executed through commands.

Example:

Property Change
↓
SetPropertyCommand
↓
Scene Graph

Correct.

Direct object mutation is prohibited.

---

# Property Metadata System

All editable properties must be metadata-driven.

Avoid hardcoded inspector layouts.

Example:

```typescript
interface PropertyDefinition {
    id: string;
    label: string;
    category: string;
    type: PropertyType;
    editable: boolean;
    defaultValue?: unknown;
    min?: number;
    max?: number;
}
```

Property definitions drive:

- inspector generation
- validation
- serialization
- defaults
- future search
- future automation

---

# Property Categories

Properties must be grouped into categories.

Examples:

Transform

Appearance

Text

Pattern

Mechanism

Export

Advanced

Categories improve discoverability and reduce inspector clutter.

---

# Inspector Behavior

The inspector reflects current selection.

Selection drives inspector content.

Examples:

Ring Selected
↓
Ring Properties

Text Selected
↓
Text Properties

Window Selected
↓
Window Properties

---

# No Selection Behavior

When nothing is selected:

Display:

Project Settings

Canvas Settings

Export Settings

The inspector should remain useful even when no object is selected.

---

# Live Editing

Property edits update immediately.

Example:

Rotation
45°
→
46°

Result:

Object updates instantly.

Apply buttons are prohibited.

---

# Property Editing Flow

User Changes Value
↓
Validation
↓
Command Creation
↓
Scene Graph Update
↓
Render Refresh

Every property follows the same flow.

---

# Numeric Scrubbing

Numeric properties should support scrubbing.

Example:

Radius [100]

Drag Label
↓
Value Changes

Scrubbing improves speed for visual adjustments.

---

# Units

Internal units:

Pixels

User-visible units:

Pixels

Millimeters

Inches

The editor should support unit conversion at the UI layer.

Project data remains unit-independent internally.

---

# Multi-Selection Editing

Multiple selected objects may be edited simultaneously.

Example:

3 Shapes Selected

Fill Color Changed

Result:

All selected objects update.

---

# Mixed Property Values

When selected objects contain different values:

Display empty property fields.

Example:

Object A
Red

Object B
Blue

Inspector:

Color [ ]

Blank values indicate differing underlying values.

---

# Editable vs Computed Properties

Properties belong to one of two categories.

---

## Editable Properties

Examples:

Radius

Rotation

Text Content

Color

Editable properties generate commands.

---

## Computed Properties

Examples:

Arc Length

Generated Instance Count

Derived Geometry Values

Computed properties are informational.

Computed properties cannot be edited.

---

# Validation

All property edits must validate before command execution.

Example:

Radius = -500

Result:

Rejected

Invalid values must never enter project state.

---

# Ring Properties

MVP ring properties include:

Name

Inner Radius

Outer Radius

Rotation

Visibility

Locked

Sector Count

Additional mechanism properties may be added in future versions.

The architecture must support extension.

---

# Future Ring Properties

Examples:

Radial Symmetry

Standard Circle Flag

Rotation Limits

Gear Link Information

Mechanism Metadata

Future properties should integrate through metadata registration.

---

# Sector Properties

MVP sector properties include:

Name

Visibility

Label

Sector count changes remain ring-level operations.

---

# Shape Properties

Examples:

Position

Rotation

Scale

Fill

Stroke

Visibility

Lock State

Pattern Configuration

---

# Window Properties

Examples:

Position

Rotation

Shape Parameters

Visibility

Pattern Configuration

---

# Text Properties

Examples:

Content

Font Size

Rotation

Alignment

Visibility

Text content should be editable both:

Inline

and

through the inspector.

---

# Arc Text Properties

Arc text exposes:

Radius

Start Angle

End Angle

Direction

Letter Spacing

Alignment

Content

These properties should remain independently editable.

---

# Image Properties

Examples:

Position

Rotation

Scale

Visibility

Source Metadata

---

# Guide Properties

Examples:

Guide Type

Angle

Radius

Visibility

Lock State

---

# Pattern Properties

Patterned objects expose pattern configuration through the source object.

Examples:

Pattern Type

Pattern Count

Pattern Spacing

Pattern Rotation

Generated instances do not own independent pattern properties.

---

# Property Commands

Property changes should generate specialized commands.

Examples:

SetRotationCommand

SetVisibilityCommand

SetTextContentCommand

Commands improve:

Undo

Redo

History Inspection

Future Automation

---

# Property Synchronization

All editing methods must modify the same underlying property.

Example:

Ring Rotation Tab
↓
Rotation Property

Inspector Rotation Field
↓
Rotation Property

Both paths must produce identical results.

---

# Context Awareness

Inspector content must remain context-sensitive.

Different object types expose different property groups.

Property categories should appear only when relevant.

---

# Property Search Support

The architecture should support future property search.

MVP UI is not required.

Metadata should contain sufficient information for future implementation.

---

# Reset To Default

Properties should support default values.

The architecture should allow future reset functionality.

Example:

Radius [100] ↺

Reset support should be metadata-driven.

---

# Serialization

Property definitions do not belong in project files.

Property values belong in project files.

Metadata remains application-level configuration.

---

# Agent Directives

## Directive 1

Inspectors never mutate scene graph objects directly.

---

## Directive 2

All edits must execute through commands.

---

## Directive 3

Property definitions must be metadata-driven.

---

## Directive 4

Validation occurs before command execution.

---

## Directive 5

Computed properties are read-only.

---

## Directive 6

Multi-selection editing must be supported.

---

## Directive 7

Generated pattern instances do not own independent pattern settings.

---

## Directive 8

All editing paths must update the same underlying properties.

---

## Directive 9

Inspector behavior must remain consistent across object types.

---

## Directive 10

The property system must remain extensible for future mechanism types.

---

# Architectural Rule

The inspector is a view of object properties.

Commands modify properties.

The Scene Graph remains the source of truth.
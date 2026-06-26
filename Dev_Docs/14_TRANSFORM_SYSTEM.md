# 14_TRANSFORM_SYSTEM.md

# Urania Transform System

## Purpose

This document defines how objects, text, and structures are transformed within the Urania editor.

It specifies:

* movement
* rotation
* scaling
* radial and angular deformation
* group transforms
* coordinate interpretation
* transform tool architecture

This system is explicitly radial-first but supports Cartesian interactions where required.

---

# Core Philosophy

Transforms are **explicit tools**, not configurable modes.

Each transform has a single, well-defined behavior.

Users choose *what they are doing*, not how a tool behaves.

---

# Transform Model Overview

Transforms are divided into distinct families:

* Rotation
* Scaling
* Radial resizing
* Angular resizing
* Group transforms

Each family may have multiple tools.

---

# Coordinate System

Objects exist in a dual-representation system:

* **Cartesian coordinates** (rendering and interoperability)
* **Radial coordinates** (primary conceptual model)

Radial representation is authoritative for editor behavior.

---

# Movement

## Default Move Behavior

Objects move freely in canvas space.

Movement is not constrained unless a specific tool is active.

---

## Radial Awareness

During movement, objects retain awareness of:

* distance from center
* angular position
* sector membership

This is informational unless used by other tools.

---

# Rotation System

## Object Rotate Tool

Rotates an object around its **own center**.

* Standard rotation behavior
* Independent of ring structure

---

## Ring Rotate Tool

Rotates objects around the **volvelle center (global origin)**.

* Applies radial rotation
* Affects perceived angular placement

---

## Tool Separation Principle

Rotation origin is not configurable.

Instead:

* Object Rotate = object-centered rotation
* Ring Rotate = global radial rotation

This avoids pivot configuration complexity.

---

# Scaling System

## Standard Scale Tool

Applies uniform scaling around object center.

* Maintains proportions
* Default behavior for most objects

---

## Modifier Override Scaling

Modifiers allow temporary distortion:

* non-uniform scaling
* proportional locking
* constrained scaling axes

Modifiers do not change tool identity.

---

# Radial Resize System

Radial resizing modifies object position relative to the center.

## Radial Resize Tool

* increases/decreases distance from center
* preserves angular position
* does not affect object rotation

Use cases:

* moving elements between rings
* adjusting radial placement of windows and labels

---

# Angular Resize System

Angular resizing modifies object width along arc geometry.

## Angular Resize Tool

* increases/decreases angular span
* preserves radial distance
* maintains center alignment along arc

Use cases:

* widening windows
* adjusting sector-aligned elements
* shaping radial patterns

---

# Scaling Behavior Semantics

Scaling is separated into:

* geometric scaling (object-local)
* radial scaling (position-based)
* angular scaling (arc-based)

This prevents overloaded transform meanings.

---

# Group Transforms

## Group Rotate

Rotates a selection around its **bounding-box center**.

* Standard multi-object rotation
* Cartesian-space grouping

---

## Group Orbit

Rotates a selection around the **volvelle center**.

* radial group rotation
* preserves relative object structure

---

# Pivot System Policy

There is no user-configurable pivot system.

Instead:

* pivot is defined by tool type
* tools encode transform origin

This reduces UI complexity and prevents pivot ambiguity.

---

# Transform Interaction Rules

## Live Preview

All transforms are applied in real time during interaction.

No preview/commit separation exists.

---

## Pointer Capture

During transforms:

* pointer remains bound to active object
* interaction persists outside object bounds

---

## Drag Threshold

Transforms activate after a minimal movement threshold to prevent accidental activation.

---

## Multi-Object Behavior

Transforms apply to:

* individual objects OR
* grouped selections

depending on tool type.

Group behavior is explicit, not inferred.

---

# Object Creation Transform State

Newly created objects immediately enter transform-ready state.

* selection is automatic
* transform handles appear immediately
* no mode switching required

---

# Sector Awareness

Objects maintain awareness of radial sectors.

This includes:

* sector index
* angular boundaries
* adjacency relationships

This data is used for future snapping and structural behaviors.

---

# Cross-Sector Movement

Objects may move freely across sector boundaries.

No constraints are imposed at the transform level.

---

# Text Transform Behavior

## Scaling Text

Text scaling follows object-scale rules:

* default: geometric scaling
* font-size scaling handled in properties panel

Transform tools do not directly modify typography attributes unless explicitly invoked.

---

# Image Transform Behavior

Images maintain:

* aspect ratio by default
* uniform scaling behavior

Free distortion requires modifier override.

---

# Pattern Instances

Transform changes to source objects propagate live to all instances.

* real-time updates
* no bake step required

---

# Undo System

Transforms are grouped per interaction:

* one drag = one undo step
* continuous updates are coalesced

This prevents excessive undo fragmentation.

---

# Transform Constraints

Modifiers allow:

* uniform locking
* axis constraints
* temporary distortion behaviors

Modifiers do not change tool identity.

---

# Object State Awareness

Objects retain metadata for:

* sector membership
* radial position
* angular width
* transform history

This supports future snapping and mechanical extensions.

---

# Future Extension Hooks

Transform system is designed to support:

* mechanical linkages
* constrained motion systems
* gear-like relationships
* automated radial animation systems

These are not part of MVP behavior but are structurally supported.

---

# Agent Directives

## Directive 1

Transforms must be explicit tools with singular behavior definitions.

---

## Directive 2

Pivot configuration is not user-exposed.

---

## Directive 3

Radial structure is first-class, Cartesian structure is secondary.

---

## Directive 4

Transforms must support real-time feedback.

---

## Directive 5

Group transforms must be explicitly defined (rotate vs orbit).

---

## Directive 6

Modifiers may adjust behavior but must not redefine tool identity.

---

## Directive 7

Undo must respect interaction grouping, not frame-by-frame updates.

---

## Directive 8

All transforms must preserve sector awareness metadata.

---

## Directive 9

Future mechanical and constraint systems must be structurally anticipated even if not implemented.

---

# Architectural Principle

Transforms define *how objects change*, not *how tools behave*.

Users interact with intent-driven tools, not parameterized transformation states.

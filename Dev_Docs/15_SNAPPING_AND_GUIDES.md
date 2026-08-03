# 15_SNAPPING_AND_GUIDES.md

# Urania Snapping and Grid Assistance System

## Purpose

This document defines spatial assistance and snapping behavior during drafting and transformation in Urania.

It specifies:

* background grid overlays (concentric circles, radial slice lines)
* rotational and concentric alignment assistance
* interaction feedback & precision snapping
* post-MVP automated grid snapping roadmap

---

## Core Philosophy

Grid assistance is:

```text
Visual and suggestive, not authoritative
```

It assists visual drafting without constraining user placement.

Users remain in full control at all times.

---

## Evolution & Architecture Decision

During early development, individual manually-placed "guide line" nodes were removed from the scope.

Geometry drafting features originally intended as guide markers were folded directly into permanent **Line** and **Curve** objects, which exist as standard elements in the scene graph.

### Architectural Rules:
1. **No Manually-Placed Guide Nodes**: Urania does not support manually placed, draggable, or persistent "guide" objects.
2. **Automated Grid Overlays**: Visual assistance is provided strictly via automated canvas overlays (Concentric Ring Boundaries and Radial Slice Lines).
3. **Permanent Line & Curve Objects**: Any lines or arcs drawn by the user are saved as permanent structural/artistic elements on a ring, not temporary drafting guides.

---

## Canvas Drafting Overlays (MVP Scope)

### Concentric Ring Overlay
Renders circular reference lines corresponding to ring inner/outer radii.

### Radial Slice Overlay
Renders radial lines dividing the mechanism into symmetrical angular sectors (e.g. 6, 12, 24, or custom slice steps).

---

## Post-MVP Snapping Roadmap

A fully automated, generated snap grid (both Cartesian $X/Y$ and Radial $r/\theta$) is planned for post-MVP. See [30_POST_MVP_MAP.md](file:///c:/Users/Michael/Documents/00%20-%20apps/Urania/Dev_Docs/30_POST_MVP_MAP.md) for details.

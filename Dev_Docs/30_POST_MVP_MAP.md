# 30_POST_MVP_MAP.md

# Urania Post-MVP Roadmap & Future Mechanism Expansion

## Overview

This document tracks planned features, enhancements, and mechanism expansions beyond the initial MVP scope for Urania. It serves as an architectural index ensuring current implementation decisions remain compatible with future feature sets.

---

## 1. Physical Fabrication & Export Enhancements

### Plotter & Cutting Machine Presets (Post-MVP)
* **Software Presets**: Pre-configured stroke color-coding and layer structures tailored for specific cutting machine software:
  * Cricut Design Space (Red cut lines, Blue score/fold lines)
  * Silhouette Studio (Cut vs. Draw vs. Score paths)
  * LightBurn & Laser Cutters (Color-coded vector layers for cut/engrave/score power settings)
* **Registration & Alignment Marks**:
  * Print-and-cut registration marks (optical alignment targets for Cricut/Silhouette sensors).
  * Layer alignment pins / crosshairs for multi-disc assembly.

---

## 2. v1.1 Priority Features

### Pattern Generators & Advanced Group Selection
* **Alternating Pattern Engine**: Advanced procedural repetition generator supporting alternating offsets, staggered angular steps, and multi-element rotational patterns across sectors.
* **Grouping & Selection Tools**: Multi-object grouping abstraction allowing complex multi-element compositions to be grouped, saved as pattern blocks, and copied/pasted in a controlled manner for pattern building.

### Automated Grid & Snap System
* **Generated Snap Grids**: Fully automated Cartesian ($X/Y$) and Radial ($r/\theta$) grid generation with real-time snap targets. Replaces manual markers with dynamic generated snap points across ring boundaries, centerlines, and sector divisions.

### Enhanced Mechanism Dynamics & Controls
* **Gear-Linked Rotations**: Linked angular motion where rotating one disc automatically spins connected discs by configurable gear ratios.
* **Track Sweep Limits**: Mechanical rotation stops limiting disc rotation to specific angular spans (e.g. 45° to 180°).
* **Custom Grab Tabs & Protrusions**: Specialized grab handle shapes, edge notches, and extended pull-tabs on disc peripheries.

### Non-Ring Layers & Auxiliary Components
* **Overlays & Pointer Arms**: Independent non-ring layers (e.g., indicator arrows, pointer arms, fixed top covers, stationary baseboards).
* **Static Base & Top Plates**: Rigid non-rotating mounting backing plates and decorative top overlays.

---

## 3. Product Architecture Decisions & Scope Adjustments

### Advisory Validation Philosophy
* Validation checks (cutout paper bridge thickness, radius bounds, missing assets) remain strictly **advisory**.
* Validation must never block exports or force geometry changes; artists retain absolute control over design choices and physical experimentation.

### Scope Adjustments for MVP (v1.0)
1. **Slice Mode Deferred**: Dedicated "Slice Mode" editing has been removed from MVP in favor of the integrated radial slice line grid overlay and rotational symmetry controls.
2. **Manually-Placed Guides Removed**: Individual draggable guide markers were removed. Drafting assistance is provided via automated concentric ring and radial slice grid overlays, while permanent line/curve objects serve geometric path needs.

---

## 4. Radial Warp — Post-MVP Shape Deformation Extensions

The MVP Radial Warp feature deforms rectangles and trapezoids into arc-slice shapes. The following extensions are architecturally anticipated but deferred.

### Extended Shape Warping
* **Polygon → Pie-Slice Warp**: Regular polygons (hexagon, pentagon, etc.) deform into a curved sector shape, with vertices projected onto inner and outer arc boundaries. Each vertex is placed at an angular position relative to the object's angular span and the polygon's natural vertex distribution.
* **Star → Radial Fan Warp**: Star shapes warp so inner and outer radius points align to inner/outer ring radii respectively, with points distributed angularly across the object's sector footprint.
* **Window Cutout Arc Warp**: Window cutout shapes (currently rectangle/trapezoid only) extend arc deformation to their inner shape geometry, enabling properly tapered cutout apertures.

### Image & SVG Asset Arc Warping
* **Raster Image Arc Warp**: User-uploaded PNG/JPEG images placed on a ring can be warped to follow the ring's curvature. The image is projected onto a curved quad mesh (inner arc edge, outer arc edge, angular span), rendering the texture as if physically wrapped around the disc. This is a canvas-layer post-processing effect in SVG output using `<feTurbulence>` distortion maps or a pre-tessellated polygon grid approach.
* **SVG Asset Arc Warp**: Placed SVG artwork elements are similarly warped via a polar coordinate remapping of their path data. Complex paths may require tessellation at export time.
* **Per-Object Warp Intensity**: A `radialWarpStrength` property (0–1) allowing partial warping — 0 = flat Cartesian, 1 = full arc conforming. Useful for decorative elements that should "suggest" curvature without fully distorting.

### Radial Handle Coordinate Mode (Post-MVP UX Polish)
* **Contextual Polar Handle Rendering**: When an object sits on a ring, optional handle affordances render in a second color showing arc-constrained drag directions (tangential arc vs. radial inward/outward) alongside the standard Cartesian bounding box handles. Toggled per-user as a preference rather than per-object.
* **Snap-to-Arc Movement**: Objects with Radial Warp active snap their center position to the ring's arc geometry during drag, preventing accidental off-arc placement. Configurable snap threshold.

---

## 5. Disc-Attached Tabs — Deferred Features

### Inner-Edge Tabs (Post-MVP)
* **Inward-Protruding Tabs**: `DiscTabNode` currently only supports `edge: "outer"` (tabs that protrude outward from the disc's outer perimeter). A future extension will add `edge: "inner"`, allowing tabs that protrude *inward* from the disc's inner hole boundary. These are geometrically identical but point toward the brad hole center. The `DiscTabNode` type already includes the `edge` field to ensure forward compatibility. Inner-edge tab geometry is validated to prevent the tab from crossing the opposite ring boundary.

---

## 6. Post-MVP Mechanism Architecture

### V1.0 Constraint — Central Brad Binding
* All v1.0 rings are assumed to share a single central brad (axle pin) that physically binds the ring stack at the origin. This means all rings share the same rotation center and are coaxial.
* Internal mechanical connections that would allow a ring to be driven by or linked to another ring *independently of the central brad* (e.g., gear-linked rotations, track-guided satellite rings, pivoting lever arms) are **post-MVP features**. These require a separate mechanism graph node model that is architecturally distinct from the current concentric volvelle model.

### Post-MVP Independent Mechanism Connections
* **Gear-Linked Rotations**: Linked angular motion where rotating one ring automatically spins connected rings by configurable gear ratios.
* **Track Sweep Limits / Rotation Stops**: Mechanical stops limiting disc rotation to specific angular spans (e.g. 45° to 180°). Connection requires a mechanism that is independent of the brad.
* **Satellite / Eccentric Ring Mounts**: Rings whose center of rotation is offset from the origin, mounted via a track or secondary brad. Requires a mechanism node model supporting multiple pivot points.

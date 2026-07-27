import { describe, it, expect } from "vitest";
import { Matrix2D } from "./matrix";

describe("Matrix2D Utility", () => {
  it("creates identity matrix", () => {
    const m = Matrix2D.identity();
    expect(m.a).toBe(1);
    expect(m.b).toBe(0);
    expect(m.c).toBe(0);
    expect(m.d).toBe(1);
    expect(m.tx).toBe(0);
    expect(m.ty).toBe(0);
  });

  it("translates points correctly", () => {
    const m = Matrix2D.identity().translate(10, 20);
    const p = m.transformPoint(5, 5);
    expect(p.x).toBe(15);
    expect(p.y).toBe(25);
  });

  it("rotates points correctly", () => {
    const m = Matrix2D.identity().rotate(90);
    const p = m.transformPoint(10, 0);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(10);
  });

  it("scales points correctly", () => {
    const m = Matrix2D.identity().scale(2, 3);
    const p = m.transformPoint(10, 10);
    expect(p.x).toBe(20);
    expect(p.y).toBe(30);
  });

  it("inverts non-singular matrix correctly", () => {
    const m = Matrix2D.identity().translate(10, 20).rotate(45).scale(2, 2);
    const inv = m.invert();
    const p = { x: 50, y: 50 };
    const transformed = m.transformPoint(p.x, p.y);
    const restored = inv.transformPoint(transformed.x, transformed.y);
    expect(restored.x).toBeCloseTo(p.x);
    expect(restored.y).toBeCloseTo(p.y);
  });

  it("throws error when inverting singular matrix", () => {
    const m = new Matrix2D(0, 0, 0, 0, 0, 0);
    expect(() => m.invert()).toThrow("Matrix is singular");
  });

  it("decomposes matrix into transform components", () => {
    const m = Matrix2D.identity().translate(15, 25).rotate(90).scale(2, 2);
    const decomp = m.decompose();
    expect(decomp.x).toBe(15);
    expect(decomp.y).toBe(25);
    expect(decomp.rotation).toBeCloseTo(90);
    expect(decomp.scaleX).toBeCloseTo(2);
    expect(decomp.scaleY).toBeCloseTo(2);
  });
});

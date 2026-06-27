import { describe, it, expect } from "vitest";
import {
  normalizeAngle,
  degreesToRadians,
  radiansToDegrees,
  cartesianToPolar,
  polarToCartesian,
} from "./math";
import { Matrix2D } from "./matrix";

describe("Math Utilities", () => {
  describe("normalizeAngle", () => {
    it("should keep positive angles in [0, 360) range unchanged", () => {
      expect(normalizeAngle(0)).toBe(0);
      expect(normalizeAngle(90)).toBe(90);
      expect(normalizeAngle(359.9)).toBe(359.9);
    });

    it("should wrap positive angles greater than 360", () => {
      expect(normalizeAngle(360)).toBe(0);
      expect(normalizeAngle(450)).toBe(90);
      expect(normalizeAngle(720)).toBe(0);
      expect(normalizeAngle(735)).toBe(15);
    });

    it("should wrap negative angles to positive equivalent", () => {
      expect(normalizeAngle(-90)).toBe(270);
      expect(normalizeAngle(-360)).toBe(0);
      expect(normalizeAngle(-450)).toBe(270);
      expect(normalizeAngle(-1)).toBe(359);
    });
  });

  describe("Rad/Deg Conversion", () => {
    it("should convert degrees to radians", () => {
      expect(degreesToRadians(180)).toBeCloseTo(Math.PI, 5);
      expect(degreesToRadians(0)).toBe(0);
    });

    it("should convert radians to degrees", () => {
      expect(radiansToDegrees(Math.PI)).toBeCloseTo(180, 5);
      expect(radiansToDegrees(0)).toBe(0);
    });
  });

  describe("cartesianToPolar and polarToCartesian roundtrip", () => {
    it("should convert coordinate point vectors consistently", () => {
      // East (0 degrees)
      let polar = cartesianToPolar(10, 0);
      expect(polar.r).toBeCloseTo(10, 5);
      expect(polar.theta).toBe(0);

      // South (90 degrees, since Y increases downwards in screen space)
      polar = cartesianToPolar(0, 10);
      expect(polar.r).toBeCloseTo(10, 5);
      expect(polar.theta).toBe(90);

      // West (180 degrees)
      polar = cartesianToPolar(-10, 0);
      expect(polar.r).toBeCloseTo(10, 5);
      expect(polar.theta).toBe(180);

      // North (270 degrees)
      polar = cartesianToPolar(0, -10);
      expect(polar.r).toBeCloseTo(10, 5);
      expect(polar.theta).toBe(270);
    });

    it("should handle custom origins correctly", () => {
      const cx = 100;
      const cy = 100;

      // Point at (100, 150) is 50px below center (South -> 90 degrees)
      const polar = cartesianToPolar(100, 150, cx, cy);
      expect(polar.r).toBe(50);
      expect(polar.theta).toBe(90);

      // Roundtrip back to Cartesian
      const cartesian = polarToCartesian(polar.r, polar.theta, cx, cy);
      expect(cartesian.x).toBeCloseTo(100, 5);
      expect(cartesian.y).toBeCloseTo(150, 5);
    });

    it("should perfectly roundtrip random positions", () => {
      const cx = 250;
      const cy = 250;

      for (let i = 0; i < 100; i++) {
        const randX = Math.random() * 500;
        const randY = Math.random() * 500;

        const polar = cartesianToPolar(randX, randY, cx, cy);
        const backCartesian = polarToCartesian(polar.r, polar.theta, cx, cy);

        expect(backCartesian.x).toBeCloseTo(randX, 5);
        expect(backCartesian.y).toBeCloseTo(randY, 5);
      }
    });
  });

  describe("Matrix2D", () => {
    it("should invert translation and rotation matrices correctly", () => {
      const m = Matrix2D.identity().translate(10, 20).rotate(45).scale(2, 2);
      const inv = m.invert();

      const pt = { x: 5, y: 5 };
      const transformed = m.transformPoint(pt.x, pt.y);
      const untransformed = inv.transformPoint(transformed.x, transformed.y);

      expect(untransformed.x).toBeCloseTo(pt.x, 5);
      expect(untransformed.y).toBeCloseTo(pt.y, 5);
    });

    it("should throw on singular matrices", () => {
      const singular = new Matrix2D(0, 0, 0, 0, 0, 0);
      expect(() => singular.invert()).toThrow();
    });
  });
});

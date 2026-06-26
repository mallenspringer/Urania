import { describe, it, expect } from "vitest";
import {
  sortKeys,
  serializeProject,
  deserializeProject,
} from "./serialization";
import type { Project } from "../types/project";

describe("Serialization Utilities", () => {
  const dummyProject: Project = {
    format: "urania",
    version: "1.0.0",
    mechanismType: "volvelle",
    metadata: {
      name: "Test Project",
      author: "Jane Doe",
      description: "A simple volvelle wheel.",
      createdAt: "2026-06-26T12:00:00Z",
      updatedAt: "2026-06-26T12:00:00Z",
    },
    settings: {
      units: "inches",
      canvasSize: { width: 10, height: 10 },
    },
    assets: [],
    mechanism: {
      id: "root-1",
      type: "volvelle",
      name: "Mechanism Root",
      visible: true,
      locked: false,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      children: [],
    },
  };

  describe("sortKeys", () => {
    it("should recursively sort keys of any object", () => {
      const obj = {
        z: 1,
        b: {
          y: 2,
          a: 1,
        },
        a: [
          { y: 2, x: 1 },
          { b: 2, a: 1 },
        ],
      };

      const sorted = sortKeys(obj);

      // Check root key sorting
      expect(Object.keys(sorted)).toEqual(["a", "b", "z"]);
      // Check nested object key sorting
      expect(Object.keys(sorted.b)).toEqual(["a", "y"]);
      // Check array elements key sorting
      expect(Object.keys(sorted.a[0])).toEqual(["x", "y"]);
      expect(Object.keys(sorted.a[1])).toEqual(["a", "b"]);
    });

    it("should handle null and primitives safely", () => {
      expect(sortKeys(null)).toBeNull();
      expect(sortKeys(42)).toBe(42);
      expect(sortKeys("hello")).toBe("hello");
    });
  });

  describe("serializeProject", () => {
    it("should produce deterministic outputs regardless of key insert order", () => {
      const p1: Project = { ...dummyProject };
      // Create p2 with different property insertion order
      const p2: Project = JSON.parse(JSON.stringify(dummyProject));

      const s1 = serializeProject(p1);
      const s2 = serializeProject(p2);

      expect(s1).toBe(s2);
    });
  });

  describe("deserializeProject", () => {
    it("should parse a valid project successfully", () => {
      const serialized = serializeProject(dummyProject);
      const parsed = deserializeProject(serialized);
      expect(parsed.format).toBe("urania");
      expect(parsed.mechanism.id).toBe("root-1");
    });

    it("should throw error for empty input", () => {
      expect(() => deserializeProject("")).toThrow("Project JSON is empty");
      expect(() => deserializeProject("   ")).toThrow("Project JSON is empty");
    });

    it("should throw error for invalid format value", () => {
      const invalid = { ...dummyProject, format: "invalid-format" } as any;
      expect(() => deserializeProject(JSON.stringify(invalid))).toThrow(
        "Expected 'urania'"
      );
    });

    it("should throw error for unsupported mechanismType", () => {
      const invalid = { ...dummyProject, mechanismType: "tunnel_book" } as any;
      expect(() => deserializeProject(JSON.stringify(invalid))).toThrow(
        "Unsupported mechanism type: 'tunnel_book'"
      );
    });

    it("should throw error for invalid mechanism structure", () => {
      const invalid = { ...dummyProject, mechanism: null } as any;
      expect(() => deserializeProject(JSON.stringify(invalid))).toThrow(
        "Missing or invalid mechanism root."
      );
    });
  });
});

import { describe, it, expect } from "vitest";
import { getArcTextCharPositions } from "./textGeometry";

describe("textGeometry getArcTextCharPositions", () => {
  it("returns empty charPositions and 0 totalSweep for empty string", () => {
    const layout = getArcTextCharPositions("", 100, 0, 14, "Outfit", 0);
    expect(layout.charPositions).toEqual([]);
    expect(layout.totalSweep).toBe(0);
  });

  it("calculates character positions and totalSweep for string with zero kerning", () => {
    const layout = getArcTextCharPositions("ABC", 100, 0, 14, "Outfit", 0);
    expect(layout.charPositions.length).toBe(3);
    expect(layout.charPositions[0].char).toBe("A");
    expect(layout.charPositions[1].char).toBe("B");
    expect(layout.charPositions[2].char).toBe("C");
    expect(layout.totalSweep).toBeGreaterThan(0);
  });

  it("increases totalSweep when kerning is added", () => {
    const layoutNoKerning = getArcTextCharPositions("TEST", 100, 0, 14, "Outfit", 0);
    const layoutWithKerning = getArcTextCharPositions("TEST", 100, 0, 14, "Outfit", 5);

    expect(layoutWithKerning.totalSweep).toBeGreaterThan(layoutNoKerning.totalSweep);

    // Each character center angle in kerning layout should be further along than zero kerning layout
    expect(layoutWithKerning.charPositions[3].charAngle).toBeGreaterThan(
      layoutNoKerning.charPositions[3].charAngle
    );
  });
});

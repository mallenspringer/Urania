import { describe, it, expect } from "vitest";
import {
  toPixels,
  fromPixels,
  convertUnit,
  getUnitSymbol,
  formatUnitValue,
  DPI,
} from "./unitConversion";

describe("unitConversion utility", () => {
  it("converts inches to pixels and back", () => {
    const inches = 10;
    const px = toPixels(inches, "inches");
    expect(px).toBe(10 * DPI); // 960 px

    const restoredInches = fromPixels(px, "inches");
    expect(restoredInches).toBe(10);
  });

  it("converts millimeters to pixels and back", () => {
    const mm = 254; // 10 inches
    const px = toPixels(mm, "millimeters");
    expect(px).toBeCloseTo(960);

    const restoredMm = fromPixels(px, "millimeters");
    expect(restoredMm).toBeCloseTo(254);
  });

  it("converts directly between millimeters and inches", () => {
    const mm = 25.4;
    const inches = convertUnit(mm, "millimeters", "inches");
    expect(inches).toBeCloseTo(1.0);

    const backToMm = convertUnit(1, "inches", "millimeters");
    expect(backToMm).toBeCloseTo(25.4);
  });

  it("converts 2000mm canvas size to inches correctly", () => {
    const mm = 2000;
    const inches = convertUnit(mm, "millimeters", "inches");
    expect(inches).toBeCloseTo(78.740157);
  });

  it("returns correct unit symbols", () => {
    expect(getUnitSymbol("pixels")).toBe("px");
    expect(getUnitSymbol("inches")).toBe("in");
    expect(getUnitSymbol("millimeters")).toBe("mm");
  });

  it("formats unit values cleanly for UI", () => {
    expect(formatUnitValue(96, "inches")).toBe(1);
    expect(formatUnitValue(96, "pixels")).toBe(96);
  });

  it("handles 2000mm to inches unit conversion scenario", () => {
    // 2000 mm -> inches -> pixels
    const widthInMm = 2000;
    const widthInInches = convertUnit(widthInMm, "millimeters", "inches");
    expect(widthInInches).toBeCloseTo(78.74, 2);

    const widthInPx = convertUnit(widthInInches, "inches", "pixels");
    expect(widthInPx).toBeCloseTo(7559.05, 1);
  });
});

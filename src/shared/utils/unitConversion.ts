export type Unit = "pixels" | "inches" | "millimeters";

export const DPI = 96; // Standard Web / SVG 96 PPI
export const MM_PER_INCH = 25.4;
export const PX_PER_MM = DPI / MM_PER_INCH; // ~3.779527559

/**
 * Converts a value from one unit to pixels.
 */
export function toPixels(value: number, fromUnit: Unit): number {
  if (isNaN(value)) return 0;
  switch (fromUnit) {
    case "inches":
      return value * DPI;
    case "millimeters":
      return value * PX_PER_MM;
    case "pixels":
    default:
      return value;
  }
}

/**
 * Converts a value from pixels to a target unit.
 */
export function fromPixels(valueInPx: number, toUnit: Unit): number {
  if (isNaN(valueInPx)) return 0;
  switch (toUnit) {
    case "inches":
      return valueInPx / DPI;
    case "millimeters":
      return valueInPx / PX_PER_MM;
    case "pixels":
    default:
      return valueInPx;
  }
}

/**
 * Directly converts a value from one unit to another.
 */
export function convertUnit(value: number, fromUnit: Unit, toUnit: Unit): number {
  if (fromUnit === toUnit) return value;
  const px = toPixels(value, fromUnit);
  return fromPixels(px, toUnit);
}

/**
 * Gets abbreviation label for unit display in UI.
 */
export function getUnitSymbol(unit: Unit): string {
  switch (unit) {
    case "inches":
      return "in";
    case "millimeters":
      return "mm";
    case "pixels":
    default:
      return "px";
  }
}

/**
 * Formats a pixel value into the target unit for display (with appropriate decimal precision).
 */
export function formatUnitValue(valueInPx: number, unit: Unit, decimals?: number): number {
  const converted = fromPixels(valueInPx, unit);
  const prec = decimals !== undefined ? decimals : unit === "pixels" ? 1 : 3;
  return Number(converted.toFixed(prec));
}

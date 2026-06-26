// Polar and Cartesian Coordinate System Math Utilities

/**
 * Normalizes any angle in degrees into the range [0, 360).
 */
export function normalizeAngle(degrees: number): number {
  let normalized = degrees % 360;
  if (normalized < 0) {
    normalized += 360;
  }
  // Avoid returning -0
  return normalized === 0 ? 0 : normalized;
}

/**
 * Converts degrees to radians.
 */
export function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Converts radians to degrees.
 */
export function radiansToDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/**
 * Converts Cartesian coordinates (x, y) relative to a center point (cx, cy)
 * into Polar coordinates (r, theta) in degrees [0, 360).
 *
 * Because canvas screen space has +y going downwards, standard trigonometric math
 * natively results in clockwise-positive rotations where:
 * - 0 degrees is East (+x)
 * - 90 degrees is South (+y)
 * - 180 degrees is West (-x)
 * - 270 degrees is North (-y)
 */
export function cartesianToPolar(
  x: number,
  y: number,
  cx = 0,
  cy = 0
): { r: number; theta: number } {
  const dx = x - cx;
  const dy = y - cy;
  const r = Math.sqrt(dx * dx + dy * dy);
  const radians = Math.atan2(dy, dx);
  const theta = normalizeAngle(radiansToDegrees(radians));
  return { r, theta };
}

/**
 * Converts Polar coordinates (r, theta) in degrees relative to a center point (cx, cy)
 * back to Cartesian screen coordinates (x, y).
 */
export function polarToCartesian(
  r: number,
  theta: number,
  cx = 0,
  cy = 0
): { x: number; y: number } {
  const radians = degreesToRadians(theta);
  const x = cx + r * Math.cos(radians);
  const y = cy + r * Math.sin(radians);
  return { x, y };
}

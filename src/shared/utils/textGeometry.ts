let offscreenCanvas: HTMLCanvasElement | null = null;
let offscreenCtx: CanvasRenderingContext2D | null = null;

function getContext2D(): CanvasRenderingContext2D | null {
  if (typeof window === "undefined") return null;
  if (!offscreenCtx) {
    offscreenCanvas = document.createElement("canvas");
    offscreenCtx = offscreenCanvas.getContext("2d");
  }
  return offscreenCtx;
}

export interface ArcCharPosition {
  char: string;
  x: number;
  y: number;
  rotation: number;
  charAngle: number;
}

export interface ArcTextLayout {
  charPositions: ArcCharPosition[];
  totalSweep: number;
}

/**
 * Computes exact character positions and total sweep angle along an arc
 * using Canvas font measurement and incremental kerning (letter spacing in px).
 */
export function getArcTextCharPositions(
  content: string,
  radius: number,
  startAngle: number,
  fontSize: number,
  fontFamily: string,
  kerning: number = 0
): ArcTextLayout {
  if (!content) {
    return { charPositions: [], totalSweep: 0 };
  }

  const ctx = getContext2D();
  if (ctx) {
    ctx.font = `${fontSize}px ${fontFamily || "Outfit, Inter, sans-serif"}`;
  }

  const chars = content.split("");
  const safeRadius = Math.max(1, radius);

  const charWidths = chars.map((char) => {
    if (ctx) {
      const metrics = ctx.measureText(char);
      return metrics.width;
    }
    return fontSize * 0.6;
  });

  let currentAngle = startAngle;
  const charPositions: ArcCharPosition[] = [];

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    const charW = charWidths[i];
    const charAngleSpan = (charW / safeRadius) * (180 / Math.PI);
    const kerningAngleSpan = (kerning / safeRadius) * (180 / Math.PI);

    const charCenterAngle = currentAngle + charAngleSpan / 2;
    const angleRad = (charCenterAngle * Math.PI) / 180;

    const x = safeRadius * Math.cos(angleRad);
    const y = safeRadius * Math.sin(angleRad);
    const rotation = charCenterAngle + 90;

    charPositions.push({
      char,
      x,
      y,
      rotation,
      charAngle: charCenterAngle,
    });

    currentAngle += charAngleSpan + kerningAngleSpan;
  }

  const kerningAngleSpan = (kerning / safeRadius) * (180 / Math.PI);
  const totalSweep = chars.length > 0
    ? currentAngle - startAngle - (chars.length > 1 ? kerningAngleSpan : 0)
    : 0;

  return {
    charPositions,
    totalSweep: Math.max(0, totalSweep),
  };
}

import opentype from "opentype.js";

let loadedFont: opentype.Font | null = null;
let loadingPromise: Promise<opentype.Font | null> | null = null;

// Local TTF font asset path (with CDN fallback)
const LOCAL_FONT_URL = "/fonts/Outfit-Bold.ttf";
const CDN_FONT_URL = "https://cdn.jsdelivr.net/fontsource/fonts/outfit@latest/latin-700-normal.ttf";

// High-fidelity vector stroke glyph fallback paths (used if offline / font not ready)
const CHAR_PATHS: Record<string, number[][][]> = {
  '0': [[[1,-9], [7,-9], [7,-1], [1,-1], [1,-9]]],
  '1': [[[2,-9], [4,-10], [4,0]], [[2,0], [6,0]]],
  '2': [[[1,-9], [7,-9], [7,-5], [1,-1], [7,-1]]],
  '3': [[[1,-9], [7,-9], [7,-1], [1,-1]], [[1,-5], [7,-5]]],
  '4': [[[1,-9], [1,-5], [7,-5]], [[6,-10], [6,0]]],
  '5': [[[7,-9], [1,-9], [1,-5], [7,-5], [7,-1], [1,-1]]],
  '6': [[[7,-9], [1,-9], [1,-1], [7,-1], [7,-5], [1,-5]]],
  '7': [[[1,-9], [7,-9], [3,0]]],
  '8': [[[1,-9], [7,-9], [7,-1], [1,-1], [1,-9]], [[1,-5], [7,-5]]],
  '9': [[[7,-1], [7,-9], [1,-9], [1,-5], [7,-5]]],
  'A': [[[1,0], [4,-10], [7,0]], [[2.5,-5], [5.5,-5]]],
  'B': [[[1,0], [1,-10], [6,-10], [6,-5], [1,-5], [6,-5], [6,0], [1,0]]],
  'C': [[[7,-9], [1,-9], [1,-1], [7,-1]]],
  'D': [[[1,0], [1,-10], [5,-10], [7,-7], [7,-3], [5,0], [1,0]]],
  'E': [[[7,0], [1,0], [1,-10], [7,-10]], [[1,-5], [6,-5]]],
  'F': [[[1,0], [1,-10], [7,-10]], [[1,-5], [6,-5]]],
  'G': [[[7,-9], [1,-9], [1,-1], [7,-1], [7,-5], [4,-5]]],
  'H': [[[1,0], [1,-10]], [[7,0], [7,-10]], [[1,-5], [7,-5]]],
  'I': [[[4,0], [4,-10]], [[2,0], [6,0]], [[2,-10], [6,-10]]],
  'J': [[[1,-3], [1,-1], [5,-1], [5,-10]], [[3,-10], [7,-10]]],
  'K': [[[1,0], [1,-10]], [[6,-10], [1,-5], [6,0]]],
  'L': [[[1,-10], [1,0], [7,0]]],
  'M': [[[1,0], [1,-10], [4,-5], [7,-10], [7,0]]],
  'N': [[[1,0], [1,-10], [7,0], [7,-10]]],
  'O': [[[1,-9], [7,-9], [7,-1], [1,-1], [1,-9]]],
  'P': [[[1,0], [1,-10], [7,-10], [7,-5], [1,-5]]],
  'Q': [[[1,-9], [7,-9], [7,-1], [1,-1], [1,-9]], [[5,-3], [8,0]]],
  'R': [[[1,0], [1,-10], [7,-10], [7,-5], [1,-5]], [[4,-5], [7,0]]],
  'S': [[[7,-9], [1,-9], [1,-5], [7,-5], [7,-1], [1,-1]]],
  'T': [[[4,0], [4,-10]], [[1,-10], [7,-10]]],
  'U': [[[1,-10], [1,-1], [7,-1], [7,-10]]],
  'V': [[[1,-10], [4,0], [7,-10]]],
  'W': [[[1,-10], [2.5,0], [4,-5], [5.5,0], [7,-10]]],
  'X': [[[1,-10], [7,0]], [[7,-10], [1,0]]],
  'Y': [[[1,-10], [4,-5], [7,-10]], [[4,-5], [4,0]]],
  'Z': [[[1,-10], [7,-10], [1,0], [7,0]]],
  ' ': []
};

export function loadFont(): Promise<opentype.Font | null> {
  if (loadedFont) return Promise.resolve(loadedFont);
  if (loadingPromise) return loadingPromise;

  loadingPromise = new Promise((resolve) => {
    fetch(LOCAL_FONT_URL)
      .then((res) => {
        if (!res.ok) throw new Error("Status " + res.status);
        return res.arrayBuffer();
      })
      .then((buffer) => {
        const font = opentype.parse(buffer);
        if (font && font.tables) {
          delete (font.tables as any).gsub;
          delete (font.tables as any).gpos;
        }
        console.log("[FontManager] Successfully loaded local Outfit-Bold.ttf font via opentype.parse!");
        loadedFont = font;
        resolve(font);
      })
      .catch((err) => {
        console.warn("[FontManager] Local font load failed, trying CDN fallback:", err);
        fetch(CDN_FONT_URL)
          .then((res) => {
            if (!res.ok) throw new Error("Status " + res.status);
            return res.arrayBuffer();
          })
          .then((buffer) => {
            const font2 = opentype.parse(buffer);
            if (font2 && font2.tables) {
              delete (font2.tables as any).gsub;
              delete (font2.tables as any).gpos;
            }
            console.log("[FontManager] Successfully loaded CDN font via opentype.parse!");
            loadedFont = font2;
            resolve(font2);
          })
          .catch((err2) => {
            console.warn("[FontManager] CDN font load failed, using vector fallback:", err2);
            resolve(null);
          });
      });
  });

  return loadingPromise;
}

export function isFontLoaded(): boolean {
  return !!loadedFont;
}

export function getFont(): opentype.Font | null {
  return loadedFont;
}

function drawFallbackGlyphs(
  ctx: CanvasRenderingContext2D | any,
  text: string,
  fontSize: number,
  counterClockwise: boolean
): boolean {
  const scaleX = (fontSize * 0.6) / 10;
  const scaleY = fontSize / 10;
  let currentX = 0;

  for (let i = 0; i < text.length; i++) {
    const char = text[i].toUpperCase();
    const polylines = CHAR_PATHS[char] || [];
    for (const poly of polylines) {
      if (poly.length > 0) {
        if (!counterClockwise) {
          ctx.moveTo((currentX + poly[0][0]) * scaleX, poly[0][1] * scaleY);
          for (let j = 1; j < poly.length; j++) {
            ctx.lineTo((currentX + poly[j][0]) * scaleX, poly[j][1] * scaleY);
          }
        } else {
          const len = poly.length;
          ctx.moveTo((currentX + poly[len - 1][0]) * scaleX, poly[len - 1][1] * scaleY);
          for (let j = len - 2; j >= 0; j--) {
            ctx.lineTo((currentX + poly[j][0]) * scaleX, poly[j][1] * scaleY);
          }
        }
      }
    }
    currentX += 10;
  }
  return true;
}

/**
 * Draws text glyph Bezier paths to a Canvas 2D context.
 * Supports forward (clockwise) and reverse (counter-clockwise) path drawing for non-zero winding clip masks.
 */
export function drawTextGlyphsToContext(
  ctx: CanvasRenderingContext2D | any,
  text: string,
  fontSize: number = 14,
  counterClockwise: boolean = false
): boolean {
  if (!loadedFont) {
    return drawFallbackGlyphs(ctx, text, fontSize, counterClockwise);
  }

  try {
    const path = loadedFont.getPath(text, 0, 0, fontSize);
    if (!path || !path.commands || path.commands.length === 0) {
      return drawFallbackGlyphs(ctx, text, fontSize, counterClockwise);
    }

    if (!counterClockwise) {
      for (const cmd of path.commands) {
        switch (cmd.type) {
          case "M":
            ctx.moveTo(cmd.x, cmd.y);
            break;
          case "L":
            ctx.lineTo(cmd.x, cmd.y);
            break;
          case "Q":
            ctx.quadraticCurveTo(cmd.x1, cmd.y1, cmd.x, cmd.y);
            break;
          case "C":
            ctx.bezierCurveTo(cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y);
            break;
          case "Z":
            ctx.closePath();
            break;
        }
      }
    } else {
      // Split commands into individual closed subpaths
      const subpaths: any[][] = [];
      let currentSubpath: any[] = [];

      for (const cmd of path.commands) {
        if (cmd.type === "M") {
          if (currentSubpath.length > 0) {
            subpaths.push(currentSubpath);
          }
          currentSubpath = [cmd];
        } else {
          currentSubpath.push(cmd);
        }
      }
      if (currentSubpath.length > 0) {
        subpaths.push(currentSubpath);
      }

      // Reverse drawing commands for counter-clockwise subtraction in clip masks
      for (const sub of subpaths) {
        const n = sub.length;
        if (n === 0) continue;

        const points: { x: number; y: number }[] = [];
        let curX = 0;
        let curY = 0;
        for (let i = 0; i < n; i++) {
          const cmd = sub[i];
          if (cmd.type === "M") {
            curX = cmd.x;
            curY = cmd.y;
          } else if (cmd.type === "Z") {
            curX = (sub[0] as any).x;
            curY = (sub[0] as any).y;
          } else {
            curX = cmd.x;
            curY = cmd.y;
          }
          points.push({ x: curX, y: curY });
        }

        const lastPt = points[n - 1];
        ctx.moveTo(lastPt.x, lastPt.y);

        for (let i = n - 1; i >= 1; i--) {
          const cmd = sub[i];
          const prevPt = points[i - 1];
          switch (cmd.type) {
            case "L":
              ctx.lineTo(prevPt.x, prevPt.y);
              break;
            case "Q":
              ctx.quadraticCurveTo(cmd.x1, cmd.y1, prevPt.x, prevPt.y);
              break;
            case "C":
              ctx.bezierCurveTo(cmd.x2, cmd.y2, cmd.x1, cmd.y1, prevPt.x, prevPt.y);
              break;
            case "Z":
              ctx.lineTo(prevPt.x, prevPt.y);
              break;
          }
        }
        if (sub[n - 1].type === "Z") {
          ctx.closePath();
        }
      }
    }
    return true;
  } catch (err) {
    console.warn("[FontManager] Error rendering opentype path, using fallback:", err);
    return drawFallbackGlyphs(ctx, text, fontSize, counterClockwise);
  }
}

/**
 * Returns SVG path 'd' string for a text string using opentype.js font glyph outlines.
 */
export function getTextGlyphSVGPath(text: string, fontSize: number = 14): string | null {
  if (!loadedFont) {
    const scaleX = (fontSize * 0.6) / 10;
    const scaleY = fontSize / 10;
    let pathData = "";
    let currentX = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text[i].toUpperCase();
      const polylines = CHAR_PATHS[char] || [];
      for (const poly of polylines) {
        if (poly.length > 0) {
          pathData += ` M ${(currentX + poly[0][0]) * scaleX} ${poly[0][1] * scaleY}`;
          for (let j = 1; j < poly.length; j++) {
            pathData += ` L ${(currentX + poly[j][0]) * scaleX} ${poly[j][1] * scaleY}`;
          }
        }
      }
      currentX += 10;
    }
    return pathData || null;
  }

  try {
    const path = loadedFont.getPath(text, 0, 0, fontSize);
    return path.toPathData(3);
  } catch (err) {
    return null;
  }
}

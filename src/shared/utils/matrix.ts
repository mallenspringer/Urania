// 2D Affine Transformation Matrix for scene graph coordinate calculations
// Represents standard 3x3 transformation matrix:
// [ a  c  tx ]
// [ b  d  ty ]
// [ 0  0   1 ]

import type { Transform } from "../types/project";

export class Matrix2D {
  public a: number;
  public b: number;
  public c: number;
  public d: number;
  public tx: number;
  public ty: number;

  constructor(
    a = 1,
    b = 0,
    c = 0,
    d = 1,
    tx = 0,
    ty = 0
  ) {
    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
    this.tx = tx;
    this.ty = ty;
  }


  static identity(): Matrix2D {
    return new Matrix2D(1, 0, 0, 1, 0, 0);
  }

  translate(x: number, y: number): Matrix2D {
    return new Matrix2D(
      this.a,
      this.b,
      this.c,
      this.d,
      this.tx + x * this.a + y * this.c,
      this.ty + x * this.b + y * this.d
    );
  }

  rotate(degrees: number): Matrix2D {
    const rad = (degrees * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    return new Matrix2D(
      this.a * cos + this.c * sin,
      this.b * cos + this.d * sin,
      this.a * -sin + this.c * cos,
      this.b * -sin + this.d * cos,
      this.tx,
      this.ty
    );
  }

  scale(sx: number, sy: number): Matrix2D {
    return new Matrix2D(
      this.a * sx,
      this.b * sx,
      this.c * sy,
      this.d * sy,
      this.tx,
      this.ty
    );
  }

  multiply(m: Matrix2D): Matrix2D {
    return new Matrix2D(
      this.a * m.a + this.c * m.b,
      this.b * m.a + this.d * m.b,
      this.a * m.c + this.c * m.d,
      this.b * m.c + this.d * m.d,
      this.a * m.tx + this.c * m.ty + this.tx,
      this.b * m.tx + this.d * m.ty + this.ty
    );
  }

  transformPoint(x: number, y: number): { x: number; y: number } {
    return {
      x: x * this.a + y * this.c + this.tx,
      y: x * this.b + y * this.d + this.ty,
    };
  }

  /**
   * Decomposes the transform matrix back into standard transform components.
   * Angles are normalized to be within the range [0, 360).
   */
  decompose(): Transform {
    const x = this.tx;
    const y = this.ty;

    const denom = this.a * this.a + this.b * this.b;
    const scaleX = Math.sqrt(denom);
    const scaleY = (this.a * this.d - this.b * this.c) / scaleX;

    let rotation = Math.atan2(this.b, this.a) * (180 / Math.PI);
    if (rotation < 0) {
      rotation += 360;
    }

    return {
      x,
      y,
      rotation: rotation === 0 ? 0 : rotation,
      scaleX,
      scaleY,
    };
  }
}

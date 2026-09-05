import type { ClipTransform } from "@/types/timeline";

/**
 * Builds a column-major 3x3 affine matrix (as a 9-element Float32Array, WebGL's `mat3` layout)
 * that maps a unit quad — corners at (-0.5, -0.5) to (0.5, 0.5) in local space — to its final
 * position in clip space [-1, 1], for compositing one clip's decoded frame onto the canvas.
 *
 * `transform.x`/`transform.y` are the clip's center offset from the canvas center, in source
 * pixels — the natural convention for placing a picture-in-picture overlay. The pipeline is
 * scale (by source dimensions and the clip's own scaleX/scaleY) -> rotate -> translate -> convert
 * to NDC, with a Y-flip in the NDC step since canvas pixel space grows downward.
 */
export function computeQuadMatrix(
  transform: ClipTransform,
  sourceWidth: number,
  sourceHeight: number,
  canvasWidth: number,
  canvasHeight: number,
): Float32Array {
  const rad = (transform.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const scaledW = sourceWidth * transform.scaleX;
  const scaledH = sourceHeight * transform.scaleY;
  const ndcX = 2 / canvasWidth;
  const ndcY = -2 / canvasHeight;

  // Column-major mat3: columns are [a, b, 0], [c, d, 0], [tx, ty, 1].
  // Equivalent to NDC * Translate(transform.x, transform.y) * Rotate(rad) * Scale(scaledW, scaledH).
  const a = cos * scaledW * ndcX;
  const b = sin * scaledW * ndcY;
  const c = -sin * scaledH * ndcX;
  const d = cos * scaledH * ndcY;
  const tx = transform.x * ndcX;
  const ty = transform.y * ndcY;

  return new Float32Array([a, b, 0, c, d, 0, tx, ty, 1]);
}

/** Applies a column-major 3x3 matrix to a homogeneous 2D point; used by tests and by any future
 *  on-canvas transform gizmo that needs to hit-test against the same math the shader uses. */
export function applyMatrix3(matrix: Float32Array, x: number, y: number): [number, number] {
  const resultX = matrix[0]! * x + matrix[3]! * y + matrix[6]!;
  const resultY = matrix[1]! * x + matrix[4]! * y + matrix[7]!;
  return [resultX, resultY];
}

export function identityTransform(): ClipTransform {
  return { x: 0, y: 0, scaleX: 1, scaleY: 1, rotationDeg: 0 };
}

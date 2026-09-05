import { describe, expect, it } from "vitest";
import { applyMatrix3, computeQuadMatrix, identityTransform } from "./transform";

describe("computeQuadMatrix", () => {
  it("maps the unit quad to scaled pixel extents converted to NDC, for the identity transform", () => {
    // source 100x50 on a 200x100 canvas: ndcX = 2/200 = 0.01, ndcY = -2/100 = -0.02
    const matrix = computeQuadMatrix(identityTransform(), 100, 50, 200, 100);

    const [x1, y1] = applyMatrix3(matrix, 0.5, 0.5);
    expect(x1).toBeCloseTo(0.5); // 50px * 0.01
    expect(y1).toBeCloseTo(-0.5); // 25px * -0.02 (Y flipped)

    const [x2, y2] = applyMatrix3(matrix, -0.5, -0.5);
    expect(x2).toBeCloseTo(-0.5);
    expect(y2).toBeCloseTo(0.5);
  });

  it("offsets the quad center by transform.x/transform.y in NDC", () => {
    const matrix = computeQuadMatrix({ ...identityTransform(), x: 50 }, 100, 50, 200, 100);
    const [centerX] = applyMatrix3(matrix, 0, 0);
    expect(centerX).toBeCloseTo(0.5); // half the canvas width, shifted right
  });

  it("shrinks the mapped extent when scaleX/scaleY are below 1", () => {
    const full = computeQuadMatrix(identityTransform(), 100, 50, 200, 100);
    const half = computeQuadMatrix({ ...identityTransform(), scaleX: 0.5, scaleY: 0.5 }, 100, 50, 200, 100);

    const [fullX] = applyMatrix3(full, 0.5, 0);
    const [halfX] = applyMatrix3(half, 0.5, 0);
    expect(halfX).toBeCloseTo(fullX / 2);
  });

  it("rotates 180 degrees by negating both axes", () => {
    const matrix = computeQuadMatrix({ ...identityTransform(), rotationDeg: 180 }, 100, 50, 200, 100);
    const identity = computeQuadMatrix(identityTransform(), 100, 50, 200, 100);

    const [rx, ry] = applyMatrix3(matrix, 0.5, 0.25);
    const [ix, iy] = applyMatrix3(identity, 0.5, 0.25);
    expect(rx).toBeCloseTo(-ix);
    expect(ry).toBeCloseTo(-iy);
  });
});

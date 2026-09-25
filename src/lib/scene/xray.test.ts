import { describe, expect, it } from 'vitest';
import { boundingRadius, xraySliceCutoff, zoomSliceFraction } from './xray';

describe('zoomSliceFraction', () => {
  it('slices nothing when zoomed out relative to the build', () => {
    expect(zoomSliceFraction(20, 5)).toBe(0); // ratio 4, way past the no-slice threshold
  });

  it('slices at (near) the max fraction when zoomed in close relative to the build', () => {
    expect(zoomSliceFraction(1, 5)).toBeCloseTo(0.85, 5); // ratio 0.2, past the max-slice threshold
  });

  it('interpolates smoothly in between, monotonically increasing as you zoom in', () => {
    const far = zoomSliceFraction(6, 5); // ratio 1.2 — right at the no-slice edge
    const mid = zoomSliceFraction(3.75, 5); // ratio 0.75 — halfway between the two thresholds
    const near = zoomSliceFraction(1.5, 5); // ratio 0.3 — right at the max-slice edge
    expect(far).toBeLessThan(mid);
    expect(mid).toBeLessThan(near);
    expect(near).toBeCloseTo(0.85, 5);
  });

  it('is scale-invariant: doubling both camera distance and structure radius gives the same fraction', () => {
    expect(zoomSliceFraction(10, 8)).toBeCloseTo(zoomSliceFraction(20, 16), 10);
  });

  it('never blows up for a near-zero-radius (single-piece) build', () => {
    expect(() => zoomSliceFraction(5, 0)).not.toThrow();
    expect(zoomSliceFraction(5, 0)).toBeGreaterThanOrEqual(0);
    expect(zoomSliceFraction(5, 0)).toBeLessThanOrEqual(0.85);
  });
});

describe('xraySliceCutoff', () => {
  it('returns depthMin when the slice fraction is 0 (nothing faded)', () => {
    expect(xraySliceCutoff(2, 10, 0)).toBe(2);
  });

  it('returns the weighted point between depthMin and depthMax for a partial fraction', () => {
    expect(xraySliceCutoff(0, 10, 0.5)).toBe(5);
    expect(xraySliceCutoff(0, 10, 0.85)).toBeCloseTo(8.5, 5);
  });
});

describe('boundingRadius', () => {
  it('floors to a minimum radius for zero or one points', () => {
    expect(boundingRadius([])).toBe(0.5);
    expect(boundingRadius([{ x: 1, y: 1, z: 1 }])).toBe(0.5);
  });

  it('returns half the AABB diagonal for a spread-out set of points', () => {
    // A 4x4x4 cube from (-2,-2,-2) to (2,2,2): diagonal = sqrt(4^2*3) ≈ 6.93, half ≈ 3.46
    const points = [
      { x: -2, y: -2, z: -2 },
      { x: 2, y: 2, z: 2 },
    ];
    expect(boundingRadius(points)).toBeCloseTo(3.4641, 3);
  });

  it('is unaffected by point order', () => {
    const a = [{ x: -3, y: 0, z: 0 }, { x: 3, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }];
    const b = [{ x: 0, y: 1, z: 0 }, { x: 3, y: 0, z: 0 }, { x: -3, y: 0, z: 0 }];
    expect(boundingRadius(a)).toBeCloseTo(boundingRadius(b), 10);
  });
});

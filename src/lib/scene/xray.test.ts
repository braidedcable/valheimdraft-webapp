import { describe, expect, it } from 'vitest';
import { heightWeightedDepth, isInEdgeBand, xraySliceCutoff, zoomSliceFraction } from './xray';

describe('zoomSliceFraction', () => {
  it('slices nothing when the nearest piece is still far from the camera', () => {
    expect(zoomSliceFraction(30)).toBe(0);
    expect(zoomSliceFraction(26)).toBe(0); // exactly at the no-slice threshold
  });

  it('slices at the max fraction once the camera is very close to the nearest piece', () => {
    expect(zoomSliceFraction(2)).toBeCloseTo(0.92, 5); // exactly at the max-slice threshold
    expect(zoomSliceFraction(0.5)).toBeCloseTo(0.92, 5); // even closer — still clamped, not overshooting
  });

  it('interpolates smoothly in between, monotonically increasing as you zoom in', () => {
    const far = zoomSliceFraction(22);
    const mid = zoomSliceFraction(14); // halfway between the two thresholds
    const near = zoomSliceFraction(6);
    expect(far).toBeLessThan(mid);
    expect(mid).toBeLessThan(near);
  });

  it('already shows a little something right at the default Iso-preset distance, not just after zooming in', () => {
    // Per direct feedback: x-ray is opt-in and reversible (toggle off to
    // see the solid exterior again), so it should start sooner rather than
    // requiring zoom-in first. Iso puts the nearest piece ~21 units out.
    expect(zoomSliceFraction(21)).toBeGreaterThan(0);
  });
});

describe('xraySliceCutoff', () => {
  it('returns depthMin when the slice fraction is 0 (nothing faded)', () => {
    expect(xraySliceCutoff(2, 10, 0)).toBe(2);
  });

  it('returns the weighted point between depthMin and depthMax for a partial fraction', () => {
    expect(xraySliceCutoff(0, 10, 0.5)).toBe(5);
    expect(xraySliceCutoff(0, 10, 0.92)).toBeCloseTo(9.2, 5);
  });
});

describe('heightWeightedDepth', () => {
  it('leaves depth unchanged for a piece at the build\'s own lowest height', () => {
    expect(heightWeightedDepth(20, 0)).toBe(20);
  });

  it('reduces effective depth for a piece higher up, making it "seem closer" and fade sooner', () => {
    const floorDepth = heightWeightedDepth(20, 0);
    const roofDepth = heightWeightedDepth(20, 2.5); // a room-height's worth above the floor
    expect(roofDepth).toBeLessThan(floorDepth);
  });

  it('scales linearly with height (weight of 2 depth-units per world unit of height)', () => {
    expect(heightWeightedDepth(20, 1)).toBeCloseTo(18, 5);
    expect(heightWeightedDepth(20, 2)).toBeCloseTo(16, 5);
    expect(heightWeightedDepth(20, 2) - heightWeightedDepth(20, 1)).toBeCloseTo(-2, 5);
  });

  it('same-story roof-vs-floor separation is a meaningful fraction of the zoom range, not negligible or dominant', () => {
    // Real wall height (~2.1m) worth of separation shouldn't swamp the ~24
    // unit DEPTH_NO_SLICE..DEPTH_MAX_SLICE gap, nor be so small it's
    // imperceptible against it.
    const separation = heightWeightedDepth(20, 0) - heightWeightedDepth(20, 2.1);
    expect(separation).toBeGreaterThan(1);
    expect(separation).toBeLessThan(12); // well under the 24-unit total zoom-range span
  });
});

describe('isInEdgeBand', () => {
  it('is false dead center', () => {
    expect(isInEdgeBand(0, 0)).toBe(false);
  });

  it('is false throughout most of the middle of the screen', () => {
    expect(isInEdgeBand(0.5, 0.5)).toBe(false);
    expect(isInEdgeBand(0.74, 0)).toBe(false);
    expect(isInEdgeBand(0, -0.74)).toBe(false);
  });

  it('is true right at and beyond the edge threshold, on either axis independently', () => {
    expect(isInEdgeBand(0.75, 0)).toBe(true);
    expect(isInEdgeBand(0, -0.75)).toBe(true);
    expect(isInEdgeBand(0.9, 0)).toBe(true);
    expect(isInEdgeBand(-1, 0.2)).toBe(true); // clamped-range NDC edge/corner
  });

  it('is true in a screen corner (both axes past the threshold)', () => {
    expect(isInEdgeBand(0.8, 0.8)).toBe(true);
  });
});

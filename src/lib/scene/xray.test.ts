import { describe, expect, it } from 'vitest';
import { xraySliceCutoff, zoomSliceFraction } from './xray';

describe('zoomSliceFraction', () => {
  it('slices nothing when the nearest piece is still far from the camera', () => {
    expect(zoomSliceFraction(20)).toBe(0);
    expect(zoomSliceFraction(10)).toBe(0); // exactly at the no-slice threshold
  });

  it('slices at the max fraction once the camera is very close to the nearest piece', () => {
    expect(zoomSliceFraction(2.5)).toBeCloseTo(0.85, 5); // exactly at the max-slice threshold
    expect(zoomSliceFraction(0.5)).toBeCloseTo(0.85, 5); // even closer — still clamped, not overshooting
  });

  it('interpolates smoothly in between, monotonically increasing as you zoom in', () => {
    const far = zoomSliceFraction(9);
    const mid = zoomSliceFraction(6.25); // halfway between the two thresholds
    const near = zoomSliceFraction(3);
    expect(far).toBeLessThan(mid);
    expect(mid).toBeLessThan(near);
  });

  it('matches the default Iso-preset camera distance (~24 units) producing zero slicing for realistically sized builds', () => {
    // Regression guard for the actual bug reported: a build's nearest piece
    // sitting tens of units from the camera (the ordinary default-zoom
    // case) must never fade anything.
    expect(zoomSliceFraction(24.25)).toBe(0);
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

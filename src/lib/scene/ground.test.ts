import { describe, it, expect } from 'vitest';
import {
  GROUND_STEP,
  MAX_GROUND_LEVEL,
  sanitizeGroundLevel,
  groundLevelToY,
  stepGroundLevel,
  isCameraBelowGround,
  groundOpacity,
  ghostRestY,
  canFlattenForward,
  groundSize,
  MIN_GROUND_CELLS,
  GRID_CELL,
  GROUND_EDGE_MARGIN,
} from './ground';

describe('ground', () => {
  it('sanitizes levels', () => {
    expect(sanitizeGroundLevel(3)).toBe(3);
    expect(sanitizeGroundLevel(2.6)).toBe(3);
    expect(sanitizeGroundLevel('x')).toBe(0);
    expect(sanitizeGroundLevel(NaN)).toBe(0);
    expect(sanitizeGroundLevel(1e9)).toBe(MAX_GROUND_LEVEL);
    expect(sanitizeGroundLevel(-1e9)).toBe(-MAX_GROUND_LEVEL);
    expect(Object.is(sanitizeGroundLevel(-0.2), 0)).toBe(true);
  });
  it('maps level to y and steps', () => {
    expect(groundLevelToY(4)).toBe(4 * GROUND_STEP);
    expect(stepGroundLevel(0, -1)).toBe(-1);
    expect(stepGroundLevel(MAX_GROUND_LEVEL, 1)).toBe(MAX_GROUND_LEVEL);
  });
  it('detects camera below ground', () => {
    expect(isCameraBelowGround(-1, 0)).toBe(true);
    expect(isCameraBelowGround(0, 0)).toBe(false);
    expect(isCameraBelowGround(5, 6)).toBe(true);
  });
  it('ground is translucent from below', () => {
    expect(groundOpacity(false)).toBe(1);
    expect(groundOpacity(true)).toBeLessThan(1);
    expect(groundOpacity(true)).toBeGreaterThan(0);
  });
  it('ground is translucent above too when x-ray is on', () => {
    expect(groundOpacity(false, true)).toBe(groundOpacity(true));
  });
  it('rests on surface looking down, hangs looking up', () => {
    expect(ghostRestY(2, -0.5, 4, 0)).toBe(4);
    expect(ghostRestY(2, -0.5, 4, 1)).toBe(3);
    expect(ghostRestY(2, 0.5, 4, 0)).toBe(0);
    expect(ghostRestY(2, 0, 4, 0)).toBe(4);
  });
  it('flatten guard', () => {
    expect(canFlattenForward(0, 0)).toBe(false);
    expect(canFlattenForward(0, 1)).toBe(true);
  });
});

describe('groundSize', () => {
  it('defaults to an odd cell count centred on a cell', () => {
    expect(groundSize([])).toBe(MIN_GROUND_CELLS * GRID_CELL);
    expect(MIN_GROUND_CELLS % 2).toBe(1);
  });
  it('stays default for builds well inside', () => {
    expect(groundSize([{ x: 10, z: -10, radius: 2 }])).toBe(MIN_GROUND_CELLS * GRID_CELL);
  });
  it('grows symmetrically, keeping an odd cell count and the margin', () => {
    for (const x of [25, 27, 40, 100.5]) {
      const size = groundSize([{ x, z: 0, radius: 1 }]);
      expect(size / GRID_CELL % 2).toBe(1);
      expect(size / 2).toBeGreaterThanOrEqual(x + 1 + GROUND_EDGE_MARGIN);
      expect(size).toBeGreaterThan(MIN_GROUND_CELLS * GRID_CELL);
    }
  });
  it('uses the most distant axis and negative coordinates', () => {
    expect(groundSize([{ x: 0, z: -60, radius: 0 }])).toBe(groundSize([{ x: 60, z: 0, radius: 0 }]));
  });
});

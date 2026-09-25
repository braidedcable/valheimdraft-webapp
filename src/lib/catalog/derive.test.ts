import { describe, expect, it } from 'vitest';
import { classify } from './derive';
import { geometryForPiece } from '../scene/geometry';
import { MATERIAL_FAMILY_COLORS } from '../scene/materials';
import piecesData from '../../data/pieces.json';
import type { PieceData, PieceShape, SnapPoint, Vec3 } from './types';

function sp(x: number, y: number, z: number): SnapPoint {
  return { pos: { x, y, z }, rot: { x: 0, y: 0, z: 0, w: 1 } };
}

// Generic bounds that safely envelope every synthetic snap-point fixture
// below (so the sub-mesh-bounds SUSPICIOUS rule doesn't fire before the
// pattern-dispatch logic under test even runs) — tests that specifically
// exercise the bounds/pivot sanity checks use their own tailored bounds.
const BOUNDS: Vec3 = { x: 3, y: 3, z: 3 };
const CENTER: Vec3 = { x: 0, y: 0, z: 0 };

describe('classify — snap-pattern dispatch', () => {
  it('4 corners at a single height → box', () => {
    const c = classify('test_floor', BOUNDS, CENTER, [sp(1, 0, 1), sp(-1, 0, 1), sp(1, 0, -1), sp(-1, 0, -1)]);
    expect(c.verdict).toBe('CLEAN');
    expect(c.shape).toBe('box');
  });

  it('4 corners, 2/2 height split with NO depth correlation → box, not wedge (the woodwall/plain-wall case)', () => {
    const c = classify('test_wall', BOUNDS, CENTER, [sp(1, 1, 0), sp(-1, 1, 0), sp(1, -1, 0), sp(-1, -1, 0)]);
    expect(c.verdict).toBe('CLEAN');
    expect(c.shape).toBe('box');
  });

  it('4 corners, 2/2 height split WITH depth correlation → wedge (a real sloped roof panel)', () => {
    const c = classify('test_roof', BOUNDS, CENTER, [sp(1, 1, -1), sp(-1, 1, -1), sp(1, 0, 1), sp(-1, 0, 1)]);
    expect(c.verdict).toBe('CLEAN');
    expect(c.shape).toBe('wedge');
    expect(c.geom?.kind).toBe('wedge');
  });

  it('4 corners, 3/1 height split → hip, with the odd corner recorded', () => {
    const c = classify('test_ocorner', BOUNDS, CENTER, [sp(-1, 1, -1), sp(1, 0, -1), sp(1, 0, 1), sp(-1, 0, 1)]);
    expect(c.verdict).toBe('CLEAN');
    expect(c.shape).toBe('hip');
    expect(c.geom).toEqual({ kind: 'corner', odd: 'A' });
  });

  it('4 corners, 1/3 height split → valley', () => {
    const c = classify('test_icorner', BOUNDS, CENTER, [sp(1, 1, -1), sp(-1, 1, -1), sp(-1, 1, 1), sp(1, 0, 1)]);
    expect(c.verdict).toBe('CLEAN');
    expect(c.shape).toBe('valley');
    expect(c.geom).toEqual({ kind: 'corner', odd: 'C' });
  });

  it('2 diagonal snap points → beam', () => {
    const c = classify('test_beam_45', BOUNDS, CENTER, [sp(-1, -1, 0), sp(1, 1, 0)]);
    expect(c.verdict).toBe('CLEAN');
    expect(c.shape).toBe('beam');
    expect(c.geom?.kind).toBe('beam');
  });

  it('2 snap points on one horizontal axis → box', () => {
    const c = classify('test_beam', BOUNDS, CENTER, [sp(-1, 0, 0), sp(1, 0, 0)]);
    expect(c.verdict).toBe('CLEAN');
    expect(c.shape).toBe('box');
  });

  it('2 vertical snap points, round cross-section → cylinder', () => {
    const c = classify('test_pole_log', { x: 0.3, y: 2, z: 0.3 }, CENTER, [sp(0, 1, 0), sp(0, -1, 0)]);
    expect(c.verdict).toBe('CLEAN');
    expect(c.shape).toBe('cylinder');
  });

  it('3 snap points → triangle (gable)', () => {
    // Center set to the point cloud's own bbox middle (0,1,0), same as a
    // real asymmetric gable piece's extracted center would be — an
    // off-origin CENTER here isn't a bug, it's what makes this fixture
    // representative of the real off-center-pivot case.
    const c = classify('test_wall_roof_45', BOUNDS, { x: 0, y: 1, z: 0 }, [sp(1, 0, 0), sp(-1, 0, 0), sp(1, 2, 0)]);
    expect(c.verdict).toBe('CLEAN');
    expect(c.shape).toBe('triangle');
  });

  it('5 snap points (4 corners + center) → cross', () => {
    const c = classify('test_wall_roof_top', BOUNDS, { x: 0, y: 1, z: 0 }, [
      sp(1, 0, 0),
      sp(-1, 0, 0),
      sp(0, 1, 0),
      sp(1, 2, 0),
      sp(-1, 2, 0),
    ]);
    expect(c.verdict).toBe('CLEAN');
    expect(c.shape).toBe('cross');
  });

  it('6 snap points (4 eave + 2 ridge) → ridge', () => {
    const c = classify('test_roof_top_45', BOUNDS, CENTER, [
      sp(1, 0, -1),
      sp(1, 0, 1),
      sp(-1, 0, -1),
      sp(-1, 0, 1),
      sp(1, 0.5, 0),
      sp(-1, 0.5, 0),
    ]);
    expect(c.verdict).toBe('CLEAN');
    expect(c.shape).toBe('ridge');
  });

  it('8 corner snap points → box', () => {
    const pts = [1, -1].flatMap((x) => [1, -1].flatMap((y) => [1, -1].map((z) => sp(x, y, z))));
    const c = classify('test_pillar', BOUNDS, CENTER, pts);
    expect(c.verdict).toBe('CLEAN');
    expect(c.shape).toBe('box');
  });
});

describe('classify — functional-name handling', () => {
  it('a *_door prefab with no dedicated shape → NEEDS_NEW_SHAPE', () => {
    const c = classify('test_door', BOUNDS, CENTER, [sp(1, 1, 0), sp(-1, 1, 0), sp(1, -1, 0), sp(-1, -1, 0)]);
    expect(c.verdict).toBe('NEEDS_NEW_SHAPE');
    expect(c.shape).toBeNull();
  });

  it('a *_stair prefab uses the existing stairs shape, not NEEDS_NEW_SHAPE', () => {
    const c = classify('test_stair', BOUNDS, CENTER, [sp(1, 1, 0), sp(-1, 1, 0), sp(1, -1, 0), sp(-1, -1, 0)]);
    expect(c.verdict).toBe('CLEAN');
    expect(c.shape).toBe('stairs');
  });

  it('a *_ladder prefab uses the existing ladder shape', () => {
    const c = classify('test_ladder', BOUNDS, CENTER, [sp(1, 1, 0), sp(-1, 1, 0), sp(1, -1, 0), sp(-1, -1, 0)]);
    expect(c.verdict).toBe('CLEAN');
    expect(c.shape).toBe('ladder');
  });
});

describe('classify — bounds/pivot sanity flags', () => {
  it('flags sub-mesh bounds (snap extent far exceeds bounds on an axis)', () => {
    const c = classify('test_gate', { x: 0.3, y: 3, z: 0.5 }, { x: 0.85, y: 0.5, z: 0 }, [
      sp(1, 1, 0),
      sp(1, -1, 0),
      sp(1, 2, 0),
      sp(-1, -1, 0),
    ]);
    expect(c.verdict).toBe('SUSPICIOUS');
  });

  it('flags an oversized piece (a bounds axis over 6m)', () => {
    const c = classify('test_drawbridge', { x: 6.5, y: 11.7, z: 4.6 }, CENTER, [
      sp(1, 0, 1),
      sp(-1, 0, 1),
      sp(1, 0, -1),
      sp(-1, 0, -1),
    ]);
    expect(c.verdict).toBe('SUSPICIOUS');
  });
});

describe('catalog integrity — every generated piece', () => {
  const pieces = piecesData.pieces as unknown as PieceData[];

  it('is non-empty (the generator actually ran and produced batch-1 output)', () => {
    expect(pieces.length).toBeGreaterThan(0);
  });

  it('every piece has a family with a registered render color', () => {
    for (const piece of pieces) {
      expect(MATERIAL_FAMILY_COLORS, `${piece.prefab}: family "${piece.family}" has no color`).toHaveProperty(piece.family);
    }
  });

  const KNOWN_SHAPES: PieceShape[] = [
    'box',
    'cylinder',
    'wedge',
    'stairs',
    'ladder',
    'fence',
    'hip',
    'valley',
    'beam',
    'triangle',
    'cross',
    'ridge',
    'arch',
    'lattice',
    'door',
  ];

  it('every piece has a known shape', () => {
    for (const piece of pieces) {
      expect(KNOWN_SHAPES, `${piece.prefab}: unknown shape "${piece.shape}"`).toContain(piece.shape);
    }
  });

  it('geometryForPiece builds every piece with finite, non-NaN vertex positions', () => {
    for (const piece of pieces) {
      const geometry = geometryForPiece(piece);
      const positions = geometry.getAttribute('position');
      expect(positions, `${piece.prefab}: no position attribute`).toBeDefined();
      for (let i = 0; i < positions.array.length; i++) {
        expect(Number.isFinite(positions.array[i]), `${piece.prefab}: non-finite vertex value`).toBe(true);
      }
    }
  });
});

// Freezes the 18 original wood-tier MVP pieces' render-critical fields
// (shape/family/bounds/center) exactly as they were before the catalog
// generator existed — see scripts/catalog-overrides.json's "pinned" entries,
// which this independently double-checks against the values that shipped in
// the original hand-built src/data/pieces.json. Labels are NOT pinned (the
// catalog expansion switched everything to in-game names), so this only
// checks the fields that affect what gets rendered.
describe('catalog integrity — the 18 original MVP pieces are unchanged', () => {
  const ORIGINAL: Record<string, { shape: PieceShape; family: string; bounds: Vec3; center: Vec3 }> = {
    wood_floor: { shape: 'box', family: 'wood', bounds: { x: 2.011942, y: 0.2208748, z: 2.00195 }, center: { x: -0.005970836, y: -0.02964314, z: -0.007599831 } },
    wood_floor_1x1: { shape: 'box', family: 'wood', bounds: { x: 1, y: 0.1000021, z: 1.000001 }, center: { x: -0.0150001, y: 0.03079224, z: -0.007599831 } },
    wood_wall_log: { shape: 'box', family: 'wood', bounds: { x: 2.439907, y: 0.529008, z: 0.5507023 }, center: { x: -0.001596689, y: 0.0002790093, z: 0 } },
    wood_wall_half: { shape: 'box', family: 'wood', bounds: { x: 2.010799, y: 1.00246, z: 0.4273766 }, center: { x: 0.005399585, y: 0, z: -0.06368825 } },
    wood_wall_quarter: { shape: 'box', family: 'wood', bounds: { x: 1.014004, y: 1.00246, z: 0.4273778 }, center: { x: 0.007001758, y: 0.5, z: -0.06368759 } },
    wood_pole: { shape: 'cylinder', family: 'wood', bounds: { x: 0.4000002, y: 1, z: 0.4 }, center: { x: 0, y: 0, z: 0 } },
    wood_pole2: { shape: 'cylinder', family: 'wood', bounds: { x: 0.4000003, y: 2, z: 0.4 }, center: { x: 0, y: 0, z: 0 } },
    wood_beam: { shape: 'box', family: 'wood', bounds: { x: 2.243754, y: 0.4, z: 0.5512928 }, center: { x: 0.004845619, y: 0, z: -2.980232e-8 } },
    wood_door: { shape: 'box', family: 'wood', bounds: { x: 2, y: 2.019858, z: 0.5 }, center: { x: 0, y: -0.00006985664, z: 0 } },
    wood_stair: { shape: 'stairs', family: 'wood', bounds: { x: 2.004185, y: 1.182492, z: 2.097736 }, center: { x: 0.000006198883, y: 0.458754, z: -0.03901148 } },
    wood_roof: { shape: 'wedge', family: 'wood', bounds: { x: 2.220491, y: 1.900459, z: 3.074555 }, center: { x: 0.02587342, y: 0.6016157, z: 0.09818316 } },
    wood_roof_icorner: { shape: 'valley', family: 'wood', bounds: { x: 2.689098, y: 1.358806, z: 2.744093 }, center: { x: 0.09945166, y: 0.5714013, z: 0.09995389 } },
    wood_roof_ocorner: { shape: 'hip', family: 'wood', bounds: { x: 2.755872, y: 1.526373, z: 2.786874 }, center: { x: 0.1270648, y: 0.5117875, z: 0.1205636 } },
    wood_roof_top: { shape: 'wedge', family: 'wood', bounds: { x: 2.209374, y: 1.026876, z: 3.079612 }, center: { x: -0.04600239, y: 0.3450727, z: 0.000003218651 } },
    wood_gate: { shape: 'box', family: 'wood', bounds: { x: 0.3, y: 3, z: 0.5 }, center: { x: 0.8499999, y: 0.5, z: 0 } },
    wood_fence: { shape: 'fence', family: 'wood', bounds: { x: 2.707283, y: 2.30124, z: 0.3122733 }, center: { x: -0.009239435, y: 0.9925511, z: 0 } },
    wood_window: { shape: 'box', family: 'wood', bounds: { x: 0.32, y: 1.05, z: 0.36 }, center: { x: -0.01000001, y: 0, z: 0 } },
    wood_stepladder: { shape: 'ladder', family: 'wood', bounds: { x: 1.000001, y: 2.156676, z: 2.156676 }, center: { x: 0, y: 0.9999999, z: 0 } },
  };

  const pieces = piecesData.pieces as unknown as PieceData[];
  const byPrefab = new Map(pieces.map((p) => [p.prefab, p]));

  for (const [prefab, expected] of Object.entries(ORIGINAL)) {
    it(`${prefab} matches its original MVP shape/family/bounds/center`, () => {
      const piece = byPrefab.get(prefab);
      expect(piece, `${prefab} missing from generated catalog`).toBeDefined();
      expect(piece!.shape).toBe(expected.shape);
      expect(piece!.family).toBe(expected.family);
      expect(piece!.bounds).toEqual(expected.bounds);
      expect(piece!.center).toEqual(expected.center);
      expect(piece!.geom).toBeUndefined();
    });
  }
});

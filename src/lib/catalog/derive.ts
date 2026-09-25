// Pure, THREE-free classification and shape-derivation logic for the piece
// catalog. Shared by scripts/build-catalog.ts (the generator) and
// derive.test.ts (vitest) — this module never changes based on where it
// runs, so the report the generator prints and the tests that check it stay
// in sync.
import type { PieceShape, ShapeParams, SnapPoint, Vec3 } from './types.js';

// --- minimal vector math (no THREE dependency, see module comment) ---
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const scale = (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const length = (a: Vec3): number => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
const dist = (a: Vec3, b: Vec3): number => length(sub(a, b));
const EPS = 1e-3;

function boxFromPoints(points: Vec3[]): { min: Vec3; max: Vec3; size: Vec3; center: Vec3 } {
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const p of points) {
    min.x = Math.min(min.x, p.x);
    min.y = Math.min(min.y, p.y);
    min.z = Math.min(min.z, p.z);
    max.x = Math.max(max.x, p.x);
    max.y = Math.max(max.y, p.y);
    max.z = Math.max(max.z, p.z);
  }
  const size = sub(max, min);
  const center = scale(add(min, max), 0.5);
  return { min, max, size, center };
}

export type Verdict = 'CLEAN' | 'NEEDS_NEW_SHAPE' | 'SUSPICIOUS' | 'REVIEW' | 'EXCLUDE';

export interface Classification {
  verdict: Verdict;
  shape: PieceShape | null;
  geom?: ShapeParams;
  reason: string;
}

// Names that must never render as a plain box. Two dedicated legacy shapes
// already exist for stairs and ladders — any *_stair/*_ladder prefab uses
// those directly (still checked before the generic snap-pattern dispatch,
// so a stair's box-corner-ish snap layout is never mistaken for a plain
// box). Everything else matching FUNCTIONAL_NAME has no existing shape and
// needs a new one (NEEDS_NEW_SHAPE) — this is checked before the generic
// snap-pattern dispatch too, so e.g. a 3-point arch prefab is never
// mistaken for a flat 3-point gable triangle.
const STAIR_NAME = /stair/i;
const LADDER_NAME = /ladder/i;
const FUNCTIONAL_NAME = /door|gate|grate|window|shutter|hatch|arch/i;

const ROUND_NAME = /_log|_pole/i;

function cornerLetter(x: number, z: number): 'A' | 'B' | 'C' | 'D' {
  if (x < 0 && z < 0) return 'A';
  if (x >= 0 && z < 0) return 'B';
  if (x >= 0 && z >= 0) return 'C';
  return 'D';
}

/**
 * Classifies one piece's geometry (bounds/center/snap points) into a
 * verdict + best-guess shape, per the rules in the catalog-expansion plan.
 * Pure function of the piece's own data (plus its prefab name, used only for
 * the functional-piece and round-cross-section checks below) — no override
 * knowledge here. The generator applies per-piece overrides on top of this.
 *
 * `opts.bypassFunctionalName` skips the door/gate/arch/etc. name veto (rule
 * 5) and falls through to the ordinary snap-pattern dispatch instead. For
 * pieces whose functional-sounding name is misleading — e.g. a "Grausten
 * Arched Roof" is a roof panel, not a walk-through archway — where the
 * piece's own snap points already describe a real, ordinary shape (a
 * triangle/wedge/hip/valley with a correctly *derived* geom) and forcing
 * that exact shape via a plain override isn't possible (the override
 * mechanism doesn't recompute geom for those shape kinds — see
 * scripts/catalog-overrides.json's `bypassFunctionalName` field). Only
 * meant for cases confirmed by comparing the piece's raw snap points
 * against a real sibling that already classifies correctly.
 */
export function classify(
  prefab: string,
  bounds: Vec3,
  center: Vec3,
  snapPoints: SnapPoint[],
  opts?: { bypassFunctionalName?: boolean }
): Classification {
  if (snapPoints.length === 0) {
    return { verdict: 'REVIEW', shape: null, reason: 'no snap points' };
  }

  const points = snapPoints.map((sp) => sp.pos);
  const E = boxFromPoints(points);

  for (const axis of ['x', 'y', 'z'] as const) {
    if (bounds[axis] > 0.02 && E.size[axis] > bounds[axis] * 1.5) {
      return {
        verdict: 'SUSPICIOUS',
        shape: null,
        reason: `sub-mesh bounds: snap extent ${E.size[axis].toFixed(2)} on ${axis} vs bounds ${bounds[axis].toFixed(2)}`,
      };
    }
  }

  const maxBound = Math.max(bounds.x, bounds.y, bounds.z);
  if (dist(center, E.center) > 0.3 * maxBound && maxBound > EPS) {
    return {
      verdict: 'SUSPICIOUS',
      shape: null,
      reason: `off-center pivot: center is ${dist(center, E.center).toFixed(2)}m from snap-box middle`,
    };
  }

  if (bounds.x > 6 || bounds.y > 6 || bounds.z > 6) {
    return { verdict: 'SUSPICIOUS', shape: null, reason: 'oversized: a bounds axis exceeds 6m' };
  }

  if (STAIR_NAME.test(prefab)) {
    return { verdict: 'CLEAN', shape: 'stairs', reason: 'functional piece (stair) — using the existing stairs shape' };
  }
  if (LADDER_NAME.test(prefab)) {
    return { verdict: 'CLEAN', shape: 'ladder', reason: 'functional piece (ladder) — using the existing ladder shape' };
  }
  if (FUNCTIONAL_NAME.test(prefab) && !opts?.bypassFunctionalName) {
    return {
      verdict: 'NEEDS_NEW_SHAPE',
      shape: null,
      reason: `functional piece (name matches ${FUNCTIONAL_NAME.source}) — must not render as a plain box`,
    };
  }

  const thickness = bounds.z > EPS ? bounds.z : Math.min(bounds.x, bounds.y, bounds.z) || 0.1;

  // --- dispatch on snap-point count / pattern ---
  const unique = points;

  if (unique.length === 2) {
    const [a, b] = unique;
    const delta = sub(b, a);
    const vertical = Math.abs(delta.y) > EPS;
    const horizontalSpread = Math.abs(delta.x) > EPS || Math.abs(delta.z) > EPS;
    if (vertical && horizontalSpread) {
      const round = ROUND_NAME.test(prefab) && Math.abs(bounds.x - bounds.z) < 0.05;
      const segLen = length(delta);
      const axisLen = Math.abs(delta.x) + Math.abs(delta.y) + Math.abs(delta.z);
      const projected =
        axisLen > EPS
          ? (Math.abs(delta.x) * bounds.x + Math.abs(delta.y) * bounds.y + Math.abs(delta.z) * bounds.z) / segLen
          : segLen;
      const ext = Math.max(0, (projected - segLen) / 2);
      return {
        verdict: 'CLEAN',
        shape: 'beam',
        geom: { kind: 'beam', a, b, t: thickness, round, ext },
        reason: 'snap-derived: 2 diagonal snap points',
      };
    }
    if (vertical && Math.abs(bounds.x - bounds.z) < 0.05) {
      return { verdict: 'CLEAN', shape: 'cylinder', reason: '2 vertical snap points, round cross-section' };
    }
    return { verdict: 'CLEAN', shape: 'box', reason: '2 snap points on one axis' };
  }

  if (unique.length === 3) {
    return {
      verdict: 'CLEAN',
      shape: 'triangle',
      geom: { kind: 'triangle', p: [unique[0], unique[1], unique[2]], t: thickness },
      reason: 'snap-derived: 3 snap points (gable triangle)',
    };
  }

  if (unique.length === 4) {
    const ys = unique.map((p) => p.y);
    const distinctYs = [...new Set(ys.map((y) => Math.round(y * 1000) / 1000))];

    if (distinctYs.length === 1) {
      return { verdict: 'CLEAN', shape: 'box', reason: '4 corner snap points at a single height' };
    }

    if (distinctYs.length === 2) {
      const low = Math.min(...distinctYs);
      const high = Math.max(...distinctYs);
      const lowPts = unique.filter((p) => Math.abs(p.y - low) < EPS);
      const highPts = unique.filter((p) => Math.abs(p.y - high) < EPS);

      if (lowPts.length === 2 && highPts.length === 2) {
        // A 2/2 height split alone doesn't mean a slope — a plain vertical
        // wall also has 2 corners low and 2 high (e.g. woodwall: y=±1, but
        // BOTH groups sit at z=0). What makes it a genuine sloped plane is
        // the height difference correlating with a DEPTH difference too
        // (the low corners sit at one z, the high corners at another —
        // e.g. wood_roof: low corners at z=1, high corners at z=-1). When
        // both groups share the same z, this is just a box standing on
        // end, not a ramp.
        const avgLowZ = (lowPts[0].z + lowPts[1].z) / 2;
        const avgHighZ = (highPts[0].z + highPts[1].z) / 2;
        if (Math.abs(avgLowZ - avgHighZ) < 0.1) {
          return { verdict: 'CLEAN', shape: 'box', reason: '4 corners, height split 2/2 but no depth correlation — plain wall, not a slope' };
        }
        const slope = Math.atan2(high - low, Math.abs(avgLowZ - avgHighZ) || bounds.z);
        return {
          verdict: 'CLEAN',
          shape: 'wedge',
          geom: { kind: 'wedge', slope },
          reason: '4 corners, height split 2/2, depth-correlated — sloped panel',
        };
      }

      // 3/1 split — a folded hip/valley corner. The odd corner is
      // determined from ITS OWN real snap data, not a guessed convention
      // (see geometry.ts's existing roofCornerGeometry comment for why
      // that matters).
      const oddGroup = lowPts.length === 1 ? lowPts : highPts;
      const oddIsHigh = oddGroup === highPts;
      if (oddGroup.length === 1) {
        const odd = cornerLetter(oddGroup[0].x, oddGroup[0].z);
        return {
          verdict: 'CLEAN',
          shape: oddIsHigh ? 'hip' : 'valley',
          geom: { kind: 'corner', odd },
          reason: `4 corners, height split 3/1 (odd corner ${odd} ${oddIsHigh ? 'high' : 'low'})`,
        };
      }
    }

    return { verdict: 'REVIEW', shape: null, reason: `4 snap points, unrecognized height pattern (${distinctYs.length} distinct heights)` };
  }

  if (unique.length === 5) {
    const ys = unique.map((p) => Math.round(p.y * 1000) / 1000);
    const distinctYs = [...new Set(ys)];
    if (distinctYs.length === 3) {
      const low = Math.min(...distinctYs);
      const high = Math.max(...distinctYs);
      const lowPts = unique.filter((p) => Math.abs(p.y - low) < EPS);
      const highPts = unique.filter((p) => Math.abs(p.y - high) < EPS);
      if (lowPts.length === 2 && highPts.length === 2) {
        const bottomLeft = lowPts.find((p) => p.x < 0) ?? lowPts[0];
        const bottomRight = lowPts.find((p) => p.x >= 0) ?? lowPts[1];
        const topLeft = highPts.find((p) => p.x < 0) ?? highPts[0];
        const topRight = highPts.find((p) => p.x >= 0) ?? highPts[1];
        return {
          verdict: 'CLEAN',
          shape: 'cross',
          geom: { kind: 'cross', a1: bottomLeft, b1: topRight, a2: bottomRight, b2: topLeft, t: thickness },
          reason: 'snap-derived: 5 snap points (4 corners + center) — X truss',
        };
      }
    }
    return { verdict: 'REVIEW', shape: null, reason: '5 snap points, unrecognized pattern' };
  }

  if (unique.length === 6) {
    const ys = unique.map((p) => Math.round(p.y * 1000) / 1000);
    const distinctYs = [...new Set(ys)];
    if (distinctYs.length === 2) {
      const low = Math.min(...distinctYs);
      const high = Math.max(...distinctYs);
      const eave = unique.filter((p) => Math.abs(p.y - low) < EPS);
      const ridge = unique.filter((p) => Math.abs(p.y - high) < EPS);
      if (eave.length === 4 && ridge.length === 2) {
        const eaveZ = Math.max(...eave.map((p) => Math.abs(p.z)));
        const halfWidth = Math.max(...ridge.map((p) => Math.abs(p.x)));
        return {
          verdict: 'CLEAN',
          shape: 'ridge',
          geom: { kind: 'ridge', halfWidth, eaveZ, eaveY: low, ridgeY: high, t: 0.08 },
          reason: 'snap-derived: 6 snap points (4 eave + 2 ridge)',
        };
      }
    }
    return { verdict: 'REVIEW', shape: null, reason: '6 snap points, unrecognized pattern' };
  }

  if (unique.length === 8) {
    const ys = unique.map((p) => Math.round(p.y * 1000) / 1000);
    const distinctYs = [...new Set(ys)];
    if (distinctYs.length === 2) {
      return { verdict: 'CLEAN', shape: 'box', reason: '8 corner snap points — full box' };
    }
  }

  return { verdict: 'REVIEW', shape: null, reason: `${unique.length} snap points, unrecognized pattern` };
}

/**
 * Second-pass sanity check: the box around the derived geometry's own
 * defining points should roughly match the piece's real bounds. A big
 * mismatch usually means the auto-classification picked the wrong shape.
 *
 * Only meaningful for triangle/cross — 'beam' is deliberately excluded:
 * its `ext` (overhang past the connecting snap points) is solved from a
 * projected-length approximation, not an exact per-axis reconciliation, so
 * comparing beam's raw endpoint bbox against bounds axis-by-axis flags
 * nearly every angled beam for a mismatch that isn't really one.
 *
 * Real Valheim pieces commonly extend a bit past their outermost snap
 * points (eaves, joinery overhang) even for triangle/cross, so this uses a
 * relative tolerance (derived extent within 60%–140% of bounds) rather than
 * a fixed absolute one — loose enough to pass ordinary overhang, tight
 * enough to still catch a genuinely wrong shape/pattern match. On the axis
 * a shape doesn't actually span (its own thin/thickness direction, where
 * the defining points collapse to ~0 extent), the shape's own thickness
 * parameter is substituted before comparing.
 */
export function boundsSanityCheck(bounds: Vec3, geom: ShapeParams | undefined): string | null {
  if (!geom) return null;
  let points: Vec3[];
  let thickness: number;
  if (geom.kind === 'triangle') {
    points = geom.p;
    thickness = geom.t;
  } else if (geom.kind === 'cross') {
    points = [geom.a1, geom.b1, geom.a2, geom.b2];
    thickness = geom.t;
  } else {
    return null;
  }

  const box = boxFromPoints(points);
  for (const axis of ['x', 'y', 'z'] as const) {
    if (bounds[axis] < 0.02) continue;
    const extent = box.size[axis] < 0.05 ? thickness : box.size[axis];
    const ratio = extent / bounds[axis];
    if (ratio < 0.6 || ratio > 1.4) {
      return `derived geometry's ${axis} extent (${extent.toFixed(2)}) differs from bounds (${bounds[axis].toFixed(2)}) by more than the 60%-140% tolerance`;
    }
  }
  return null;
}

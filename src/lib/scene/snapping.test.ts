import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { snapPosition, snapPositionAlongRay, getPieceData } from './snapping';
import type { PlacedPiece } from '../types';

// Regression suite for every snap-point disambiguation case discovered
// empirically (via real browser + Export-JSON testing) across the session
// that built vertical placement, scroll-wheel rotation, and the ray-based
// snap fallback. Each case here corresponds to a specific bug report or
// user-observed behavior — see valheim-planner-plan.md for the full
// narrative of why each one exists. Pure unit tests against real catalog
// prefabs (wood_wall_log, wood_pole, wood_floor) — no browser, no camera,
// no pixel targeting, so these are far more reliable than the throwaway
// Playwright scripts used to originally diagnose these bugs, and should be
// extended with new cases as new piece tiers (stone, iron, roofs, stairs)
// are added, rather than rediscovering the same ambiguity classes by hand
// each time.

const IDENTITY = new THREE.Quaternion();

function place(prefab: string, pos: THREE.Vector3, rot = IDENTITY): PlacedPiece {
  return { id: crypto.randomUUID(), prefab, pos: { x: pos.x, y: pos.y, z: pos.z }, rot: { x: rot.x, y: rot.y, z: rot.z, w: rot.w } };
}

/** Where a piece's root would rest so its bottom touches the ground (y=0). */
function groundRestY(prefab: string): number {
  const piece = getPieceData(prefab)!;
  return piece.bounds.y / 2 - piece.center.y;
}

describe('catalog sanity', () => {
  it('wood_wall_log has 4 snap points at both ends and both heights', () => {
    const piece = getPieceData('wood_wall_log')!;
    const points = piece.snapPoints.map((sp) => [sp.pos.x, sp.pos.y]).sort();
    expect(points).toEqual([
      [-1, -0.25],
      [-1, 0.25],
      [1, -0.25],
      [1, 0.25],
    ]);
  });

  it('wood_pole has top and bottom snap points only', () => {
    const piece = getPieceData('wood_pole')!;
    expect(piece.snapPoints.map((sp) => sp.pos.y).sort()).toEqual([-0.5, 0.5]);
  });

  it('wood_floor has 4 corner snap points at a single height', () => {
    const piece = getPieceData('wood_floor')!;
    expect(new Set(piece.snapPoints.map((sp) => sp.pos.y)).size).toBe(1);
    expect(piece.snapPoints).toHaveLength(4);
  });
});

describe('snapPosition — plain point-to-point (horizontal, same-height case)', () => {
  it('snaps two floor tiles corner-to-corner with an exact 2-unit offset', () => {
    const floorA = place('wood_floor', new THREE.Vector3(0, groundRestY('wood_floor'), 0));
    // Ghost tentatively near floor A's +x edge, close enough to trigger the snap.
    const tentative = new THREE.Vector3(1.6, groundRestY('wood_floor'), 0);
    const result = snapPosition('wood_floor', tentative, IDENTITY, [floorA]);
    expect(result.x).toBeCloseTo(2, 10);
    expect(result.y).toBeCloseTo(floorA.pos.y, 10);
    expect(result.z).toBeCloseTo(0, 10);
  });

  it('does not snap when nothing is within SNAP_RADIUS', () => {
    const floorA = place('wood_floor', new THREE.Vector3(0, groundRestY('wood_floor'), 0));
    const tentative = new THREE.Vector3(10, groundRestY('wood_floor'), 10);
    const result = snapPosition('wood_floor', tentative, IDENTITY, [floorA]);
    expect(result.equals(tentative)).toBe(true);
  });
});

describe('snapPositionAlongRay — vertical stacking (pole)', () => {
  it('stacks a pole exactly 1.0 unit above another pole, aiming straight down at its top', () => {
    const poleA = place('wood_pole', new THREE.Vector3(0, groundRestY('wood_pole'), 0));
    const targetTop = new THREE.Vector3(0, poleA.pos.y + 0.5, 0); // poleA's top snap point
    // A straight-down ray aimed exactly at the target — the ordinary "Top"
    // camera preset case, and the near-vertical degenerate regime.
    const ray = new THREE.Ray(new THREE.Vector3(0, 20, 0), new THREE.Vector3(0, -1, 0));
    // Tentative position simulates the raycast falling through to the
    // ground (missing the pole's thin 0.4x0.4 footprint) — the exact
    // scenario the ray-based fallback exists for.
    const tentative = new THREE.Vector3(0, groundRestY('wood_pole'), 0);
    const result = snapPositionAlongRay('wood_pole', tentative, IDENTITY, [poleA], ray);
    expect(result.y - poleA.pos.y).toBeCloseTo(1.0, 10);
    expect(result.x).toBeCloseTo(0, 10);
    expect(result.z).toBeCloseTo(0, 10);
  });
});

describe('snapPositionAlongRay — prefer the piece actually under the cursor (regression: picked an occluded lower piece)', () => {
  // poleA sits on the ground; poleB is already stacked on top of poleA
  // (both on the same (x, z) column, as any multi-story build naturally
  // is). The user is now aiming at poleB's top, from a realistic angled
  // (non-top-down) camera, to stack a third pole there.
  const poleA = place('wood_pole', new THREE.Vector3(0, groundRestY('wood_pole'), 0));
  const poleB = place('wood_pole', new THREE.Vector3(0, poleA.pos.y + 1.0, 0));
  const topA = poleA.pos.y + 0.5;
  const topB = poleB.pos.y + 0.5;

  // A moderately angled camera ray aimed near poleB's top surface (offset
  // slightly off-center, as a real cursor rarely lands exactly on a snap
  // point) — chosen so that the ray's line passes almost exactly through
  // poleA's top point purely as a camera-geometry artifact, even though
  // poleA is nowhere near the cursor and is occluded by poleB from this
  // viewpoint. Confirmed by direct construction: distanceToPoint() to
  // poleA's top here is ~0, smaller than to poleB's top, which is exactly
  // the depth-blind failure mode this test guards against.
  const cameraPos = new THREE.Vector3(1, 6, 1);
  const aimPoint = new THREE.Vector3(0.2, topB, 0.2);
  const ray = new THREE.Ray(cameraPos, aimPoint.clone().sub(cameraPos).normalize());
  // The actual mesh raycast hit poleB's top surface — this is what makes
  // poleB "the piece under the cursor."
  const tentative = new THREE.Vector3(0.2, topB, 0.2);

  it('snaps onto the hovered piece (poleB) when its id is provided, not the occluded piece below it', () => {
    const result = snapPositionAlongRay('wood_pole', tentative, IDENTITY, [poleA, poleB], ray, poleB.id);
    expect(result.y - poleB.pos.y).toBeCloseTo(1.0, 6);
    expect(result.x).toBeCloseTo(0, 6);
    expect(result.z).toBeCloseTo(0, 6);
  });

  it('demonstrates the bug: without a hovered-piece hint, pure ray distance anchors to the occluded lower pole instead of poleB', () => {
    const result = snapPositionAlongRay('wood_pole', tentative, IDENTITY, [poleA, poleB], ray);
    // Without the hover restriction, the depth-blind rayDist search still
    // locks onto poleA (whose top the ray passes almost exactly through, a
    // pure camera-geometry artifact) rather than poleB, the piece actually
    // under the cursor — it just lands on poleA's *bottom* connection
    // (stacking a fourth pole below ground) once the degenerate-overlap
    // exclusion (now scene-wide) rules out the exact-overlap pairings at
    // poleA's top. Either way, it is not the poleB-top connection the user
    // is pointing at — which is exactly why the hover restriction above is
    // needed rather than relying on rayDist filtering alone.
    expect(result.y - poleA.pos.y).toBeCloseTo(-1.0, 6);
  });
});

describe('snapPositionAlongRay — vertical stacking (wall), thin-target ray fallback', () => {
  const wallA = place('wood_wall_log', new THREE.Vector3(0, groundRestY('wood_wall_log'), 0));

  it('stacks a wall exactly 0.5 above another wall when the raycast lands on target', () => {
    const targetTop = new THREE.Vector3(0, wallA.pos.y + 0.25, 0);
    const ray = new THREE.Ray(new THREE.Vector3(0, 20, 0.001), new THREE.Vector3(0, -1, -0.00005).normalize());
    const tentative = targetTop.clone(); // raycast landed right on the wall's top surface
    const result = snapPositionAlongRay('wood_wall_log', tentative, IDENTITY, [wallA], ray);
    expect(result.y - wallA.pos.y).toBeCloseTo(0.5, 6);
  });

  it('still stacks correctly when the raycast misses the wall entirely and lands far away', () => {
    // The measured real-world failure this fallback fixes: aiming near the
    // wall's top but offset across its narrow 0.55m depth, so the mesh
    // raycast misses and tentativePos ends up somewhere structurally
    // unrelated instead (here, displaced far enough that point-to-point
    // distance alone can't qualify either the top or bottom candidate —
    // only the ray itself, aimed precisely at the top, can rescue this).
    const targetTop = new THREE.Vector3(0, wallA.pos.y + 0.25, 0);
    const ray = new THREE.Ray(new THREE.Vector3(0, 20, 0), targetTop.clone().sub(new THREE.Vector3(0, 20, 0)).normalize());
    const tentative = new THREE.Vector3(5, groundRestY('wood_wall_log'), 0); // structurally unrelated
    const result = snapPositionAlongRay('wood_wall_log', tentative, IDENTITY, [wallA], ray);
    expect(result.y - wallA.pos.y).toBeCloseTo(0.5, 6);
    expect(result.x).toBeCloseTo(0, 6);
  });
});

describe('snapPositionAlongRay — flush end-to-end extension (regression: previously staggered)', () => {
  it('extends a wall flush at the same height, not staggered by the snap spacing', () => {
    const wallA = place('wood_wall_log', new THREE.Vector3(0, groundRestY('wood_wall_log'), 0));
    // A realistic scenario: the user hovers near wallA's +x end at ground
    // level (a real ground raycast naturally lands close to, not exactly
    // on, the flush position) with a plausible oblique camera ray, roughly
    // level — not tilted toward stacking above/below. A wall's 4 symmetric
    // corner snap points make PURE ray-only disambiguation (tentativePos
    // contributing nothing) genuinely ambiguous between flush-extend,
    // stack-above, and stack-below when aimed exactly at one corner — that
    // isn't a bug, real usage always has a real tentativePos too, which is
    // why this test includes one rather than testing the ray in isolation.
    const tentative = new THREE.Vector3(1.8, wallA.pos.y, 0.1);
    const cameraPos = new THREE.Vector3(8, 6, 8);
    const aimPoint = new THREE.Vector3(2, wallA.pos.y, 0.1);
    const ray = new THREE.Ray(cameraPos, aimPoint.clone().sub(cameraPos).normalize());
    const result = snapPositionAlongRay('wood_wall_log', tentative, IDENTITY, [wallA], ray);
    // The core regression check: exactly 2 units over (flush extension),
    // same Y as wallA — checking BOTH matters. A staggered mismatch would
    // keep x=2 but shift y by 0.5; the degenerate same-side pairing fixed
    // below would keep y correct but put x at 0 (full overlap with wallA).
    // An assertion on y alone would miss that second failure mode, which is
    // exactly what happened when this test was first written.
    expect(result.x).toBeCloseTo(2, 6);
    expect(result.y).toBeCloseTo(wallA.pos.y, 6);
    expect(result.z).toBeCloseTo(0, 6);
  });
});

describe('snapPositionAlongRay — far-end reach (regression: long pieces couldn\'t reach via their far end)', () => {
  it('connects the FAR end of a new wall to a distant target, extending away rather than overlapping', () => {
    // wallA far from the ghost's raw raycast position, simulating: the user
    // is building elsewhere (tentativePos near the origin, unrelated), but
    // aims their cursor/ray across open space at wallA specifically,
    // wanting the new wall's FAR end to reach it while the wall's bulk
    // extends away in the opposite direction.
    const wallA = place('wood_wall_log', new THREE.Vector3(10, groundRestY('wood_wall_log'), 10));
    const target = new THREE.Vector3(9, wallA.pos.y + 0.25, 10); // wallA's local -1 (left) end
    const tentative = new THREE.Vector3(0, groundRestY('wood_wall_log'), 0); // raw raycast, unrelated
    const ray = new THREE.Ray(new THREE.Vector3(-5, 15, 10), target.clone().sub(new THREE.Vector3(-5, 15, 10)).normalize());
    const result = snapPositionAlongRay('wood_wall_log', tentative, IDENTITY, [wallA], ray);
    // Must extend AWAY from wallA (x=8, the complementary/correct pairing),
    // not overlap it (x=10, the same-side/degenerate pairing this test
    // would also catch regressing).
    expect(result.x).toBeCloseTo(8, 6);
    expect(result.distanceTo(new THREE.Vector3(wallA.pos.x, wallA.pos.y, wallA.pos.z))).toBeGreaterThan(1);
  });
});

describe('snapPositionAlongRay — degenerate same-side pairing exclusion', () => {
  it('never returns a position that exactly coincides with the piece being connected to', () => {
    // Regardless of camera angle, connecting via the SAME-side local offset
    // as the target (rather than the complementary one) places the new
    // piece exactly on top of the existing one — never a valid result.
    // Swept across several distinct ray angles aimed at the same target,
    // since this was originally found to depend on ray geometry (some
    // angles scored the degenerate candidate as "closer" than the correct
    // one before this exclusion existed).
    const wallA = place('wood_wall_log', new THREE.Vector3(10, groundRestY('wood_wall_log'), 10));
    const target = new THREE.Vector3(9, wallA.pos.y + 0.25, 10);
    const tentative = new THREE.Vector3(0, groundRestY('wood_wall_log'), 0);
    const origins = [
      new THREE.Vector3(0, 15, 0),
      new THREE.Vector3(5, 20, 20),
      new THREE.Vector3(9, 20, 0),
      new THREE.Vector3(-5, 15, 10),
      new THREE.Vector3(20, 15, 10),
    ];
    for (const origin of origins) {
      const ray = new THREE.Ray(origin, target.clone().sub(origin).normalize());
      const result = snapPositionAlongRay('wood_wall_log', tentative, IDENTITY, [wallA], ray);
      const distanceFromWallA = result.distanceTo(new THREE.Vector3(wallA.pos.x, wallA.pos.y, wallA.pos.z));
      expect(distanceFromWallA).toBeGreaterThan(0.05);
    }
  });
});

describe('snapPositionAlongRay — no spurious long-range snapping', () => {
  it('does not snap to a piece far outside RAY_SNAP_REACH', () => {
    const wallA = place('wood_wall_log', new THREE.Vector3(0, groundRestY('wood_wall_log'), 0));
    const wallB = place('wood_wall_log', new THREE.Vector3(20, groundRestY('wood_wall_log'), 0));
    const tentative = new THREE.Vector3(10, groundRestY('wood_wall_log'), 0); // exactly between them, near neither
    const ray = new THREE.Ray(new THREE.Vector3(10, 20, 0), new THREE.Vector3(0, -1, 0));
    const result = snapPositionAlongRay('wood_wall_log', tentative, IDENTITY, [wallA, wallB], ray);
    expect(result.equals(tentative)).toBe(true);
  });
});

// --- Catalog-expansion regression cases (stone/iron/angled-beam scale, and
// the degenerate-overlap exclusion narrowed to same-prefab+same-rotation —
// see valheim-planner-plan.md's "Catalog expansion" section for why). ---

describe('snapPosition — stone tier (8-corner box)', () => {
  it('stacks a stone wall exactly 1.0 above another, all 8 corners considered', () => {
    const wallA = place('stone_wall_1x1', new THREE.Vector3(0, 0, 0));
    // Exactly aligned with wallA's top face — the closest pair is
    // guaranteed to be top-of-A/bottom-of-ghost, not a mismatched corner.
    const tentative = new THREE.Vector3(0, 1.0, 0);
    const result = snapPosition('stone_wall_1x1', tentative, IDENTITY, [wallA]);
    expect(result.y).toBeCloseTo(1.0, 10);
    expect(result.x).toBeCloseTo(0, 10);
    expect(result.z).toBeCloseTo(0, 10);
  });
});

describe('snapPosition — iron tier (small 1m-scale cage floor)', () => {
  it('snaps two iron floor tiles edge-to-edge with an exact 2-unit offset', () => {
    const floorA = place('iron_floor_2x2', new THREE.Vector3(0, 0, 0));
    const tentative = new THREE.Vector3(1.6, 0, 0);
    const result = snapPosition('iron_floor_2x2', tentative, IDENTITY, [floorA]);
    expect(result.x).toBeCloseTo(2, 10);
    expect(result.y).toBeCloseTo(0, 10);
    expect(result.z).toBeCloseTo(0, 10);
  });
});

describe('snapPosition — angled beam (snap-derived shape, diagonal snap points)', () => {
  it('chains two 45° beams end-to-end at exactly (2, 2, 0)', () => {
    const beamA = place('wood_beam_45', new THREE.Vector3(0, 0, 0));
    const tentative = new THREE.Vector3(1.3, 1.3, 0);
    const result = snapPosition('wood_beam_45', tentative, IDENTITY, [beamA]);
    expect(result.x).toBeCloseTo(2, 10);
    expect(result.y).toBeCloseTo(2, 10);
    expect(result.z).toBeCloseTo(0, 10);
  });
});

describe('snapPositionAlongRay — degenerate-overlap exclusion narrowed to same-prefab + same-rotation', () => {
  // darkwood_arch has a snap point exactly at its own root (local 0,0,0),
  // so a second arch connecting there necessarily wants its root at the
  // exact same world position as the first. The old exclusion (any placed
  // piece, any rotation) blocked this outright; the narrowed one only
  // blocks it when it's truly the same piece/orientation landing on itself.
  const ROT_90 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  const target = new THREE.Vector3(5, 0, 5); // arch A's root, at identity rotation
  // Close enough (< SNAP_RADIUS) to qualify via point-distance for the
  // coincident (0,0,0) local offset, but far enough from A's OTHER two
  // snap points (~2-2.8 units away after rotation) that they don't
  // qualify — isolates the test to exactly the root-coincidence pairing.
  const tentative = new THREE.Vector3(5.3, 0, 5.3);
  // Aimed far from the scene entirely, so nothing qualifies via rayDist —
  // only the point-distance path (above) can produce a candidate here.
  const farRay = new THREE.Ray(new THREE.Vector3(50, 50, 50), new THREE.Vector3(0, -1, 0));

  it('still blocks a second arch at the SAME rotation from coinciding with the first', () => {
    const archA = place('darkwood_arch', target, IDENTITY);
    const result = snapPositionAlongRay('darkwood_arch', tentative, IDENTITY, [archA], farRay);
    expect(result.equals(tentative)).toBe(true); // no snap — excluded, falls back
  });

  it('allows a second arch at a DIFFERENT rotation to connect at the same point', () => {
    const archA = place('darkwood_arch', target, IDENTITY);
    const result = snapPositionAlongRay('darkwood_arch', tentative, ROT_90, [archA], farRay);
    expect(result.distanceTo(target)).toBeCloseTo(0, 6);
  });

  it('allows a DIFFERENT prefab to coincide with a placed piece\'s root (mixed-prefab case)', () => {
    // wood_floor and iron_floor_2x2 happen to share an exact local snap
    // offset, (1, 0, 1) — real data, not fabricated — which lets this be
    // constructed the same way as the two cases above but across prefabs:
    // floorA's (1,0,1) world snap point, minus the ghost's own (1,0,1)
    // local offset, lands exactly back on floorA's root.
    const floorRoot = new THREE.Vector3(5, 0, 5);
    const floorA = place('wood_floor', floorRoot, IDENTITY);
    // floorA's (1,0,1) world snap point is floorRoot + (1,0,1); the ghost's
    // own (1,0,1) local offset cancels it back out to floorRoot exactly.
    const ghostTentative = floorRoot.clone().add(new THREE.Vector3(0.3, 0, 0.3));
    const result = snapPositionAlongRay('iron_floor_2x2', ghostTentative, IDENTITY, [floorA], farRay);
    expect(result.distanceTo(floorRoot)).toBeCloseTo(0, 6);
  });
});

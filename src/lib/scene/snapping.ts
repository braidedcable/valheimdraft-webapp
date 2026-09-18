import * as THREE from 'three';
import piecesData from '../../data/pieces.json';
import type { PlacedPiece, Quat, Vec3 } from '../types';

export type PieceEntry = (typeof piecesData.pieces)[number];
type SnapPoint = PieceEntry['snapPoints'][number];

// The extractor can occasionally emit the same snap point twice for a piece
// (e.g. captured once per wear-state variant mesh sharing the same
// transform). Collapse exact (within floating-point noise) pos+rot
// duplicates so downstream consumers never see or search redundant points.
const DEDUPE_EPSILON = 1e-5;

function snapPointsEqual(a: SnapPoint, b: SnapPoint): boolean {
  return (
    Math.abs(a.pos.x - b.pos.x) < DEDUPE_EPSILON &&
    Math.abs(a.pos.y - b.pos.y) < DEDUPE_EPSILON &&
    Math.abs(a.pos.z - b.pos.z) < DEDUPE_EPSILON &&
    Math.abs(a.rot.x - b.rot.x) < DEDUPE_EPSILON &&
    Math.abs(a.rot.y - b.rot.y) < DEDUPE_EPSILON &&
    Math.abs(a.rot.z - b.rot.z) < DEDUPE_EPSILON &&
    Math.abs(a.rot.w - b.rot.w) < DEDUPE_EPSILON
  );
}

function dedupeSnapPoints(snapPoints: SnapPoint[]): SnapPoint[] {
  const deduped: SnapPoint[] = [];
  for (const sp of snapPoints) {
    if (!deduped.some((existing) => snapPointsEqual(existing, sp))) {
      deduped.push(sp);
    }
  }
  return deduped;
}

// Dedupe once up front (piece count is small and this map is built exactly
// once at module load), so every later lookup via getPieceData already
// returns a clean, duplicate-free snapPoints array.
const piecesByPrefab = new Map(
  piecesData.pieces.map((p) => [p.prefab, { ...p, snapPoints: dedupeSnapPoints(p.snapPoints) }])
);

export function getPieceData(prefab: string): PieceEntry | undefined {
  return piecesByPrefab.get(prefab);
}

function toVector3(v: Vec3): THREE.Vector3 {
  return new THREE.Vector3(v.x, v.y, v.z);
}

function toQuaternion(q: Quat): THREE.Quaternion {
  return new THREE.Quaternion(q.x, q.y, q.z, q.w);
}

/** World-space positions of an already-placed piece's snap points. */
export function worldSnapPoints(placed: PlacedPiece): THREE.Vector3[] {
  const piece = getPieceData(placed.prefab);
  if (!piece) return [];
  const pos = toVector3(placed.pos);
  const rot = toQuaternion(placed.rot);
  return piece.snapPoints.map((sp) => toVector3(sp.pos).applyQuaternion(rot).add(pos));
}

const SNAP_RADIUS = 1.0;

/**
 * Given a tentative ghost root position/rotation for `prefab`, checks
 * whether any of the ghost's own snap points land near any snap point of an
 * already-placed piece. If the closest such pair is within SNAP_RADIUS,
 * returns a position shifted so that pair coincides exactly (edge-to-edge
 * snapping, matching how Valheim's own snap points work); otherwise returns
 * the original tentative position unchanged (freeform placement).
 */
export function snapPosition(
  prefab: string,
  tentativePos: THREE.Vector3,
  rot: THREE.Quaternion,
  placedPieces: PlacedPiece[]
): THREE.Vector3 {
  const piece = getPieceData(prefab);
  if (!piece || piece.snapPoints.length === 0 || placedPieces.length === 0) return tentativePos;

  const ghostSnapWorld = piece.snapPoints.map((sp) =>
    toVector3(sp.pos).applyQuaternion(rot).add(tentativePos)
  );

  let best: { dist: number; delta: THREE.Vector3 } | null = null;
  for (const placed of placedPieces) {
    for (const targetPoint of worldSnapPoints(placed)) {
      for (const ghostPoint of ghostSnapWorld) {
        const dist = targetPoint.distanceTo(ghostPoint);
        if (dist < SNAP_RADIUS && (!best || dist < best.dist)) {
          best = { dist, delta: targetPoint.clone().sub(ghostPoint) };
        }
      }
    }
  }

  return best ? tentativePos.clone().add(best.delta) : tentativePos;
}

// How far the AIMING RAY may pass from a real snap point and still count as
// "pointing near it," independent of whether raycastGroundAndPlaced()
// happened to land its single hit on the exact target surface. Deliberately
// larger than SNAP_RADIUS — SNAP_RADIUS governs a 3D point-to-point distance
// once we already have a good tentative position; this constant compensates
// for imprecise aiming at physically thin pieces (e.g. a 0.55m-deep wall,
// where missing the mesh by more than half its depth sends the raycast
// straight through to the ground, a full piece-height below the real
// connection point — see the measured wall-depth failure this was built to
// fix).
const RAY_SNAP_REACH = 1.5;

/**
 * Ray-aware variant of snapPosition(), for use when the ghost's tentative
 * position comes from a raycast that may have missed a thin target piece's
 * surface entirely (landing on the ground instead of on the piece).
 *
 * Considers every (placed piece's snap point) x (ghost's own snap point)
 * pairing that's plausible by EITHER of two independent measures:
 *  - the ordinary point-to-point distance once the ghost is placed at
 *    tentativePos (exactly what snapPosition() checks, within SNAP_RADIUS) —
 *    the reliable case where the raycast landed on or near the real target
 *    surface; or
 *  - how closely the AIMING RAY ITSELF passes the target point (within
 *    RAY_SNAP_REACH), independent of where the raycast's single hit point
 *    landed — the fallback for a thin piece the raycast missed entirely.
 *
 * A single target point is ambiguous about which of the ghost's own snap
 * points should mate with it — e.g. a wall's top and bottom end points sit
 * at the same (x, z), so a top-down aiming ray can't tell them apart, and
 * neither can tentativePos once it's already wrong in Y (that's exactly the
 * bug this function exists to fix). Rather than inferring intent from
 * abstract properties of a candidate (e.g. how much it overlaps the target
 * vertically), every qualifying pairing is scored by the one signal that
 * directly reflects what the user is aiming at: how close the piece's
 * resulting *visual center* (root + rotated piece.center, exactly as
 * Viewport.svelte's positionMesh() renders it) would land to the aiming ray
 * itself. Smaller wins. This one rule naturally distinguishes "aiming above
 * a piece" (stack on top — the true center of the stacked placement sits
 * near the continuing ray) from "aiming level with a piece's end" (extend
 * flush — the flush candidate's center sits near the ray, while a
 * mismatched/staggered candidate's center does not), with no special-casing
 * of either scenario.
 *
 * One case this center-distance metric genuinely cannot resolve on its own:
 * when the aiming ray is (close to) perfectly vertical — the ordinary case
 * for the "Top" camera preset aimed anywhere near screen center — candidates
 * that sit directly above vs. directly below the same point are, by
 * construction, both essentially ON that vertical line, so their distances
 * to the ray come out nearly identical (differing only by camera-model
 * floating-point noise, not by any real signal). That's the exact
 * degeneracy the removed algorithm's own comments already called out
 * ("a straight-down aiming ray genuinely cannot distinguish stack on top
 * from stack underneath a thin target"); it's a property of the ray's
 * geometry, not of piece overlap, so resolving it doesn't need overlap math
 * — just the same "build upward" tie-break the old code already reached
 * for as its own last resort. Confirmed empirically (see PR notes): without
 * this, straight-down stacking picks the wrong candidate roughly half the
 * time, purely on floating-point noise. Detected directly from the ray's
 * own shape (its horizontal-plane direction is ~0), not by comparing
 * scores, so it only ever engages in this specific near-vertical-aim
 * regime and never interferes with the ordinary (non-degenerate) scoring
 * used for every other camera angle or off-center aim — including the
 * flush wall-extension case above, where the ray's real horizontal slope
 * already carries a genuine, non-degenerate signal.
 */
// Below this, the ray's own direction is treated as "(near) perfectly
// vertical" — the degenerate aiming case described above, where distance-
// to-candidate-center carries no real disambiguating signal at all (any
// difference is floating-point noise from the camera/projection math, not
// a genuine "closer to where the user is pointing" signal). Comfortably
// above ordinary floating-point noise, and comfortably below the smallest
// real horizontal tilt produced by an off-center aim under any of this
// app's camera presets (measured empirically: a dead-center "Top" aim
// produces a horizontal ray-direction magnitude on the order of 1e-4–1e-3,
// while an aim even slightly off-axis — e.g. at another piece's snap point
// a couple of units from screen center — already produces ~1e-2 or more).
const RAY_NEAR_VERTICAL_THRESHOLD = 0.01;

// Once the ray is confirmed near-vertical, candidates whose scores are
// within this much of each other are the genuinely-tied ones the
// degeneracy above describes (empirically, that tie's score gap is on the
// order of 1e-4 or smaller); candidates farther apart than this still
// differ for real reasons (e.g. belonging to an entirely different, more
// distant target point) and shouldn't be overridden by the tie-break.
const NEAR_VERTICAL_TIE_EPSILON = 0.05;

export function snapPositionAlongRay(
  prefab: string,
  tentativePos: THREE.Vector3,
  rot: THREE.Quaternion,
  placedPieces: PlacedPiece[],
  ray: THREE.Ray
): THREE.Vector3 {
  const piece = getPieceData(prefab);
  if (!piece || piece.snapPoints.length === 0 || placedPieces.length === 0) return tentativePos;

  const ghostLocalOffsets = piece.snapPoints.map((sp) => toVector3(sp.pos).applyQuaternion(rot));
  const rotatedCenter = toVector3(piece.center).applyQuaternion(rot);

  const rayIsNearVertical =
    ray.direction.x * ray.direction.x + ray.direction.z * ray.direction.z <
    RAY_NEAR_VERTICAL_THRESHOLD * RAY_NEAR_VERTICAL_THRESHOLD;

  let bestPos: THREE.Vector3 | null = null;
  let bestCenterDist = Infinity;
  let bestCenterY = -Infinity;

  for (const placed of placedPieces) {
    const ownerPiece = getPieceData(placed.prefab);
    if (!ownerPiece) continue;

    for (const targetPoint of worldSnapPoints(placed)) {
      // ray.distanceToPoint() is correctly clamped to the forward half-line
      // (t >= 0 from ray.origin): a point "behind" the ray falls back to
      // plain distance-to-origin rather than projecting onto the infinite
      // line in both directions, so a piece behind the camera's aim
      // direction can only register as a candidate if it happens to sit
      // within RAY_SNAP_REACH of the ray's origin itself, which never
      // happens at realistic scene scales.
      const rayDist = ray.distanceToPoint(targetPoint);

      for (const localOffset of ghostLocalOffsets) {
        const pointDist = targetPoint.distanceTo(tentativePos.clone().add(localOffset));
        if (pointDist >= SNAP_RADIUS && rayDist >= RAY_SNAP_REACH) continue;

        const candidatePos = targetPoint.clone().sub(localOffset);
        const candidateCenter = candidatePos.clone().add(rotatedCenter);
        const centerDist = ray.distanceToPoint(candidateCenter);

        let better: boolean;
        if (!bestPos) {
          better = true;
        } else if (rayIsNearVertical && Math.abs(centerDist - bestCenterDist) <= NEAR_VERTICAL_TIE_EPSILON) {
          // Genuinely tied under a near-vertical aim: fall back to "build
          // upward" rather than let camera-math noise decide.
          better = candidateCenter.y > bestCenterY;
        } else {
          better = centerDist < bestCenterDist;
        }

        if (better) {
          bestPos = candidatePos;
          bestCenterDist = centerDist;
          bestCenterY = candidateCenter.y;
        }
      }
    }
  }

  return bestPos ?? tentativePos;
}

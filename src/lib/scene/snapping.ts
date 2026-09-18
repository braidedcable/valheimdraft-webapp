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

// Tolerance for comparing overlap amounts when picking between candidates —
// pure floating-point noise shouldn't flip which pairing "wins".
const OVERLAP_EPSILON = 1e-6;

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
 * bug this function exists to fix). Instead of picking "whichever pairing
 * lands closest to tentativePos" (which would just re-select the same wrong
 * height), every qualifying pairing is scored primarily by how little the
 * ghost's resulting vertical extent overlaps the target piece's vertical
 * extent — i.e. prefer placements that sit against the target piece rather
 * than back inside it — then by proximity, and finally (since a straight-down
 * aiming ray genuinely cannot distinguish "stack on top" from "stack
 * underneath" a thin target — both are equally close to a perfectly vertical
 * ray, and floating-point noise alone shouldn't decide between them) by
 * preferring the higher of two otherwise-tied candidates, matching the
 * ordinary "build upward" expectation.
 */
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

  let bestPos: THREE.Vector3 | null = null;
  let bestOverlap = Infinity;
  let bestDist = Infinity;
  let bestY = -Infinity;

  for (const placed of placedPieces) {
    const ownerPiece = getPieceData(placed.prefab);
    if (!ownerPiece) continue;
    const ownerYMin = placed.pos.y + ownerPiece.center.y - ownerPiece.bounds.y / 2;
    const ownerYMax = placed.pos.y + ownerPiece.center.y + ownerPiece.bounds.y / 2;

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
        const candYMin = candidatePos.y + piece.center.y - piece.bounds.y / 2;
        const candYMax = candidatePos.y + piece.center.y + piece.bounds.y / 2;
        const overlap = Math.max(0, Math.min(ownerYMax, candYMax) - Math.max(ownerYMin, candYMin));
        const dist = Math.min(pointDist, rayDist);

        const overlapTied = Math.abs(overlap - bestOverlap) <= OVERLAP_EPSILON;
        const distTied = Math.abs(dist - bestDist) <= OVERLAP_EPSILON;
        const better =
          overlap < bestOverlap - OVERLAP_EPSILON ||
          (overlapTied && dist < bestDist - OVERLAP_EPSILON) ||
          (overlapTied && distTied && candidatePos.y > bestY);
        if (!bestPos || better) {
          bestPos = candidatePos;
          bestOverlap = overlap;
          bestDist = dist;
          bestY = candidatePos.y;
        }
      }
    }
  }

  return bestPos ?? tentativePos;
}

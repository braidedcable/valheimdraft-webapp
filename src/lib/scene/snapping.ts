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

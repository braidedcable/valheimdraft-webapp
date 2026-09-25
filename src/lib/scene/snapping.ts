import * as THREE from 'three';
import piecesData from '../../data/pieces.json';
import type { PlacedPiece, Quat, Vec3 } from '../types';
import type { PieceData, SnapPoint } from '../catalog/types';

export type PieceEntry = PieceData;
const typedPieces = piecesData.pieces as unknown as PieceData[];

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
  typedPieces.map((p) => [p.prefab, { ...p, snapPoints: dedupeSnapPoints(p.snapPoints) }])
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
 * Candidates are ranked PRIMARILY by how close the aiming ray itself passes
 * to the real, already-placed target point (`rayDist`, the same distance
 * already computed above to gate qualification) — this directly answers
 * "which real connection point is the user pointing at," independent of the
 * piece's own geometry or which of its snap points ends up mating with that
 * point. This matters for long pieces: if the user aims at a target wanting
 * the FAR end of the new piece to attach there, the piece's own visual
 * center necessarily lands well away from that target (and from the ray) —
 * scoring primarily by center-distance would then wrongly favor a candidate
 * that attaches via the NEAR end instead, just to keep the center close to
 * the ray, even though the user pointed exactly at the far-end connection.
 * Ranking by rayDist first avoids that: it picks the target point the user
 * is actually pointing at, before any piece-geometry consideration.
 *
 * A single target point is ambiguous about which of the ghost's own snap
 * points should mate with it — e.g. a wall's top and bottom end points sit
 * at the same (x, z), so a top-down aiming ray can't tell them apart, and
 * neither can tentativePos once it's already wrong in Y (that's exactly the
 * bug this function exists to fix). Two candidates sharing the exact same
 * target point necessarily share the exact same rayDist too (it's computed
 * once per target point, reused for every ghost snap point paired with it),
 * so this case surfaces as a genuine, bit-exact rayDist tie. When that
 * happens, the SECONDARY criterion breaks the tie: how close the piece's
 * resulting *visual center* (root + rotated piece.center, exactly as
 * Viewport.svelte's positionMesh() renders it) would land to the aiming ray
 * itself. Smaller wins. This one rule naturally distinguishes "aiming above
 * a piece" (stack on top — the true center of the stacked placement sits
 * near the continuing ray) from "aiming level with a piece's end" (extend
 * flush — the flush candidate's center sits near the ray, while a
 * mismatched/staggered candidate's center does not), with no special-casing
 * of either scenario.
 *
 * One case neither metric can resolve on its own: when the aiming ray is
 * (close to) perfectly vertical — the ordinary case for the "Top" camera
 * preset aimed anywhere near screen center — candidates that sit directly
 * above vs. directly below the same point are, by construction, both
 * essentially ON that vertical line, so BOTH their rayDist (two distinct
 * target points at the same x/z) and their centerDist come out nearly
 * identical (differing only by camera-model floating-point noise, not by
 * any real signal). That's the exact degeneracy an earlier version of this
 * algorithm's own comments already called out ("a straight-down aiming ray
 * genuinely cannot distinguish stack on top from stack underneath a thin
 * target"); it's a property of the ray's geometry, not of piece overlap, so
 * resolving it doesn't need overlap math — just a "build upward" tie-break
 * as the last resort, applied only once both rayDist and centerDist have
 * already failed to distinguish two candidates for real. Confirmed
 * empirically (see PR notes): without this, straight-down stacking picks
 * the wrong candidate roughly half the time, purely on floating-point
 * noise. Detected directly from the ray's own shape (its horizontal-plane
 * direction is ~0), not by comparing scores, so it only ever engages in
 * this specific near-vertical-aim regime and never interferes with the
 * ordinary (non-degenerate) scoring used for every other camera angle or
 * off-center aim — including the flush wall-extension and far-end-reach
 * cases above, where the ray's real horizontal slope already carries a
 * genuine, non-degenerate signal.
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

// See the exclusion check inside the main loop below for the full
// reasoning: a candidate whose position (nearly) exactly coincides with an
// already-placed piece is a same-side/degenerate pairing, never a valid
// connection, regardless of how it scores on ray or center distance.
const DEGENERATE_OVERLAP_EPSILON = 0.05;

/**
 * `hoveredPieceId`: the placed piece (if any) actually struck by the
 * ordinary mesh raycast that produced `tentativePos` — i.e. whichever piece
 * is visually "under the cursor" from the viewer's current perspective,
 * exactly as depth-sorted by the raycaster (nearer geometry occludes
 * farther geometry, same as anything else rendered in the scene).
 *
 * rayDist (below) is a depth-blind metric: it measures how close the AIMING
 * RAY's infinite line passes a candidate point, with no regard for whether
 * something else sits between the camera and that point. For vertically
 * stacked construction in particular — a new piece being added above/below
 * a piece that's already sitting on top of another piece — every candidate
 * shares the same (x, z) column, so a moderately angled (non-top-down)
 * camera ray can pass numerically closer to a LOWER, occluded candidate
 * than to the piece the cursor is actually pointing at, purely as an
 * artifact of where the ray's true closest-approach point to that vertical
 * line happens to fall. Confirmed by direct construction: a ray aimed at a
 * second-story point can measure a smaller distanceToPoint() for a
 * ground-story point directly below it than for the intended target itself.
 *
 * Fix: when the raycast actually hit a specific placed piece, search that
 * piece's own snap points FIRST and commit to a result there if one
 * qualifies — before ever consulting rayDist against every other placed
 * piece in the scene. This matches how every other pointer interaction in
 * this app already works (raycastPlaced() for pickup/delete uses hits[0],
 * the nearest occluding surface, not a scene-wide search) and restores
 * "snap to what's under the cursor" as the actual rule. The full
 * scene-wide rayDist search remains as the fallback for exactly the cases
 * it was built for: the raycast missing a thin target's mesh and landing
 * on the ground or on nothing relevant instead (see the thin-target and
 * far-end-reach regressions below) — those cases have no meaningful "hit
 * piece" to prefer in the first place.
 *
 * That restriction alone isn't quite enough, though: even within a SINGLE
 * hovered piece, rayDist can still pick the wrong one of its snap points
 * (e.g. a pole's bottom instead of its top) — the ray's closest-approach
 * point along its full infinite line has no idea tentativePos already
 * pinpointed exactly where, on that piece's own surface, the cursor is
 * really resting. So the restricted (hovered-piece) pass ranks by
 * `pointDist` — proximity to the real hit location — instead, via
 * `findSnapCandidate`'s `preferPointDist` flag. The scene-wide fallback
 * pass keeps ranking by rayDist, since tentativePos there is exactly what
 * can't be trusted (that's the whole reason it's falling back).
 */
export function snapPositionAlongRay(
  prefab: string,
  tentativePos: THREE.Vector3,
  rot: THREE.Quaternion,
  placedPieces: PlacedPiece[],
  ray: THREE.Ray,
  hoveredPieceId?: string | null
): THREE.Vector3 {
  const piece = getPieceData(prefab);
  if (!piece || piece.snapPoints.length === 0 || placedPieces.length === 0) return tentativePos;

  const ghostLocalOffsets = piece.snapPoints.map((sp) => toVector3(sp.pos).applyQuaternion(rot));
  const rotatedCenter = toVector3(piece.center).applyQuaternion(rot);

  const rayIsNearVertical =
    ray.direction.x * ray.direction.x + ray.direction.z * ray.direction.z <
    RAY_NEAR_VERTICAL_THRESHOLD * RAY_NEAR_VERTICAL_THRESHOLD;

  if (hoveredPieceId) {
    const hovered = placedPieces.filter((p) => p.id === hoveredPieceId);
    if (hovered.length > 0) {
      const restricted = findSnapCandidate(
        prefab,
        rot,
        ghostLocalOffsets,
        rotatedCenter,
        tentativePos,
        rayIsNearVertical,
        hovered,
        placedPieces,
        ray,
        true
      );
      if (restricted) return restricted;
    }
  }

  return (
    findSnapCandidate(
      prefab,
      rot,
      ghostLocalOffsets,
      rotatedCenter,
      tentativePos,
      rayIsNearVertical,
      placedPieces,
      placedPieces,
      ray,
      false
    ) ?? tentativePos
  );
}

/**
 * `candidatePieces`: which placed pieces' snap points are searched as
 * connection targets — the hovered piece alone on the first (restricted)
 * pass, or the whole scene on the fallback pass.
 *
 * `overlapCheckPieces`: always the FULL scene, independent of
 * `candidatePieces`. The degenerate-overlap exclusion below has to see
 * every placed piece regardless of which ones are being searched as
 * targets, because a candidate can be "wrong" (it erases some OTHER placed
 * piece) even when the target point it was derived from belongs to the one
 * piece being searched — e.g. two flush-stacked poles share a junction
 * point (the lower pole's top coincides exactly with the upper pole's
 * bottom); searching the upper pole alone can still surface a candidate
 * that overlaps the lower pole via that shared point, and only a
 * scene-wide overlap check catches it.
 */
function findSnapCandidate(
  prefab: string,
  rot: THREE.Quaternion,
  ghostLocalOffsets: THREE.Vector3[],
  rotatedCenter: THREE.Vector3,
  tentativePos: THREE.Vector3,
  rayIsNearVertical: boolean,
  candidatePieces: PlacedPiece[],
  overlapCheckPieces: PlacedPiece[],
  ray: THREE.Ray,
  preferPointDist: boolean
): THREE.Vector3 | null {
  let bestPos: THREE.Vector3 | null = null;
  let bestPrimaryDist = Infinity;
  let bestCenterDist = Infinity;
  let bestCenterY = -Infinity;

  for (const placed of candidatePieces) {
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

        // A piece can have more than one snap point along the same local
        // axis (e.g. a wall's two ends). Pairing the ghost's offset with a
        // target on the SAME side — rather than the complementary side that
        // actually continues the line — makes candidatePos land exactly on
        // the target piece's own root position: total positional overlap,
        // not a connection. Found empirically (not by inspection): for
        // several reasonable camera/ray angles reaching toward a distant
        // target, this exact-overlap candidate's center legitimately scored
        // closer to the ray than the correct, non-overlapping one, and
        // nothing was excluding it. A hard exclusion, not a scoring input —
        // ray/center distance are legitimate signals for "which real
        // connection did you mean," but "does this candidate erase an
        // existing piece" isn't a matter of degree.
        //
        // Narrowed to same-prefab + same-rotation placed pieces only (was:
        // any placed piece at all). Some catalog pieces have a snap point
        // exactly at their own root (distance 0, e.g. darkwood_arch's
        // hinge-corner snap) — a genuinely different piece hanging off that
        // exact point at a different rotation (e.g. a second arch turned
        // 90° off the same pole top) is a valid, distinct connection, not
        // an overlap, and the old any-piece check blocked it outright.
        // Same-prefab + same-rotation still catches the real degenerate
        // case this exists for (two candidates of the SAME piece pairing
        // with the same target from opposite sides land on the same root).
        if (
          overlapCheckPieces.some(
            (p) =>
              p.prefab === prefab &&
              candidatePos.distanceTo(toVector3(p.pos)) < DEGENERATE_OVERLAP_EPSILON &&
              rot.angleTo(toQuaternion(p.rot)) < 1e-3
          )
        ) {
          continue;
        }

        const candidateCenter = candidatePos.clone().add(rotatedCenter);
        const centerDist = ray.distanceToPoint(candidateCenter);

        // PRIMARY: which real target point the user is actually pointing
        // at. Ordinarily that's rayDist — how closely the aiming ray's own
        // line passes the target. But rayDist is depth-blind: it doesn't
        // know where the raycast actually landed, only where the ray's
        // infinite line happens to pass closest, which can favor a target
        // point behind or in front of the real one (see snapPositionAlongRay's
        // doc comment). When `preferPointDist` is set — the caller already
        // knows tentativePos came from a real mesh hit on THIS specific
        // piece, i.e. it's a trustworthy 3D location, not a fallback — use
        // proximity to that actual hit point (pointDist) instead, which
        // correctly favors whichever end of the piece the cursor is really
        // over. Two candidates sharing the same target point still share
        // the exact same (bit-identical) primaryDist value in either mode,
        // since it's computed once per (target, offset) pair; that exact
        // equality is the genuine tie this falls through on. A near-vertical
        // ray can also produce a near-tie between two DIFFERENT target
        // points at the same (x, z) (top vs. bottom of a placed piece) —
        // camera-math noise, not a real signal — so that case is folded
        // into the same tie check via NEAR_VERTICAL_TIE_EPSILON.
        const primaryDist = preferPointDist ? pointDist : rayDist;
        const primaryDistTied =
          !bestPos ||
          primaryDist === bestPrimaryDist ||
          (rayIsNearVertical && Math.abs(primaryDist - bestPrimaryDist) <= NEAR_VERTICAL_TIE_EPSILON);

        let better: boolean;
        if (!bestPos) {
          better = true;
        } else if (!primaryDistTied) {
          better = primaryDist < bestPrimaryDist;
        } else {
          // SECONDARY (only among primaryDist-tied candidates): centerDist —
          // which of the ghost's own snap points should mate with this
          // shared target point.
          const centerDistTied =
            rayIsNearVertical && Math.abs(centerDist - bestCenterDist) <= NEAR_VERTICAL_TIE_EPSILON;

          if (!centerDistTied) {
            better = centerDist < bestCenterDist;
          } else {
            // TERTIARY: genuinely tied under a near-vertical aim even after
            // both metrics above — fall back to "build upward" rather than
            // let camera-math noise decide.
            better = candidateCenter.y > bestCenterY;
          }
        }

        if (better) {
          bestPos = candidatePos;
          bestPrimaryDist = primaryDist;
          bestCenterDist = centerDist;
          bestCenterY = candidateCenter.y;
        }
      }
    }
  }

  return bestPos;
}

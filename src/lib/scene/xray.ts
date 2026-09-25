// Pure, THREE-free x-ray slicing math — shared by Viewport.svelte and
// xray.test.ts, same split as catalog/derive.ts (see its module comment).
// Keeping this out of Viewport.svelte means the zoom/cutoff tuning that
// used to require a full browser round-trip to check is now covered by
// instant vitest runs; a browser check is only needed to confirm this is
// wired into the live scene correctly, not to re-verify the math itself.

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

// How much of the build's depth (camera-near side) gets sliced away is
// driven by zoom, not a fixed 50/50 split: zoomed out shows the whole build
// solid (or nearly so) so orbiting to check the exterior doesn't constantly
// cut half of it away; dollying in progressively peels back more of the
// near side, so "zooming into" a spot reveals deeper inside it. Expressed
// as a ratio of camera-to-target distance over the build's own size (see
// boundingRadius below) rather than an absolute world distance, so a tiny
// shed and a great hall both start slicing at a comparable relative zoom
// instead of one needing far more scroll than the other.
const ZOOM_RATIO_NO_SLICE = 1.2; // at/beyond this ratio: no slicing at all
const ZOOM_RATIO_MAX_SLICE = 0.3; // at/below this ratio: slicing maxes out
// Never quite 1 — always leave a sliver of the true back solid, so there's
// still something to land the cursor/eye on at max zoom rather than every
// single piece fading out together.
const MAX_SLICE_FRACTION = 0.85;

// Radius floor for a one-piece (or otherwise near-zero-extent) build, so a
// tiny/degenerate structure doesn't produce a near-zero radius and blow up
// the zoom ratio below.
const MIN_STRUCTURE_RADIUS = 0.5;

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

/**
 * Half the diagonal of the axis-aligned bounding box around `points` — an
 * angle-independent measure of "how big is this build" (unlike the
 * camera-projected depth range, which shrinks toward zero if you happen to
 * be looking edge-on along a flat build), so the zoom mapping doesn't jump
 * around purely from orbiting.
 */
export function boundingRadius(points: Vec3Like[]): number {
  if (points.length === 0) return MIN_STRUCTURE_RADIUS;

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.z < minZ) minZ = p.z;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
    if (p.z > maxZ) maxZ = p.z;
  }
  const dx = maxX - minX, dy = maxY - minY, dz = maxZ - minZ;
  const diagonal = Math.sqrt(dx * dx + dy * dy + dz * dz);
  return Math.max(diagonal / 2, MIN_STRUCTURE_RADIUS);
}

/** What fraction (0..MAX_SLICE_FRACTION) of the build's depth range to fade, given the current zoom. */
export function zoomSliceFraction(camDist: number, structureRadius: number): number {
  const ratio = camDist / Math.max(structureRadius, MIN_STRUCTURE_RADIUS);
  const t = clamp((ZOOM_RATIO_NO_SLICE - ratio) / (ZOOM_RATIO_NO_SLICE - ZOOM_RATIO_MAX_SLICE), 0, 1);
  return t * MAX_SLICE_FRACTION;
}

/** The camera-relative depth at/beyond which a piece is considered "front half" (faded) vs. solid. */
export function xraySliceCutoff(depthMin: number, depthMax: number, sliceFraction: number): number {
  return depthMin + (depthMax - depthMin) * sliceFraction;
}

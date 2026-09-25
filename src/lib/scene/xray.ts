// Pure, THREE-free x-ray slicing math — shared by Viewport.svelte and
// xray.test.ts, same split as catalog/derive.ts (see its module comment).
// Keeping this out of Viewport.svelte means the zoom/cutoff tuning that
// used to require a full browser round-trip to check is now covered by
// instant vitest runs; a browser check is only needed to confirm this is
// wired into the live scene correctly, not to re-verify the math itself.

// How much of the build's depth (camera-near side) gets sliced away is
// driven by zoom, not a fixed 50/50 split: zoomed out shows the whole build
// solid (or nearly so) so orbiting to check the exterior doesn't constantly
// cut half of it away; dollying in progressively peels back more of the
// near side, so "zooming into" a spot reveals deeper inside it.
//
// This used to be normalized against the whole build's own size (camera
// distance / bounding-radius), on the theory that a tiny shed and a great
// hall should both start slicing at a comparable relative zoom. That was
// wrong: Valheim pieces are a fixed real-world size regardless of how big
// the build is (a wall is ~2m whether it's part of a shed or a castle), so
// "how close do I need to get before it's worth seeing past the nearest
// wall" is a roughly CONSTANT absolute distance, not one that scales with
// the whole structure. The relative version required the camera to be
// within ~1.2x the build's own radius of the target — for any normally
// sized build at the default Iso preset (camera ~24 units out), that's
// essentially never true, so x-ray visibly did nothing under ordinary use
// (confirmed: toggling it at the default view produced zero opacity change
// for structures up to ~20 units in radius). Using plain world-unit
// thresholds against the NEAREST piece's actual depth instead fixes that,
// and needs no notion of "the whole build's size" at all.
const DEPTH_NO_SLICE = 10; // camera-to-nearest-piece depth at/beyond which: no slicing
const DEPTH_MAX_SLICE = 2.5; // at/below this depth: slicing maxes out
// Never quite 1 — always leave a sliver of the true back solid, so there's
// still something to land the cursor/eye on at max zoom rather than every
// single piece fading out together.
const MAX_SLICE_FRACTION = 0.85;

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

/**
 * What fraction (0..MAX_SLICE_FRACTION) of the build's depth range to fade,
 * given how close the camera currently is to the nearest placed piece
 * (`nearestDepth`, i.e. depthMin from the camera-relative projection in
 * Viewport.svelte).
 */
export function zoomSliceFraction(nearestDepth: number): number {
  const t = clamp((DEPTH_NO_SLICE - nearestDepth) / (DEPTH_NO_SLICE - DEPTH_MAX_SLICE), 0, 1);
  return t * MAX_SLICE_FRACTION;
}

/** The camera-relative depth at/beyond which a piece is considered "front half" (faded) vs. solid. */
export function xraySliceCutoff(depthMin: number, depthMax: number, sliceFraction: number): number {
  return depthMin + (depthMax - depthMin) * sliceFraction;
}

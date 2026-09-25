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
// Pushed further out twice now (was 10/2.5, then 16/5) — per direct
// feedback, err toward starting sooner and revealing more: x-ray is an
// opt-in toggle, so a bit of fade right at the default view (rather than
// requiring zoom-in first) is fine, since flipping back off always gets the
// solid exterior back. The default Iso view's nearest piece sits ~21 units
// out, so DEPTH_NO_SLICE above that means toggling x-ray on already shows a
// little something immediately, before any zooming.
const DEPTH_NO_SLICE = 26; // camera-to-nearest-piece depth at/beyond which: no slicing
const DEPTH_MAX_SLICE = 2; // at/below this depth: slicing maxes out
// How much of the depth range is ever hideable. Raised alongside the wider
// no-slice/max-slice gap above (was 0.85) — still short of 1 so there's
// always a sliver of true-back solid to land the cursor/eye on, but closer
// to it since the ask is specifically to be able to see farther in.
const MAX_SLICE_FRACTION = 0.92;

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

/**
 * What fraction (0..MAX_SLICE_FRACTION) of the build's depth range to fade,
 * given how close the camera currently is to the nearest placed piece.
 *
 * `nearestDepth` must be the RAW (un-height-biased) camera-view depth, not
 * the height-weighted one used for xraySliceCutoff's range/classification —
 * mixing the two creates a feedback loop: a tall roof piece's *height bias
 * alone* would drag depthMin down even at a fixed, unchanged camera
 * distance, which this function would then read as "the camera has zoomed
 * in a lot," inflating the fraction applied to an also-inflated (biased)
 * range. Net effect, confirmed by direct simulation: taller builds would
 * slice MORE aggressively than the actual camera zoom warrants, and
 * increasing the height weight only made it worse, not better. Keeping the
 * zoom-progress signal purely a function of real camera proximity (this
 * function) separate from which pieces that progress actually reaches
 * (heightWeightedDepth + xraySliceCutoff) avoids that entirely.
 */
export function zoomSliceFraction(nearestDepth: number): number {
  const t = clamp((DEPTH_NO_SLICE - nearestDepth) / (DEPTH_NO_SLICE - DEPTH_MAX_SLICE), 0, 1);
  return t * MAX_SLICE_FRACTION;
}

/** The camera-relative depth at/beyond which a piece is considered "front half" (faded) vs. solid. */
export function xraySliceCutoff(depthMin: number, depthMax: number, sliceFraction: number): number {
  return depthMin + (depthMax - depthMin) * sliceFraction;
}

// How much of a depth "head start" toward fading a piece gets per world
// unit it sits above the build's lowest piece. Deliberately NOT a piece-
// type classification (no "is this a roof/floor" check at all, unlike the
// wall/floor/roof/fence attempt that got dropped earlier for being
// name-matching-fragile) — just a bias on the one depth number the whole
// slice already ranks pieces by. A roof/ceiling piece is typically the
// highest thing in its story, so it fades before that story's own floor
// slab (0 height above itself, no bias) without needing to know it's
// specifically "a roof". Zooming in further keeps lowering the cutoff past
// the floor slab's own true depth and into the story below, so "reveal the
// next floor down" falls out of the same one mechanism, for as many
// stories as there are — no per-story bookkeeping.
//
// Tuned against real piece sizes (a wood wall is ~2.1m tall): a weight of 2
// gives a same-story roof-vs-floor separation of ~4 depth-units, a
// meaningful head start relative to the DEPTH_NO_SLICE/DEPTH_MAX_SLICE gap
// (24 units) without letting height alone dominate the camera-distance
// signal entirely.
const HEIGHT_WEIGHT = 2;

/**
 * The effective depth used for slicing, biased by how far above the
 * build's lowest piece this one sits (`relativeHeight`, i.e.
 * `piece.position.y - lowestPlacedY`, always >= 0).
 */
export function heightWeightedDepth(rawDepth: number, relativeHeight: number): number {
  return rawDepth - HEIGHT_WEIGHT * relativeHeight;
}

// How much of the screen (in normalized device coordinates, [-1, 1] per
// axis) is the "clear center" that faded pieces never render into at all —
// leaves the middle of the view completely unobstructed while a border
// strip still shows a hint that there's more hidden geometry out there. Not
// a true per-pixel effect (that would need a custom shader — meaningfully
// more risk/complexity for a "quick fix", and much harder to verify without
// eyeballing rendered screenshots); this instead classifies each faded
// piece as a whole by where its own position projects to on screen, which
// is enough for the intended "peripheral hint" effect at normal piece
// sizes. 0.75 means only the outer ~25% NDC band, near the screen edges on
// either axis, ever shows a faded piece.
const CENTER_CLEAR_NDC = 0.75;

/** Whether a screen position (NDC, [-1, 1] per axis) falls in the outer band where faded pieces are still shown. */
export function isInEdgeBand(ndcX: number, ndcY: number): boolean {
  return Math.max(Math.abs(ndcX), Math.abs(ndcY)) >= CENTER_CLEAR_NDC;
}

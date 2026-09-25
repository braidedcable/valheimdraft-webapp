import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { PieceData, PieceShape, Vec3 } from '../catalog/types';

export type { PieceShape };

/**
 * A thin box tilted to the piece's slope angle — not a solid triangular
 * wedge. Real Valheim roof pieces are just an angled surface, not a
 * filled-in ramp; a solid prism reads as a thick block, visibly wrong
 * (confirmed by eye against the real game). The panel's length is the
 * bounds' y/z diagonal (hypotenuse of the rise and run), tilted by
 * atan2(rise, run) around X so it spans that diagonal (or by `slopeOverride`
 * when the caller already knows the real angle from snap-point data — the
 * rise/run diagonal alone is only an approximation of the true slope);
 * thickness is a small fixed constant, not derived from data (there's
 * nothing in the dump to derive a "surface thickness" from). Confirmed
 * correct by eye for the pinned wood-tier roofs.
 */
function slopedPanelGeometry(width: number, rise: number, run: number, slopeOverride?: number): THREE.BufferGeometry {
  const thickness = 0.08;
  const length = Math.hypot(rise, run);
  const geometry = new THREE.BoxGeometry(width, thickness, length);
  geometry.rotateX(slopeOverride ?? Math.atan2(rise, run));
  return geometry;
}

/**
 * A real staircase profile (zigzag riser/tread outline) extruded across the
 * width — unlike roofs, stairs in-game are visibly stepped, not a flat
 * ramp. STEP_COUNT is a fixed guess (4), not derived from data — the dump
 * has no step-count field, this is purely a "looks like stairs" constant.
 *
 * NOT visually verified — this environment has no browser.
 */
const STEP_COUNT = 4;

function stairsGeometry(width: number, height: number, depth: number): THREE.BufferGeometry {
  const stepHeight = height / STEP_COUNT;
  const stepDepth = depth / STEP_COUNT;

  const shape = new THREE.Shape();
  let z = -depth / 2;
  let y = 0;
  shape.moveTo(z, y);
  for (let i = 0; i < STEP_COUNT; i++) {
    y += stepHeight;
    shape.lineTo(z, y); // riser
    z += stepDepth;
    shape.lineTo(z, y); // tread
  }
  shape.lineTo(z, 0); // back face down to the base
  shape.closePath(); // back along the base to the start

  const geometry = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false, curveSegments: 1 });
  // ExtrudeGeometry extrudes the XY profile along +Z; rotate so the profile
  // sits in the ZY plane and extrusion runs along X (width), then recenter.
  geometry.rotateY(Math.PI / 2);
  geometry.translate(-width / 2, 0, 0);
  return geometry;
}

/**
 * Two rails plus evenly spaced rungs, merged into one mesh and tilted to
 * the piece's slope angle (same atan2 approach as the roof panel) — a
 * ladder is an open frame, not a solid panel or block either (same
 * complaint as stairs, different shape). RUNG_COUNT is a fixed "looks like
 * a ladder" guess, not derived from data.
 *
 * NOT visually verified — this environment has no browser.
 */
const RUNG_COUNT = 6;

function ladderGeometry(width: number, rise: number, run: number): THREE.BufferGeometry {
  const length = Math.hypot(rise, run);
  const railThickness = 0.08;
  const rungThickness = 0.06;
  const railInset = width * 0.08; // rails sit slightly in from the outer edges

  const parts: THREE.BufferGeometry[] = [];

  for (const side of [-1, 1]) {
    const rail = new THREE.BoxGeometry(railThickness, railThickness, length);
    rail.translate(side * (width / 2 - railInset), 0, 0);
    parts.push(rail);
  }

  const rungSpan = width - railInset * 2;
  for (let i = 1; i <= RUNG_COUNT; i++) {
    const z = -length / 2 + (i / (RUNG_COUNT + 1)) * length;
    const rung = new THREE.BoxGeometry(rungSpan, rungThickness, rungThickness);
    rung.translate(0, 0, z);
    parts.push(rung);
  }

  const geometry = mergeGeometries(parts, false);
  geometry.rotateX(Math.atan2(rise, run));
  return geometry;
}

/**
 * Two horizontal rails plus evenly spaced vertical slats (a picket-fence
 * silhouette), merged. First attempt used horizontal crossbars instead —
 * looked like a bookshelf, not a fence. No attempt at parity with the real
 * mesh; the goal is just reading unmistakably as "fence" at a glance.
 * SLAT_COUNT (8) is a fixed "looks like a fence" guess, not derived from
 * data.
 *
 * NOT visually verified — this environment has no browser.
 */
const SLAT_COUNT = 8;

function fenceGeometry(width: number, height: number, depth: number): THREE.BufferGeometry {
  const railThickness = 0.06;
  const slatThickness = 0.05;
  const parts: THREE.BufferGeometry[] = [];

  for (const side of [-1, 1]) {
    const rail = new THREE.BoxGeometry(width, railThickness, depth);
    rail.translate(0, side * (height / 2 - railThickness / 2), 0);
    parts.push(rail);
  }

  for (let i = 0; i < SLAT_COUNT; i++) {
    const x = -width / 2 + ((i + 0.5) / SLAT_COUNT) * width;
    const slat = new THREE.BoxGeometry(slatThickness, height, depth);
    slat.translate(x, 0, 0);
    parts.push(slat);
  }

  return mergeGeometries(parts, false);
}

function v3(v: Vec3): THREE.Vector3 {
  return new THREE.Vector3(v.x, v.y, v.z);
}

/**
 * A thin volumetric slab through an arbitrary planar convex polygon (top +
 * bottom faces at ±thickness/2 along the polygon's own normal, plus one
 * side quad per edge, fan-triangulated from points[0]) — the building block
 * for every "flat panel that isn't an axis-aligned box" shape below (roof
 * corners, gable triangles, ridge halves), since Three.js has no built-in
 * non-rectangular "thin panel" primitive. Material is set DoubleSide when
 * using this (see DOUBLE_SIDED_SHAPES) as a safety net: face winding here is
 * a best-effort guess, unverified in a browser, and DoubleSide makes a
 * winding mistake merely non-realistic (visible from the "wrong" side too)
 * instead of invisible (backface-culled — the much worse failure mode).
 */
function thickPolygon(points: THREE.Vector3[], thickness: number): THREE.BufferGeometry {
  const normal = new THREE.Vector3()
    .subVectors(points[1], points[0])
    .cross(new THREE.Vector3().subVectors(points[2], points[0]))
    .normalize();
  const offset = normal.clone().multiplyScalar(thickness / 2);
  const top = points.map((p) => p.clone().add(offset));
  const bottom = points.map((p) => p.clone().sub(offset));
  const n = points.length;

  const positions: number[] = [];
  const pushTri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) =>
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);

  for (let i = 1; i < n - 1; i++) {
    pushTri(top[0], top[i], top[i + 1]);
    pushTri(bottom[i + 1], bottom[i], bottom[0]);
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    pushTri(top[i], bottom[i], bottom[j]);
    pushTri(top[i], bottom[j], top[j]);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * A hip corner (odd corner high) or valley corner (odd corner low) rises/
 * dips at exactly one of its four grid corners; the other three sit at the
 * opposite height. Two thin triangular panels sharing the diagonal fold
 * through the odd corner — not a single flat rectangular panel like the
 * plain roof piece — per direct feedback, corner pieces are visibly folded
 * in-game, not square.
 *
 * Which corner is the odd one out comes from `odd` (A/B/C/D), which the
 * caller derives from the piece's REAL snap-point data (see derive.ts's
 * classify()) rather than a guessed convention — checked directly for the
 * original wood corner pieces: wood_roof_ocorner's snap points put exactly
 * one of its four grid corners at the high side (corner A in this
 * labeling); wood_roof_icorner is the mirror (corner C low). When `odd` is
 * omitted (the two original pinned pieces), that A/C default is used
 * unchanged.
 *
 * NOT visually verified — this environment has no browser.
 */
function roofCornerGeometry(
  width: number,
  height: number,
  depth: number,
  style: 'hip' | 'valley',
  odd: 'A' | 'B' | 'C' | 'D' = style === 'hip' ? 'A' : 'C'
): THREE.BufferGeometry {
  const thickness = 0.08;
  const w = width / 2;
  const d = depth / 2;
  // Heights span ±height/2 around local origin — matches the convention
  // every other shape uses (box/panel/etc. all span ±bounds/2 around local
  // zero), which positionMesh's pos + rotate(center) composition relies on.
  const low = -height / 2;
  const high = height / 2;
  const rest = style === 'hip' ? low : high;
  const oddHeight = style === 'hip' ? high : low;

  const heights: Record<'A' | 'B' | 'C' | 'D', number> = { A: rest, B: rest, C: rest, D: rest };
  heights[odd] = oddHeight;

  const A = new THREE.Vector3(-w, heights.A, -d);
  const B = new THREE.Vector3(w, heights.B, -d);
  const C = new THREE.Vector3(w, heights.C, d);
  const D = new THREE.Vector3(-w, heights.D, d);

  return mergeGeometries([thickPolygon([A, B, C], thickness), thickPolygon([A, C, D], thickness)], false);
}

/**
 * A box or cylinder running between two ROOT-LOCAL points (as recorded by
 * the extractor, e.g. a piece's own two snap points), optionally extended
 * past each end by `ext` to approximately fill the piece's real bounds
 * (angled beams' true mesh reaches a bit past their connecting snap
 * points). Built directly in root-local coordinates — the caller must
 * translate the result by -center to convert to geometry space, same as
 * triangle/cross/ridge below.
 */
function segmentGeometry(a: Vec3, b: Vec3, thickness: number, round: boolean, ext: number): THREE.BufferGeometry {
  const pa = v3(a);
  const pb = v3(b);
  const dir = new THREE.Vector3().subVectors(pb, pa);
  const length = dir.length() + ext * 2;
  const geometry = round
    ? new THREE.CylinderGeometry(thickness / 2, thickness / 2, length, 10)
    : new THREE.BoxGeometry(thickness, thickness, length);
  // CylinderGeometry's axis is local Y; BoxGeometry's "length" dimension
  // here is local Z. Rotate that local axis onto the segment's direction.
  const localAxis = round ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
  const quat = new THREE.Quaternion().setFromUnitVectors(localAxis, dir.clone().normalize());
  geometry.applyQuaternion(quat);
  const mid = new THREE.Vector3().addVectors(pa, pb).multiplyScalar(0.5);
  geometry.translate(mid.x, mid.y, mid.z);
  return geometry;
}

/** A doorway-shaped opening (rectangular sides, semicircular top) cut from a flat panel — stone/darkwood archways. */
function archGeometry(width: number, height: number, thickness: number): THREE.BufferGeometry {
  const w = width / 2;
  const h = height / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-w, -h);
  shape.lineTo(w, -h);
  shape.lineTo(w, h);
  shape.lineTo(-w, h);
  shape.closePath();

  const radius = width * 0.25;
  const doorTopY = -h + height * 0.65;
  const hole = new THREE.Path();
  hole.moveTo(-radius, -h);
  hole.lineTo(-radius, doorTopY);
  hole.absarc(0, doorTopY, radius, Math.PI, 0, true);
  hole.lineTo(radius, -h);
  hole.closePath();
  shape.holes.push(hole);

  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 8 });
  geometry.translate(0, 0, -thickness / 2);
  return geometry;
}

/** An outer frame plus a bar grid (cage floors/walls) or vertical-only bars (a portcullis-style gate). */
function latticeGeometry(bounds: Vec3, mode: 'grid' | 'vertical'): THREE.BufferGeometry {
  const axes = ['x', 'y', 'z'] as const;
  const thinAxis = axes.reduce((a, b) => (bounds[a] <= bounds[b] ? a : b));
  const [uAxis, vAxis] = axes.filter((a) => a !== thinAxis);
  const thin = Math.max(bounds[thinAxis], 0.04);
  const uSize = bounds[uAxis];
  const vSize = bounds[vAxis];
  const barT = Math.min(thin, 0.05);
  const frameT = Math.max(thin * 1.5, 0.06);

  const parts: THREE.BufferGeometry[] = [];
  const makeBar = (uLen: number, vLen: number, uPos: number, vPos: number) => {
    const dims = { x: thin, y: thin, z: thin } as Record<'x' | 'y' | 'z', number>;
    dims[uAxis] = uLen;
    dims[vAxis] = vLen;
    const pos = { x: 0, y: 0, z: 0 } as Record<'x' | 'y' | 'z', number>;
    pos[uAxis] = uPos;
    pos[vAxis] = vPos;
    const geo = new THREE.BoxGeometry(dims.x, dims.y, dims.z);
    geo.translate(pos.x, pos.y, pos.z);
    parts.push(geo);
  };

  makeBar(uSize, frameT, 0, -vSize / 2 + frameT / 2);
  makeBar(uSize, frameT, 0, vSize / 2 - frameT / 2);
  makeBar(frameT, vSize, -uSize / 2 + frameT / 2, 0);
  makeBar(frameT, vSize, uSize / 2 - frameT / 2, 0);

  if (mode === 'vertical') {
    const BAR_COUNT = 5;
    for (let i = 1; i <= BAR_COUNT; i++) {
      makeBar(barT, vSize, -uSize / 2 + (i / (BAR_COUNT + 1)) * uSize, 0);
    }
  } else {
    const BARS = 3;
    for (let i = 1; i <= BARS; i++) {
      makeBar(barT, vSize, -uSize / 2 + (i / (BARS + 1)) * uSize, 0);
    }
    for (let i = 1; i <= BARS; i++) {
      makeBar(uSize, barT, 0, -vSize / 2 + (i / (BARS + 1)) * vSize);
    }
  }

  return mergeGeometries(parts, false);
}

/**
 * A framed door: an actual through-hole cut in the frame (same
 * hole-in-a-flat-panel technique as archGeometry — a subtly recessed flush
 * leaf turned out to be visually indistinguishable from a plain box under
 * this app's flat directional lighting, since there's no shading cue for a
 * few-centimeter depth difference; a real silhouette gap reads correctly
 * from any angle and any lighting), plus one or two leaf panels offset
 * within the opening (single door: ajar, covering part of the opening;
 * double door: two leaves with a visible gap between them) so the door
 * reads as a door — frame, opening, and leaf — not a solid block.
 */
function doorGeometry(bounds: Vec3, leaves: 1 | 2): THREE.BufferGeometry {
  const w = bounds.x;
  const h = bounds.y;
  const t = bounds.z;
  const frameT = Math.max(w * 0.07, 0.08);
  const openW = w - frameT * 2;
  const openH = h - frameT * 1.6;
  const openBottomY = -h / 2 + frameT * 0.3;
  const openCenterY = openBottomY + openH / 2;

  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, -h / 2);
  shape.lineTo(w / 2, -h / 2);
  shape.lineTo(w / 2, h / 2);
  shape.lineTo(-w / 2, h / 2);
  shape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-openW / 2, openBottomY);
  hole.lineTo(openW / 2, openBottomY);
  hole.lineTo(openW / 2, openBottomY + openH);
  hole.lineTo(-openW / 2, openBottomY + openH);
  hole.closePath();
  shape.holes.push(hole);
  const frame = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments: 1 });
  frame.translate(0, 0, -t / 2);

  // ExtrudeGeometry (the frame, above) is non-indexed; BoxGeometry (the
  // leaves, below) is indexed by default. mergeGeometries() requires either
  // all-or-none of its inputs to be indexed, so the leaves are de-indexed
  // to match before merging.
  const parts: THREE.BufferGeometry[] = [frame];
  const leafT = t * 0.3;
  const leafZ = t * 0.2; // proud of the frame's front face — a real depth offset, not a shading-only cue

  if (leaves === 2) {
    const gap = openW * 0.12;
    const leafW = (openW - gap) / 2;
    for (const side of [-1, 1]) {
      const leaf = new THREE.BoxGeometry(leafW * 0.9, openH * 0.94, leafT).toNonIndexed();
      leaf.translate(side * (gap / 2 + leafW / 2), openCenterY, leafZ);
      parts.push(leaf);
    }
  } else {
    const leafW = openW * 0.62;
    const leaf = new THREE.BoxGeometry(leafW, openH * 0.94, leafT).toNonIndexed();
    leaf.translate(-(openW - leafW) / 2, openCenterY, leafZ);
    parts.push(leaf);
  }

  return mergeGeometries(parts, false);
}

/** Two thin sloped panels sharing a ridge line — a roof-ridge cap spanning the piece's full width. Root-local; caller centers by `center`. */
function ridgeGeometry(halfWidth: number, eaveZ: number, eaveY: number, ridgeY: number, t: number): THREE.BufferGeometry {
  const panel = (zSign: 1 | -1) => {
    const eaveLeft = new THREE.Vector3(-halfWidth, eaveY, zSign * eaveZ);
    const eaveRight = new THREE.Vector3(halfWidth, eaveY, zSign * eaveZ);
    const ridgeRight = new THREE.Vector3(halfWidth, ridgeY, 0);
    const ridgeLeft = new THREE.Vector3(-halfWidth, ridgeY, 0);
    return thickPolygon([eaveLeft, eaveRight, ridgeRight, ridgeLeft], t);
  };
  return mergeGeometries([panel(1), panel(-1)], false);
}

// Shapes whose face winding is a best-effort, unverified guess (see
// thickPolygon above) — callers should render these DoubleSide so a
// winding mistake is merely non-realistic instead of invisible.
export const DOUBLE_SIDED_SHAPES: ReadonlySet<PieceShape> = new Set(['hip', 'valley', 'triangle', 'ridge']);

export function geometryForPiece(piece: PieceData): THREE.BufferGeometry {
  const { shape, bounds, center, geom } = piece;
  switch (shape) {
    case 'cylinder': {
      const radius = Math.max(bounds.x, bounds.z) / 2;
      return new THREE.CylinderGeometry(radius, radius, bounds.y, 12);
    }
    case 'wedge':
      return slopedPanelGeometry(bounds.x, bounds.y, bounds.z, geom?.kind === 'wedge' ? geom.slope : undefined);
    case 'stairs':
      return stairsGeometry(bounds.x, bounds.y, bounds.z);
    case 'ladder':
      return ladderGeometry(bounds.x, bounds.y, bounds.z);
    case 'fence':
      return fenceGeometry(bounds.x, bounds.y, bounds.z);
    case 'hip':
    case 'valley':
      return roofCornerGeometry(bounds.x, bounds.y, bounds.z, shape, geom?.kind === 'corner' ? geom.odd : undefined);
    case 'arch':
      return archGeometry(bounds.x, bounds.y, bounds.z);
    case 'lattice':
      return latticeGeometry(bounds, geom?.kind === 'lattice' ? geom.bars : 'grid');
    case 'door':
      return doorGeometry(bounds, geom?.kind === 'door' ? geom.leaves : 1);
    case 'beam': {
      if (geom?.kind !== 'beam') throw new Error(`piece ${piece.prefab}: shape 'beam' requires geom`);
      const geometry = segmentGeometry(geom.a, geom.b, geom.t, geom.round ?? false, geom.ext);
      geometry.translate(-center.x, -center.y, -center.z);
      return geometry;
    }
    case 'triangle': {
      if (geom?.kind !== 'triangle') throw new Error(`piece ${piece.prefab}: shape 'triangle' requires geom`);
      const geometry = thickPolygon(geom.p.map(v3), geom.t);
      geometry.translate(-center.x, -center.y, -center.z);
      return geometry;
    }
    case 'cross': {
      if (geom?.kind !== 'cross') throw new Error(`piece ${piece.prefab}: shape 'cross' requires geom`);
      const t = geom.t * 0.6;
      const geometry = mergeGeometries(
        [segmentGeometry(geom.a1, geom.b1, t, false, 0), segmentGeometry(geom.a2, geom.b2, t, false, 0)],
        false
      );
      geometry.translate(-center.x, -center.y, -center.z);
      return geometry;
    }
    case 'ridge': {
      if (geom?.kind !== 'ridge') throw new Error(`piece ${piece.prefab}: shape 'ridge' requires geom`);
      const geometry = ridgeGeometry(geom.halfWidth, geom.eaveZ, geom.eaveY, geom.ridgeY, geom.t);
      geometry.translate(-center.x, -center.y, -center.z);
      return geometry;
    }
    case 'box':
    default:
      return new THREE.BoxGeometry(bounds.x, bounds.y, bounds.z);
  }
}

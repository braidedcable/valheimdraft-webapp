import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export type PieceShape = 'box' | 'cylinder' | 'wedge' | 'stairs' | 'ladder' | 'fence' | 'hip' | 'valley';

/**
 * A thin box tilted to the piece's slope angle — not a solid triangular
 * wedge. Real Valheim roof pieces are just an angled surface, not a
 * filled-in ramp; a solid prism reads as a thick block, visibly wrong
 * (confirmed by eye against the real game). The panel's length is the
 * bounds' y/z diagonal (hypotenuse of the rise and run), tilted by
 * atan2(rise, run) around X so it spans that diagonal; thickness is a small
 * fixed constant, not derived from data (there's nothing in the dump to
 * derive a "surface thickness" from). Confirmed correct by eye.
 */
function slopedPanelGeometry(width: number, rise: number, run: number): THREE.BufferGeometry {
  const thickness = 0.08;
  const length = Math.hypot(rise, run);
  const geometry = new THREE.BoxGeometry(width, thickness, length);
  geometry.rotateX(Math.atan2(rise, run));
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

/**
 * A thin volumetric triangle (top + bottom faces at ±thickness/2 along the
 * triangle's own normal, plus 3 side quads) — the building block for the
 * folded roof-corner shape below, since Three.js has no non-rectangular
 * "thin panel" primitive. Material is set DoubleSide when using this (see
 * roofCornerGeometry) as a safety net: face winding here is a best-effort
 * guess, unverified in a browser, and DoubleSide makes a winding mistake
 * merely non-realistic (visible from the "wrong" side too) instead of
 * invisible (backface-culled — the much worse failure mode).
 */
function thickTriangle(p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3, thickness: number): THREE.BufferGeometry {
  const normal = new THREE.Vector3().subVectors(p2, p1).cross(new THREE.Vector3().subVectors(p3, p1)).normalize();
  const offset = normal.clone().multiplyScalar(thickness / 2);
  const top = [p1.clone().add(offset), p2.clone().add(offset), p3.clone().add(offset)];
  const bottom = [p1.clone().sub(offset), p2.clone().sub(offset), p3.clone().sub(offset)];

  const positions: number[] = [];
  const pushTri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) =>
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);

  pushTri(top[0], top[1], top[2]);
  pushTri(bottom[2], bottom[1], bottom[0]);
  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3;
    pushTri(top[i], bottom[i], bottom[j]);
    pushTri(top[i], bottom[j], top[j]);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * A hip corner (style='hip') rises from three low grid corners up to one
 * high corner via a diagonal fold; a valley corner (style='valley') is the
 * mirror — one low corner, three high. Two thin triangular panels sharing
 * the diagonal fold line, not a single flat rectangular panel like the
 * plain roof piece — per direct feedback, corner pieces are visibly
 * folded in-game, not square.
 *
 * Which corner is the odd one out is grounded in the piece's REAL
 * snap-point data (checked directly, not a guessed convention):
 * wood_roof_ocorner's snap points put exactly one of its four grid
 * corners at y=1 (the rest at y=0); wood_roof_icorner is the mirror. An
 * earlier version guessed the wrong diagonal corner as the peak, which is
 * the likely cause of a "scooted inward" report — the visual mesh's fold
 * was on the opposite corner from where the real connecting snap points
 * actually are.
 *
 * Slope matching with the adjacent straight roof panel (also direct
 * feedback) — each triangle's rising edge derives its height from this
 * SAME piece's own real extracted bounds, same grounding as the straight
 * panel's atan2(bounds.y, bounds.z), not an invented angle.
 *
 * NOT visually verified — this environment has no browser.
 */
function roofCornerGeometry(
  width: number,
  height: number,
  depth: number,
  style: 'hip' | 'valley'
): THREE.BufferGeometry {
  const thickness = 0.08;
  const w = width / 2;
  const d = depth / 2;
  // Raw corner heights span [0, height] — shift down by height/2 so the
  // geometry is centered on its own local origin like every other shape
  // (box/panel/etc. all span ±bounds.y/2 around local zero). positionMesh
  // combines pos + rotate(center) assuming that convention; building this
  // one asymmetric (spanning [0, height] instead) put it out of alignment
  // with every adjacent piece — this was the actual bug, not a slope or
  // topology mismatch.
  const low = -height / 2;
  const high = height / 2;

  // Which corner is the odd one out, and which diagonal it sits on, comes
  // from wood_roof_ocorner/icorner's REAL snap-point data (checked
  // directly, not guessed): ocorner has 3 grid corners at y=0 and exactly
  // one — (x=-1, z=-1), i.e. corner A in this labeling — at y=1. icorner
  // is the mirror: 3 corners high, one — (x=1, z=1), corner C — low. An
  // earlier version put the "hip" peak at C instead of A (the wrong
  // diagonal corner), which was likely the actual cause of pieces reading
  // as shifted inward relative to adjacent straight panels.
  const heights = style === 'hip' ? { A: high, B: low, C: low, D: low } : { A: high, B: high, C: low, D: high };

  const A = new THREE.Vector3(-w, heights.A, -d);
  const B = new THREE.Vector3(w, heights.B, -d);
  const C = new THREE.Vector3(w, heights.C, d);
  const D = new THREE.Vector3(-w, heights.D, d);

  return mergeGeometries([thickTriangle(A, B, C, thickness), thickTriangle(A, C, D, thickness)], false);
}

// Shapes whose face winding is a best-effort, unverified guess (see
// thickTriangle above) — callers should render these DoubleSide so a
// winding mistake is merely non-realistic instead of invisible.
export const DOUBLE_SIDED_SHAPES: ReadonlySet<PieceShape> = new Set(['hip', 'valley']);

export function geometryForPiece(shape: PieceShape, bounds: { x: number; y: number; z: number }): THREE.BufferGeometry {
  switch (shape) {
    case 'cylinder': {
      const radius = Math.max(bounds.x, bounds.z) / 2;
      return new THREE.CylinderGeometry(radius, radius, bounds.y, 12);
    }
    case 'wedge':
      return slopedPanelGeometry(bounds.x, bounds.y, bounds.z);
    case 'stairs':
      return stairsGeometry(bounds.x, bounds.y, bounds.z);
    case 'ladder':
      return ladderGeometry(bounds.x, bounds.y, bounds.z);
    case 'fence':
      return fenceGeometry(bounds.x, bounds.y, bounds.z);
    case 'hip':
      return roofCornerGeometry(bounds.x, bounds.y, bounds.z, 'hip');
    case 'valley':
      return roofCornerGeometry(bounds.x, bounds.y, bounds.z, 'valley');
    case 'box':
    default:
      return new THREE.BoxGeometry(bounds.x, bounds.y, bounds.z);
  }
}

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export type PieceShape = 'box' | 'cylinder' | 'wedge' | 'stairs' | 'ladder' | 'frame';

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
 * An outer frame (4 posts/rails) plus horizontal crossbar slats, merged —
 * a solid box reads as a wall regardless of its proportions; a gate needs
 * to look open (visible gaps), not filled in. No rotation (unlike the
 * roof/ladder, a gate hangs vertically, doesn't slope). CROSSBAR_COUNT (2)
 * is a fixed "looks like a gate" guess, not derived from data.
 *
 * NOT visually verified — this environment has no browser.
 */
const CROSSBAR_COUNT = 2;

function frameGeometry(width: number, height: number, depth: number): THREE.BufferGeometry {
  const railThickness = 0.06;
  const parts: THREE.BufferGeometry[] = [];

  // Vertical posts (left, right).
  for (const side of [-1, 1]) {
    const post = new THREE.BoxGeometry(railThickness, height, depth);
    post.translate(side * (width / 2 - railThickness / 2), 0, 0);
    parts.push(post);
  }
  // Horizontal top/bottom rails.
  for (const side of [-1, 1]) {
    const rail = new THREE.BoxGeometry(width, railThickness, depth);
    rail.translate(0, side * (height / 2 - railThickness / 2), 0);
    parts.push(rail);
  }
  // Crossbar slats, evenly spaced between the rails.
  const slatWidth = width - railThickness * 2;
  for (let i = 1; i <= CROSSBAR_COUNT; i++) {
    const y = -height / 2 + (i / (CROSSBAR_COUNT + 1)) * height;
    const slat = new THREE.BoxGeometry(slatWidth, railThickness, depth);
    slat.translate(0, y, 0);
    parts.push(slat);
  }

  return mergeGeometries(parts, false);
}

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
    case 'frame':
      return frameGeometry(bounds.x, bounds.y, bounds.z);
    case 'box':
    default:
      return new THREE.BoxGeometry(bounds.x, bounds.y, bounds.z);
  }
}

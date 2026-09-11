import * as THREE from 'three';

export type PieceShape = 'box' | 'cylinder' | 'wedge' | 'stairs';

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
    case 'box':
    default:
      return new THREE.BoxGeometry(bounds.x, bounds.y, bounds.z);
  }
}

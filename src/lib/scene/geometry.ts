import * as THREE from 'three';

export type PieceShape = 'box' | 'cylinder' | 'wedge';

/**
 * A thin box tilted to the piece's slope angle — not a solid triangular
 * wedge. Real Valheim roof/stair pieces are just an angled surface, not a
 * filled-in ramp; a solid prism reads as a thick block, visibly wrong
 * (confirmed by eye against the real game). The panel's length is the
 * bounds' y/z diagonal (hypotenuse of the rise and run), tilted by
 * atan2(rise, run) around X so it spans that diagonal; thickness is a small
 * fixed constant, not derived from data (there's nothing in the dump to
 * derive a "surface thickness" from).
 *
 * NOT visually verified for direction/sign — this environment has no
 * browser. Which way it tilts (matching the piece's actual high/low edge)
 * needs a look via `npm run dev`; flipping the rotation sign is a one-line
 * fix if it's backwards.
 */
function slopedPanelGeometry(width: number, rise: number, run: number): THREE.BufferGeometry {
  const thickness = 0.08;
  const length = Math.hypot(rise, run);
  const geometry = new THREE.BoxGeometry(width, thickness, length);
  geometry.rotateX(Math.atan2(rise, run));
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
    case 'box':
    default:
      return new THREE.BoxGeometry(bounds.x, bounds.y, bounds.z);
  }
}

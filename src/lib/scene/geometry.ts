import * as THREE from 'three';

export type PieceShape = 'box' | 'cylinder' | 'wedge';

/**
 * Builds a right-triangular-prism "ramp" geometry via ExtrudeGeometry
 * (native Three.js, no hand-rolled vertex/index buffers): a triangle profile
 * — flat at one end, rising to full height at the other — extruded across
 * the width. Approximates roof/stair pieces; not a faithful reproduction of
 * their real (stepped/angled) geometry, per the art strategy's "flat
 * procedural shapes, no per-piece hand art" call.
 *
 * NOT visually verified — this environment has no browser. Check orientation
 * (which way the ramp rises, whether faces are visible/not backface-culled)
 * against `npm run dev` before trusting it for placement.
 */
function wedgeGeometry(width: number, height: number, depth: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-depth / 2, 0);
  shape.lineTo(depth / 2, 0);
  shape.lineTo(depth / 2, height);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false, curveSegments: 1 });
  // ExtrudeGeometry extrudes the XY profile along +Z; rotate so the profile
  // sits in the ZY plane and extrusion runs along X (width), then recenter
  // (extrude starts at the origin, not centered).
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
      return wedgeGeometry(bounds.x, bounds.y, bounds.z);
    case 'box':
    default:
      return new THREE.BoxGeometry(bounds.x, bounds.y, bounds.z);
  }
}

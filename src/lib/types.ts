export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Quat {
  x: number;
  y: number;
  z: number;
  w: number;
}

// Matches the resolved scene-state shape (same fields .vbuild needs), plus
// an id for Svelte keying / removal.
export interface PlacedPiece {
  id: string;
  prefab: string;
  pos: Vec3;
  rot: Quat;
}

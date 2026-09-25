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

export interface SnapPoint {
  pos: Vec3;
  rot: Quat;
}

export interface CostItem {
  item: string;
  amount: number;
  recover: boolean;
}

// Shapes buildable with a bare box/cylinder/etc. from bounds alone, plus the
// original hand-built roof/functional shapes from the wood-tier MVP.
export type LegacyShape = 'box' | 'cylinder' | 'wedge' | 'stairs' | 'ladder' | 'fence' | 'hip' | 'valley';

// Shapes whose geometry is derived from a piece's own snap-point layout
// rather than bounds alone — added for the catalog-expansion batches.
export type DerivedShape = 'beam' | 'triangle' | 'cross' | 'ridge' | 'arch' | 'lattice' | 'door';

export type PieceShape = LegacyShape | DerivedShape;

// Precomputed, piece-specific parameters for shapes whose geometry can't be
// fully determined from `bounds` alone. Kept as plain numbers/strings (no
// THREE dependency) so this can be computed once by the generator, stored in
// pieces.json, and consumed by both geometry.ts and the vitest suite.
export type ShapeParams =
  | { kind: 'beam'; a: Vec3; b: Vec3; t: number; round?: boolean; ext: number }
  | { kind: 'triangle'; p: [Vec3, Vec3, Vec3]; t: number }
  | { kind: 'cross'; a1: Vec3; b1: Vec3; a2: Vec3; b2: Vec3; t: number }
  | { kind: 'ridge'; halfWidth: number; eaveZ: number; eaveY: number; ridgeY: number; t: number }
  | { kind: 'wedge'; slope: number }
  | { kind: 'corner'; odd: 'A' | 'B' | 'C' | 'D' }
  | { kind: 'lattice'; bars: 'grid' | 'vertical' }
  | { kind: 'door'; leaves: 1 | 2 };

export interface PieceData {
  prefab: string;
  label: string;
  family: string; // material/tier family — drives both palette grouping and render color
  batch: number;
  menuIndex: number;
  shape: PieceShape;
  bounds: Vec3;
  center: Vec3;
  snapPoints: SnapPoint[];
  cost: CostItem[];
  geom?: ShapeParams;
}

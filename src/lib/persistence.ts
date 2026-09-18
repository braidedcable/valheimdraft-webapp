import type { PlacedPiece, Vec3, Quat } from './types';

// Versioned envelope so future format changes (new fields, migrations) have
// somewhere to branch instead of guessing from a bare array.
export interface SceneEnvelopeV1 {
  version: 1;
  pieces: PlacedPiece[];
}

export type SceneEnvelope = SceneEnvelopeV1;

export const CURRENT_VERSION = 1 as const;

export function serialize(pieces: PlacedPiece[]): string {
  const envelope: SceneEnvelopeV1 = { version: CURRENT_VERSION, pieces };
  return JSON.stringify(envelope);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isVec3(value: unknown): value is Vec3 {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return isFiniteNumber(v.x) && isFiniteNumber(v.y) && isFiniteNumber(v.z);
}

function isQuat(value: unknown): value is Quat {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return isFiniteNumber(v.x) && isFiniteNumber(v.y) && isFiniteNumber(v.z) && isFiniteNumber(v.w);
}

function isPlacedPiece(value: unknown): value is PlacedPiece {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.prefab === 'string' &&
    isVec3(v.pos) &&
    isQuat(v.rot)
  );
}

// Parses and validates untrusted input (localStorage now; file
// upload/URL-hash import later). Never throws — returns null on anything
// malformed so callers can fall back to a clean empty state.
export function deserialize(raw: string): PlacedPiece[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) return null;
  const envelope = parsed as Record<string, unknown>;

  if (envelope.version !== CURRENT_VERSION) return null;
  if (!Array.isArray(envelope.pieces)) return null;
  if (!envelope.pieces.every(isPlacedPiece)) return null;

  return envelope.pieces as PlacedPiece[];
}

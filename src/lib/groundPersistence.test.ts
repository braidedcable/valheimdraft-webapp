import { describe, it, expect } from 'vitest';
import { serialize, deserialize, deserializeScene } from './persistence';
import { encodeSceneToHash, decodeSceneFromHash, decodeSceneFromHashFull } from './shareUrl';
import type { PlacedPiece } from './types';

const pieces: PlacedPiece[] = [
  { id: 'a', prefab: 'wood_wall', pos: { x: 1, y: 2, z: 3 }, rot: { x: 0, y: 0, z: 0, w: 1 } },
];

describe('groundLevel persistence', () => {
  it('round-trips a level', () => {
    const scene = deserializeScene(serialize(pieces, -3));
    expect(scene).toEqual({ pieces, groundLevel: -3 });
  });
  it('old payloads load as level 0', () => {
    const old = JSON.stringify({ version: 1, pieces });
    expect(deserializeScene(old)?.groundLevel).toBe(0);
    expect(deserialize(old)).toEqual(pieces);
  });
  it('level 0 is omitted and junk levels are sanitized', () => {
    expect(serialize(pieces)).toBe(JSON.stringify({ version: 1, pieces }));
    const junk = JSON.stringify({ version: 1, pieces, groundLevel: 'high' });
    expect(deserializeScene(junk)?.groundLevel).toBe(0);
  });
  it('deserialize still returns pieces when a level is present', () => {
    expect(deserialize(serialize(pieces, 5))).toEqual(pieces);
  });
  it('share hash carries the level', async () => {
    const hash = await encodeSceneToHash(pieces, 4);
    const noId = (ps: typeof pieces) => ps.map(({ id: _id, ...rest }) => rest);
    const full = await decodeSceneFromHashFull(hash);
    expect(full?.groundLevel).toBe(4);
    expect(noId(full!.pieces)).toEqual(noId(pieces));
    expect(noId((await decodeSceneFromHash(hash))!)).toEqual(noId(pieces));
    const plain = await encodeSceneToHash(pieces);
    expect((await decodeSceneFromHashFull(plain))?.groundLevel).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';
import {
  buildShareUrl,
  decodeSceneFromHash,
  encodeSceneToHash,
  ShareUrlTooLongError,
} from './shareUrl';
import type { PlacedPiece } from './types';

function makePiece(id: string, x: number, y: number, z: number): PlacedPiece {
  return { id, prefab: 'wood_floor', pos: { x, y, z }, rot: { x: 0, y: 0, z: 0, w: 1 } };
}

function makePieces(n: number): PlacedPiece[] {
  return Array.from({ length: n }, (_, i) => makePiece(`p${i}`, i * 2, 0, i % 13));
}

describe('buildShareUrl', () => {
  it('joins origin, pathname and hash under a sub-path base', () => {
    expect(buildShareUrl({ origin: 'https://a.io', pathname: '/valheimdraft-webapp/' }, 'gabc')).toBe(
      'https://a.io/valheimdraft-webapp/#gabc'
    );
  });

  it('ignores search/hash present on a full Location', () => {
    const loc = { origin: 'https://a.io', pathname: '/x/', search: '?q=1', hash: '#old' };
    expect(buildShareUrl(loc, 'r1')).toBe('https://a.io/x/#r1');
  });
});

describe('encode/decode round trip', () => {
  it('round-trips pieces', async () => {
    const pieces = makePieces(5);
    const encoded = await encodeSceneToHash(pieces);
    expect(encoded).toMatch(/^[gr][A-Za-z0-9_-]+$/);
    expect(await decodeSceneFromHash(encoded)).toEqual(pieces);
  });

  it('returns null for garbage', async () => {
    expect(await decodeSceneFromHash('zzz')).toBeNull();
    expect(await decodeSceneFromHash('')).toBeNull();
  });

  it('throws ShareUrlTooLongError for huge scenes', async () => {
    const big = Array.from({ length: 3000 }, (_, i) =>
      makePiece(`${Math.random()}-${i}`, Math.random() * 1000, Math.random() * 1000, Math.random() * 1000)
    );
    await expect(encodeSceneToHash(big)).rejects.toBeInstanceOf(ShareUrlTooLongError);
  });
});

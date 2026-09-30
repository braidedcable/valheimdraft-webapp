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
    const decoded = await decodeSceneFromHash(encoded);
    // ids are regenerated on decode (stripped from the encoding)
    expect(decoded?.map(({ id: _id, ...rest }) => rest)).toEqual(pieces.map(({ id: _id, ...rest }) => rest));
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

import { encodeSceneToCode, extractShareCode, decodeSceneFromInput } from './shareUrl';

describe('build code', () => {
  const many = Array.from({ length: 3000 }, (_, i) => ({
    id: crypto.randomUUID(),
    prefab: 'wood_wall_1x1',
    pos: { x: (i % 50) * 2.0000000123, y: Math.floor(i / 2500) * 2, z: Math.floor((i % 2500) / 50) * 2 },
    rot: { x: 0, y: 0, z: 0, w: 1 },
  }));

  it('has no length limit and round-trips with fresh unique ids', async () => {
    const code = await encodeSceneToCode(many, 3);
    const scene = await decodeSceneFromInput(code);
    expect(scene?.pieces).toHaveLength(3000);
    expect(scene?.groundLevel).toBe(3);
    expect(new Set(scene!.pieces.map((p) => p.id)).size).toBe(3000);
    expect(scene!.pieces[1].pos.x).toBeCloseTo(2, 3);
  });

  it('accepts full URLs and whitespace-wrapped codes', async () => {
    const code = await encodeSceneToCode(many.slice(0, 5));
    const wrapped = code.replace(/(.{20})/g, '$1\n');
    expect(extractShareCode(`https://x.y/app/#${code}`)).toBe(code);
    expect((await decodeSceneFromInput(wrapped))?.pieces).toHaveLength(5);
    expect(await decodeSceneFromInput('garbage')).toBeNull();
  });
});

import { describe, it, expect } from 'vitest';
import piecesData from '../data/pieces.json';
import { pushRecent, sanitizeRecent, loadRecent, saveRecent, RECENT_KEY, RECENT_LIMIT } from './recentPieces';

const [a, b, c] = piecesData.pieces.map((p) => p.prefab);

describe('pushRecent', () => {
  it('puts newest first and de-duplicates', () => {
    expect(pushRecent([a, b], c)).toEqual([c, a, b]);
    expect(pushRecent([a, b, c], c)).toEqual([c, a, b]);
  });
  it('caps length', () => {
    const many = Array.from({ length: 20 }, (_, i) => `p${i}`);
    expect(pushRecent(many, 'new')).toHaveLength(RECENT_LIMIT);
    expect(pushRecent(many, 'new')[0]).toBe('new');
  });
  it('does not mutate input', () => {
    const l = [a];
    pushRecent(l, b);
    expect(l).toEqual([a]);
  });
});

describe('sanitizeRecent', () => {
  it('rejects non-arrays', () => {
    expect(sanitizeRecent({})).toEqual([]);
    expect(sanitizeRecent(null)).toEqual([]);
  });
  it('drops unknown, non-string and duplicate entries', () => {
    expect(sanitizeRecent([a, 'nope', 5, a, b])).toEqual([a, b]);
  });
});

describe('load/save', () => {
  it('round-trips', () => {
    const store: Record<string, string> = {};
    saveRecent([a, b], { setItem: (k, v) => void (store[k] = v) });
    expect(store[RECENT_KEY]).toBe(JSON.stringify([a, b]));
    expect(loadRecent({ getItem: (k) => store[k] ?? null })).toEqual([a, b]);
  });
  it('survives corrupt JSON and throwing storage', () => {
    expect(loadRecent({ getItem: () => '{bad' })).toEqual([]);
    expect(
      loadRecent({
        getItem: () => {
          throw new Error('x');
        },
      })
    ).toEqual([]);
    expect(() =>
      saveRecent([a], {
        setItem: () => {
          throw new Error('x');
        },
      })
    ).not.toThrow();
  });
});

import piecesData from '../data/pieces.json';

export const RECENT_KEY = 'valheimdraft.recentPieces';
export const RECENT_LIMIT = 12;

const KNOWN = new Set<string>(piecesData.pieces.map((p) => p.prefab));

/** Push-to-front MRU: moves `prefab` to the front, de-duplicates, caps length. */
export function pushRecent(list: readonly string[], prefab: string, limit = RECENT_LIMIT): string[] {
  return [prefab, ...list.filter((p) => p !== prefab)].slice(0, limit);
}

/** Drops non-strings, unknown prefabs and duplicates; caps length. */
export function sanitizeRecent(value: unknown, known: ReadonlySet<string> = KNOWN, limit = RECENT_LIMIT): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const v of value) {
    if (typeof v === 'string' && known.has(v) && !out.includes(v)) out.push(v);
    if (out.length >= limit) break;
  }
  return out;
}

export function loadRecent(storage?: Pick<Storage, 'getItem'>): string[] {
  try {
    const raw = (storage ?? localStorage).getItem(RECENT_KEY);
    return raw === null ? [] : sanitizeRecent(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveRecent(list: readonly string[], storage?: Pick<Storage, 'setItem'>): void {
  try {
    (storage ?? localStorage).setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    // best-effort only
  }
}

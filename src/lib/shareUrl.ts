import { serialize, deserializeScene, type LoadedScene } from './persistence';
import type { PlacedPiece } from './types';

// Encoded format: a one-character tag identifying how the rest of the
// string was produced, followed by base64url data. The tag lets the
// decoder know whether to run it through DecompressionStream or treat it
// as plain JSON bytes, rather than guessing (or trying both).
//   'g' = gzip-compressed JSON, base64url-encoded
//   'r' = raw (uncompressed) JSON, base64url-encoded — used when
//         CompressionStream/DecompressionStream aren't available
const FORMAT_GZIP = 'g';
const FORMAT_RAW = 'r';

// A hard ceiling on the encoded hash length. Most browsers/servers handle
// URLs well beyond this, but there's no reason to hand back something
// pathological for an enormous layout — better to fail loudly so the UI
// can tell the user to trim the layout or use Export instead.
export const MAX_HASH_LENGTH = 8000;

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (base64.length % 4)) % 4;
  const padded = base64 + '='.repeat(padLength);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function supportsCompressionStreams(): boolean {
  return typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';
}

async function gzipCompress(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new CompressionStream('gzip');
  const writer = stream.writable.getWriter();
  // Fire-and-forget write/close; the response below awaits the readable
  // side, which is what actually drives backpressure/completion.
  // (Cast to BufferSource: newer TS lib typings require an ArrayBuffer-
  // backed view specifically, while Uint8Array's type is generic over
  // ArrayBufferLike — the runtime value is always a plain ArrayBuffer here.)
  void writer.write(bytes as BufferSource);
  void writer.close();
  const buffer = await new Response(stream.readable).arrayBuffer();
  return new Uint8Array(buffer);
}

async function gzipDecompress(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new DecompressionStream('gzip');
  const writer = stream.writable.getWriter();
  // Swallow write/close rejections on corrupt input; the failure surfaces
  // through the readable side below, where the caller's try/catch sees it.
  writer.write(bytes as BufferSource).catch(() => {});
  writer.close().catch(() => {});
  const buffer = await new Response(stream.readable).arrayBuffer();
  return new Uint8Array(buffer);
}

export class ShareUrlTooLongError extends Error {}

// Ids are UI-only keys (see types.ts) and random UUIDs are incompressible,
// so they are stripped before encoding and minted fresh on decode. Numbers
// are rounded (1e-4 m / 1e-5 for quaternion components) since float32 noise
// like 1.2000000476837158 compresses badly. Together these shrink codes a lot.
const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;
function compactPieces(pieces: PlacedPiece[]): PlacedPiece[] {
  return pieces.map((p) => ({
    id: '',
    prefab: p.prefab,
    pos: { x: round(p.pos.x, 4), y: round(p.pos.y, 4), z: round(p.pos.z, 4) },
    rot: { x: round(p.rot.x, 5), y: round(p.rot.y, 5), z: round(p.rot.z, 5), w: round(p.rot.w, 5) },
  }));
}

// Encodes the scene into a URL-safe string with no length limit: a
// copy/paste "build code" that doesn't have to fit in an address bar.
// Reuses persistence.ts's serialize() for the JSON envelope.
export async function encodeSceneToCode(pieces: PlacedPiece[], groundLevel = 0): Promise<string> {
  const json = serialize(compactPieces(pieces), groundLevel);
  const jsonBytes = new TextEncoder().encode(json);

  let tag: string;
  let payloadBytes: Uint8Array;
  if (supportsCompressionStreams()) {
    tag = FORMAT_GZIP;
    payloadBytes = await gzipCompress(jsonBytes);
  } else {
    tag = FORMAT_RAW;
    payloadBytes = jsonBytes;
  }
  return tag + bytesToBase64Url(payloadBytes);
}

// Same encoding, but throws ShareUrlTooLongError past MAX_HASH_LENGTH —
// callers building a URL should catch it and fall back to the build code.
export async function encodeSceneToHash(pieces: PlacedPiece[], groundLevel = 0): Promise<string> {
  const encoded = await encodeSceneToCode(pieces, groundLevel);
  if (encoded.length > MAX_HASH_LENGTH) {
    throw new ShareUrlTooLongError(
      `This layout is too large to fit in a link (${encoded.length} characters, limit ${MAX_HASH_LENGTH}). Copy the build code instead.`
    );
  }
  return encoded;
}

// Accepts whatever a user pastes: a bare build code, a full share URL, or
// either with stray whitespace/line breaks. Returns the code to decode.
export function extractShareCode(input: string): string {
  const hashAt = input.lastIndexOf('#');
  const code = hashAt >= 0 ? input.slice(hashAt + 1) : input;
  return code.replace(/\s+/g, '');
}

// Decodes pasted text (see extractShareCode) into a scene; null if invalid.
export function decodeSceneFromInput(input: string): Promise<LoadedScene | null> {
  return decodeSceneFromHashFull(extractShareCode(input));
}

// Decodes a string previously produced by encodeSceneToHash back into
// PlacedPiece[]. Never throws — returns null on anything malformed,
// unsupported, or that fails to decompress/parse, matching
// persistence.ts's deserialize() convention so callers can uniformly fall
// back to a clean state.
export async function decodeSceneFromHash(hash: string): Promise<PlacedPiece[] | null> {
  return (await decodeSceneFromHashFull(hash))?.pieces ?? null;
}

// Like decodeSceneFromHash but also returns the ground level (0 if absent).
export async function decodeSceneFromHashFull(hash: string): Promise<LoadedScene | null> {
  if (typeof hash !== 'string' || hash.length < 1) return null;

  const tag = hash[0];
  const data = hash.slice(1);

  try {
    const payloadBytes = base64UrlToBytes(data);

    let jsonBytes: Uint8Array;
    if (tag === FORMAT_GZIP) {
      if (!supportsCompressionStreams()) return null;
      jsonBytes = await gzipDecompress(payloadBytes);
    } else if (tag === FORMAT_RAW) {
      jsonBytes = payloadBytes;
    } else {
      return null;
    }

    const json = new TextDecoder().decode(jsonBytes);
    const scene = deserializeScene(json);
    if (!scene) return null;
    const seen = new Set<string>();
    const pieces = scene.pieces.map((p) => {
      const id = p.id && !seen.has(p.id) ? p.id : crypto.randomUUID();
      seen.add(id);
      return { ...p, id };
    });
    return { ...scene, pieces };
  } catch {
    return null;
  }
}

// Builds the full shareable URL from a location-like object and an encoded
// scene. Uses origin + pathname only, so it works under a sub-path base
// (e.g. Vite's '/valheimdraft-webapp/') and drops any existing search/hash.
export function buildShareUrl(
  loc: { origin: string; pathname: string },
  encoded: string
): string {
  return `${loc.origin}${loc.pathname}#${encoded}`;
}

import { serialize, deserialize } from './persistence';
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
  void writer.write(bytes as BufferSource);
  void writer.close();
  const buffer = await new Response(stream.readable).arrayBuffer();
  return new Uint8Array(buffer);
}

export class ShareUrlTooLongError extends Error {}

// Encodes the scene into a compact, URL-safe string suitable for sticking
// after a '#' in the address bar. Reuses persistence.ts's serialize() for
// the actual JSON envelope so the two formats never drift apart.
//
// Throws ShareUrlTooLongError if the result would be unreasonably long —
// callers (the Share button) should catch this and show a message rather
// than handing back a giant, unusable link.
export async function encodeSceneToHash(pieces: PlacedPiece[]): Promise<string> {
  const json = serialize(pieces);
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

  const encoded = tag + bytesToBase64Url(payloadBytes);

  if (encoded.length > MAX_HASH_LENGTH) {
    throw new ShareUrlTooLongError(
      `This layout is too large to share as a link (${encoded.length} characters, limit ${MAX_HASH_LENGTH}). Try removing some pieces, or use Export instead.`
    );
  }

  return encoded;
}

// Decodes a string previously produced by encodeSceneToHash back into
// PlacedPiece[]. Never throws — returns null on anything malformed,
// unsupported, or that fails to decompress/parse, matching
// persistence.ts's deserialize() convention so callers can uniformly fall
// back to a clean state.
export async function decodeSceneFromHash(hash: string): Promise<PlacedPiece[] | null> {
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
    return deserialize(json);
  } catch {
    return null;
  }
}

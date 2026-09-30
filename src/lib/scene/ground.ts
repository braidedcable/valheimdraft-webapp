// Pure, THREE-free ground-level decisions shared by Viewport.svelte and
// ground.test.ts (same split as xray.ts).

/** World units the ground moves per +/- click. */
export const GROUND_STEP = 1;
/** Sanity bounds on the step count, so a bad stored value can't fling the plane away. */
export const MAX_GROUND_LEVEL = 100;

export const GROUND_OPACITY_ABOVE = 1;
/** Seen from below the ground is a see-through slab: visible, but doesn't hide the build. */
export const GROUND_OPACITY_BELOW = 0.25;

/** Coerces untrusted input (storage, share link, JSON) to a valid integer step count. */
export function sanitizeGroundLevel(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  const n = Math.round(value);
  return Math.max(-MAX_GROUND_LEVEL, Math.min(MAX_GROUND_LEVEL, n)) || 0;
}

export function groundLevelToY(level: number): number {
  return level * GROUND_STEP;
}

export function stepGroundLevel(level: number, delta: number): number {
  return sanitizeGroundLevel(level + delta);
}

export function isCameraBelowGround(cameraY: number, groundY: number): boolean {
  return cameraY < groundY;
}

export function groundOpacity(below: boolean): number {
  return below ? GROUND_OPACITY_BELOW : GROUND_OPACITY_ABOVE;
}

/**
 * Y for the ghost's origin given the surface point under the cursor.
 * Looking down (ray dirY <= 0) the piece's true bottom rests on the surface;
 * looking up at an underside (dirY > 0, e.g. from below the ground) its true
 * top hangs from the surface instead.
 * `boundsY` = piece height, `centerY` = its mesh center offset from origin.
 */
export function ghostRestY(surfaceY: number, rayDirY: number, boundsY: number, centerY: number): number {
  return rayDirY > 0 ? surfaceY - boundsY / 2 - centerY : surfaceY + boundsY / 2 - centerY;
}

/** Keep WASD panning horizontal; false when looking (nearly) straight up/down. */
export function canFlattenForward(dirX: number, dirZ: number): boolean {
  return dirX * dirX + dirZ * dirZ > 1e-6;
}

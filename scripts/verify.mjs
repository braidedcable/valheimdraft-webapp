// Boots the dev server, loads the app in headless Chromium, and fails on
// any console error or unhandled page exception. Screenshots to .verify/
// so a human (or the next agent) can eyeball the result without a browser.
//
// Also runs a "gallery" pass per catalog family group: seeds localStorage
// (persistence.ts's SceneEnvelopeV1 format) with every piece in that group
// laid out in a grid, reloads, and screenshots — this is how a catalog
// batch gets visually reviewed before shipping (see valheim-planner-plan.md,
// "Catalog expansion"), since this environment has no interactive browser.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Overridable so concurrent verify runs (e.g. parallel agents in separate
// worktrees) don't collide on the same dev-server port.
const PORT = Number(process.env.VERIFY_PORT) || 5183;
const OUT_DIR = fileURLToPath(new URL('../.verify/', import.meta.url));
const STORAGE_KEY = 'valheimdraft:scene:v1';
const MAX_GRID_SPACING = 2.5;
const TARGET_GRID_WIDTH = 16; // fits inside the fixed Iso camera's frustum

async function loadPieces() {
  const raw = await readFile(fileURLToPath(new URL('../src/data/pieces.json', import.meta.url)), 'utf8');
  return JSON.parse(raw).pieces;
}

function gridLayout(pieces) {
  const cols = Math.ceil(Math.sqrt(pieces.length));
  const spacing = Math.min(MAX_GRID_SPACING, TARGET_GRID_WIDTH / cols);
  const offset = ((cols - 1) * spacing) / 2; // center the grid on the origin
  return pieces.map((piece, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const y = piece.bounds.y / 2 - piece.center.y; // rest on the ground plane
    return {
      id: crypto.randomUUID(),
      prefab: piece.prefab,
      pos: { x: col * spacing - offset, y, z: row * spacing - offset },
      rot: { x: 0, y: 0, z: 0, w: 1 },
    };
  });
}

async function seedAndScreenshot(page, pieces, outFile) {
  const envelope = { version: 1, pieces: gridLayout(pieces) };
  await page.evaluate(
    ({ key, value }) => localStorage.setItem(key, value),
    { key: STORAGE_KEY, value: JSON.stringify(envelope) }
  );
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('h1');
  await page.click('button:has-text("Iso")');
  await page.waitForTimeout(200); // let OrbitControls settle
  await page.screenshot({ path: outFile });
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const server = await createServer({ server: { port: PORT, strictPort: true } });
  await server.listen();

  const errors = [];
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
    });
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));

    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
    await page.waitForSelector('h1');
    await page.screenshot({ path: `${OUT_DIR}app.png` });

    if (process.env.VERIFY_GALLERY) {
      const pieces = await loadPieces();
      const byFamily = new Map();
      for (const piece of pieces) {
        if (!byFamily.has(piece.family)) byFamily.set(piece.family, []);
        byFamily.get(piece.family).push(piece);
      }
      for (const [family, familyPieces] of byFamily) {
        await seedAndScreenshot(page, familyPieces, `${OUT_DIR}gallery-${family}.png`);
        console.log(`verify: gallery-${family}.png (${familyPieces.length} pieces)`);
      }
    }
  } finally {
    await browser.close();
    await server.close();
  }

  if (errors.length > 0) {
    console.error(`verify: ${errors.length} error(s) found:\n${errors.join('\n')}`);
    process.exit(1);
  }
  console.log(`verify: OK — screenshot at ${OUT_DIR}app.png`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

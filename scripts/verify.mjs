// Boots the dev server, loads the app in headless Chromium, and fails on
// any console error or unhandled page exception. Screenshots to .verify/
// so a human (or the next agent) can eyeball the result without a browser.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Overridable so concurrent verify runs (e.g. parallel agents in separate
// worktrees) don't collide on the same dev-server port.
const PORT = Number(process.env.VERIFY_PORT) || 5183;
const OUT_DIR = fileURLToPath(new URL('../.verify/', import.meta.url));

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const server = await createServer({ server: { port: PORT, strictPort: true } });
  await server.listen();

  const errors = [];
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
    });
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));

    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
    await page.waitForSelector('h1');
    await page.screenshot({ path: `${OUT_DIR}app.png` });
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

// Joins the raw extraction data (valheimdraft/pieces-dump.json,
// valheimdraft/shudnal.BuildPiecesCustomized/*.json, and the Hammer section
// of "Pieces and properties.md") into src/data/pieces.json, classifying
// every candidate piece via src/lib/catalog/derive.ts and writing a
// human-reviewable report (catalog-report.md / .json) alongside it.
//
// Run with: npm run catalog   (node scripts/build-catalog.ts — Node 24
// strips TS types natively, no build step needed).
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';
import { classify, boundsSanityCheck, type Verdict } from '../src/lib/catalog/derive.ts';
import { MATERIAL_FAMILY_COLORS } from '../src/lib/scene/materials.ts';
import type { CostItem, PieceData, PieceShape, ShapeParams, SnapPoint, Vec3 } from '../src/lib/catalog/types.ts';

const scriptDir = path.dirname(url.fileURLToPath(import.meta.url));
const webappRoot = path.resolve(scriptDir, '..');
const dataDir = process.env.VALHEIMDRAFT_DATA ?? path.resolve(webappRoot, '..', 'valheimdraft');

interface Overrides {
  maxBatch: number;
  familyOrder: string[];
  familyBatch: Record<string, number>;
  familyRules: { match: string; family: string }[];
  itemNames: Record<string, string>;
  exclude: Record<string, string>;
  labelOverrides: Record<string, string>;
  pieces: Record<
    string,
    {
      pinned?: boolean;
      shape?: PieceShape;
      family?: string;
      batch?: number;
      label?: string;
      boundsFrom?: 'snaps';
      bars?: 'grid' | 'vertical';
      leaves?: 1 | 2;
      bounds?: Vec3;
      center?: Vec3;
      note?: string;
      accept?: boolean;
      bypassFunctionalName?: boolean;
    }
  >;
}

const overrides: Overrides = JSON.parse(fs.readFileSync(path.join(scriptDir, 'catalog-overrides.json'), 'utf8'));

// Normally "shipped" means batch <= maxBatch, which is cumulative — batch 3
// includes batch 2's families too. That makes it impossible to validate one
// batch's fixes in isolation while another batch's are still in progress
// elsewhere (e.g. two agents working on batch 2 and batch 3 in parallel,
// each in their own worktree). CATALOG_FAMILIES overrides the filter to
// "family is in this set" instead, regardless of maxBatch — for local
// testing only; leave it unset for a real build.
const includeFamilies = process.env.CATALOG_FAMILIES?.split(',').map((f) => f.trim());
function isShipped(family: string, batch: number): boolean {
  return includeFamilies ? includeFamilies.includes(family) : batch <= overrides.maxBatch;
}

// --- load raw sources ---
interface DumpPiece {
  prefab: string;
  bounds: Vec3;
  center: Vec3;
  snapPoints: SnapPoint[];
}
const dump: DumpPiece[] = JSON.parse(fs.readFileSync(path.join(dataDir, 'pieces-dump.json'), 'utf8')).pieces;

interface BpcPiece {
  prefabName: string;
  category: number;
  materialType: number | null;
  station: string;
  resources: string[];
}
const bpcDir = path.join(dataDir, 'shudnal.BuildPiecesCustomized');
const bpcByPrefab = new Map<string, BpcPiece>();
for (const file of fs.readdirSync(bpcDir)) {
  if (!file.endsWith('.json')) continue;
  const parsed: BpcPiece = JSON.parse(fs.readFileSync(path.join(bpcDir, file), 'utf8'));
  bpcByPrefab.set(parsed.prefabName, parsed);
}

const mdPath = path.join(dataDir, 'shudnal.BuildPiecesCustomized', 'Pieces and properties.md');
const mdLines = fs.readFileSync(mdPath, 'utf8').split('\n');
const hammerStart = mdLines.findIndex((l) => l.trim() === '## Hammer - $item_hammer - Hammer');
if (hammerStart === -1) throw new Error('Could not find "## Hammer" section in Pieces and properties.md');
let hammerEnd = mdLines.findIndex((l, i) => i > hammerStart && l.startsWith('## '));
if (hammerEnd === -1) hammerEnd = mdLines.length;

const labelByPrefab = new Map<string, string>();
const menuIndexByPrefab = new Map<string, number>();
let menuIndex = 0;
for (const line of mdLines.slice(hammerStart, hammerEnd)) {
  const m = /^\*\s+(\S+)\s+-\s+\$\S+\s+-\s+(.+)$/.exec(line.trim());
  if (!m) continue;
  const [, prefab, name] = m;
  menuIndexByPrefab.set(prefab, menuIndex++);
  if (!name.startsWith('[')) labelByPrefab.set(prefab, name.trim());
}

// --- dedupe snap points (generator's own copy; snapping.ts keeps an
// independent runtime dedupe as a safety net — see plan) ---
const DEDUPE_EPSILON = 1e-5;
function snapPointsEqual(a: SnapPoint, b: SnapPoint): boolean {
  return (
    Math.abs(a.pos.x - b.pos.x) < DEDUPE_EPSILON &&
    Math.abs(a.pos.y - b.pos.y) < DEDUPE_EPSILON &&
    Math.abs(a.pos.z - b.pos.z) < DEDUPE_EPSILON &&
    Math.abs(a.rot.x - b.rot.x) < DEDUPE_EPSILON &&
    Math.abs(a.rot.y - b.rot.y) < DEDUPE_EPSILON &&
    Math.abs(a.rot.z - b.rot.z) < DEDUPE_EPSILON &&
    Math.abs(a.rot.w - b.rot.w) < DEDUPE_EPSILON
  );
}
function dedupeSnapPoints(points: SnapPoint[]): SnapPoint[] {
  const out: SnapPoint[] = [];
  for (const sp of points) if (!out.some((e) => snapPointsEqual(e, sp))) out.push(sp);
  return out;
}

function boxFromPoints(points: Vec3[]): { min: Vec3; max: Vec3; size: Vec3; center: Vec3 } {
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const p of points) {
    min.x = Math.min(min.x, p.x);
    min.y = Math.min(min.y, p.y);
    min.z = Math.min(min.z, p.z);
    max.x = Math.max(max.x, p.x);
    max.y = Math.max(max.y, p.y);
    max.z = Math.max(max.z, p.z);
  }
  return {
    min,
    max,
    size: { x: max.x - min.x, y: max.y - min.y, z: max.z - min.z },
    center: { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2, z: (min.z + max.z) / 2 },
  };
}

function familyFor(prefab: string): string {
  for (const rule of overrides.familyRules) {
    if (new RegExp(rule.match).test(prefab)) return rule.family;
  }
  return 'misc';
}

function parseResources(resources: string[]): CostItem[] {
  return resources.map((r) => {
    const [item, amount, recover] = r.split(':');
    return { item, amount: Number(amount), recover: recover === 'True' };
  });
}

interface ReportRow {
  prefab: string;
  label: string;
  family: string;
  batch: number;
  shape: PieceShape | null;
  verdict: Verdict;
  reason: string;
  snapCount: number;
  missingLabel: boolean;
}

const finalPieces: PieceData[] = [];
const report: ReportRow[] = [];

for (const dumpPiece of dump) {
  if (dumpPiece.snapPoints.length === 0) continue;
  const bpc = bpcByPrefab.get(dumpPiece.prefab);
  if (!bpc) continue; // not a player-buildable piece (no BuildPiecesCustomized entry)
  if (![0, 2, 3, 5].includes(bpc.category)) continue;

  const prefab = dumpPiece.prefab;
  const pieceOverride = overrides.pieces[prefab];

  if (overrides.exclude[prefab]) {
    report.push({
      prefab,
      label: labelByPrefab.get(prefab) ?? prefab,
      family: familyFor(prefab),
      batch: 0,
      shape: null,
      verdict: 'EXCLUDE',
      reason: overrides.exclude[prefab],
      snapCount: dumpPiece.snapPoints.length,
      missingLabel: false,
    });
    continue;
  }

  const snapPoints = dedupeSnapPoints(dumpPiece.snapPoints);

  let bounds = pieceOverride?.bounds ?? dumpPiece.bounds;
  let center = pieceOverride?.center ?? dumpPiece.center;
  if (pieceOverride?.boundsFrom === 'snaps') {
    const box = boxFromPoints(snapPoints.map((sp) => sp.pos));
    bounds = {
      x: box.size.x > 0.02 ? box.size.x : dumpPiece.bounds.x,
      y: box.size.y > 0.02 ? box.size.y : dumpPiece.bounds.y,
      z: box.size.z > 0.02 ? box.size.z : dumpPiece.bounds.z,
    };
    center = box.center;
  }

  const auto = classify(prefab, bounds, center, snapPoints, {
    bypassFunctionalName: pieceOverride?.bypassFunctionalName === true,
  });
  let verdict: Verdict = auto.verdict;
  let shape: PieceShape | null = auto.shape;
  let geom: ShapeParams | undefined = auto.geom;
  let reason = auto.reason;

  if (verdict === 'CLEAN') {
    const sanity = boundsSanityCheck(bounds, geom);
    if (sanity) {
      verdict = 'REVIEW';
      reason = sanity;
    }
  }

  if (pieceOverride?.pinned) {
    shape = pieceOverride.shape!;
    geom = undefined;
    verdict = 'CLEAN';
    reason = 'pinned (existing MVP piece, unchanged)';
  } else if (pieceOverride?.shape) {
    shape = pieceOverride.shape;
    geom =
      shape === 'lattice'
        ? { kind: 'lattice', bars: pieceOverride.bars ?? 'grid' }
        : shape === 'door'
          ? { kind: 'door', leaves: pieceOverride.leaves ?? 1 }
          : undefined;
    verdict = 'CLEAN';
    reason = pieceOverride.note ?? 'manual shape override';
  } else if (pieceOverride?.accept) {
    // classify()'s own shape/geom is kept as-is — only the verdict is
    // forced to CLEAN. For pieces where the auto-classified shape is
    // actually correct and only a heuristic sanity check (bounds vs.
    // snap-box mismatch, off-center pivot) false-positived on it.
    verdict = 'CLEAN';
    reason = pieceOverride.note ?? 'accepted despite heuristic flag';
  }

  const label = pieceOverride?.label ?? overrides.labelOverrides[prefab] ?? labelByPrefab.get(prefab);
  const missingLabel = !label;
  const finalLabel = label ?? prefab;

  const family = pieceOverride?.family ?? familyFor(prefab);
  const batch = pieceOverride?.batch ?? overrides.familyBatch[family] ?? 3;

  report.push({
    prefab,
    label: finalLabel,
    family,
    batch,
    shape,
    verdict,
    reason,
    snapCount: snapPoints.length,
    missingLabel,
  });

  if (isShipped(family, batch)) {
    if (verdict !== 'CLEAN' || !shape) {
      console.error(`FAIL: ${prefab} is in shipped batch ${batch} but verdict is ${verdict} (${reason})`);
      process.exitCode = 1;
      continue;
    }
    if (!(family in MATERIAL_FAMILY_COLORS)) {
      console.error(`FAIL: ${prefab} has family "${family}" with no color in materials.ts`);
      process.exitCode = 1;
      continue;
    }
    finalPieces.push({
      prefab,
      label: finalLabel,
      family,
      batch,
      menuIndex: menuIndexByPrefab.get(prefab) ?? 9999,
      shape,
      bounds,
      center,
      snapPoints,
      cost: parseResources(bpc.resources),
      ...(geom ? { geom } : {}),
    });
  }
}

if (process.exitCode === 1) {
  console.error('\nGenerator failed — see FAIL lines above. No files were written.');
  process.exit(1);
}

finalPieces.sort((a, b) => {
  const fa = overrides.familyOrder.indexOf(a.family);
  const fb = overrides.familyOrder.indexOf(b.family);
  return fa !== fb ? fa - fb : a.menuIndex - b.menuIndex;
});

fs.writeFileSync(path.join(webappRoot, 'src/data/pieces.json'), JSON.stringify({ pieces: finalPieces }));
fs.writeFileSync(path.join(webappRoot, 'src/data/item-names.json'), JSON.stringify(overrides.itemNames));

// --- report ---
function verdictOrder(v: Verdict): number {
  return ['NEEDS_NEW_SHAPE', 'SUSPICIOUS', 'REVIEW', 'CLEAN', 'EXCLUDE'].indexOf(v);
}

const batches = [...new Set(report.map((r) => r.batch))].sort((a, b) => a - b);
const lines: string[] = ['# Catalog report', ''];

const counts = new Map<string, number>();
for (const r of report) counts.set(`${r.batch}:${r.verdict}`, (counts.get(`${r.batch}:${r.verdict}`) ?? 0) + 1);
lines.push('## Summary', '', '| Batch | Verdict | Count |', '|---|---|---|');
for (const b of batches) {
  for (const v of ['CLEAN', 'NEEDS_NEW_SHAPE', 'SUSPICIOUS', 'REVIEW', 'EXCLUDE'] as Verdict[]) {
    const c = counts.get(`${b}:${v}`);
    if (c) lines.push(`| ${b} | ${v} | ${c} |`);
  }
}
lines.push('');

for (const b of batches) {
  lines.push(`## Batch ${b}${b <= overrides.maxBatch ? ' (shipped)' : ''}`, '');
  const rows = report
    .filter((r) => r.batch === b)
    .sort((a, b2) => verdictOrder(a.verdict) - verdictOrder(b2.verdict) || a.prefab.localeCompare(b2.prefab));
  lines.push('| Prefab | Label | Family | Shape | Verdict | Reason |', '|---|---|---|---|---|---|');
  for (const r of rows) {
    const label = r.missingLabel ? `${r.label} ⚠MISSING_LABEL` : r.label;
    lines.push(`| ${r.prefab} | ${label} | ${r.family} | ${r.shape ?? '—'} | ${r.verdict} | ${r.reason} |`);
  }
  lines.push('');
}

fs.writeFileSync(path.join(webappRoot, 'catalog-report.md'), lines.join('\n'));
fs.writeFileSync(path.join(webappRoot, 'catalog-report.json'), JSON.stringify(report, null, 2));

console.log(`Wrote src/data/pieces.json with ${finalPieces.length} pieces (batch <= ${overrides.maxBatch}).`);
console.log(`Wrote catalog-report.md / catalog-report.json with ${report.length} classified pieces across ${batches.length} batches.`);

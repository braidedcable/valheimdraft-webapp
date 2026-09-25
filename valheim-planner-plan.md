# Valheim Building Simulator — GitHub Pages Webapp

## Context

Build a browser-based interactive Valheim building simulator, hosted on GitHub Pages, where a user can place buildable pieces (walls, beams, roofs, floors, etc.) to design bases. This document started as **Phase 0** — an asset-availability investigation the user asked for up front — and has since grown to cover the full MVP build. **MVP is complete**, including vertical (Y-axis) placement/snapping added after an initial completion pass missed it — see "MVP status: COMPLETE (again)" below. Everything past that point is tracked in "Backlog" as deliberately deferred, low-priority work, not abandoned or forgotten.

## Project ground rules (committed)

- **Non-commercial forever.** No ads, no donation tiers, no paid features, no sponsorships tied to the tool. This is a firm project decision, not a phase-gated concern.
- **Attribution baked in.** Every source (wikis, mods, data dumps) is credited on a dedicated attribution page linked from the main UI, with license names and URLs. Attribution is a first-class UI element, not a footnote.
- **Unofficial fan project.** A prominent "Unofficial fan project. Not affiliated with or endorsed by Iron Gate Studio." disclaimer appears in the site header/footer and README.
- **No ripped Iron Gate assets in the repo.** Textures and 3D meshes from the game are never committed. Numerical piece data (dimensions, costs) is fine — numbers aren't copyrightable.

These commitments unlock the widest set of source licenses (including weirdgloop's CC BY-NC-SA) and keep takedown risk minimal.

---

## Phase 0 — Asset & data availability findings

**Bottom line: given the non-commercial + attributed ground rules above, this is legally hostable on GitHub Pages. Piece names, tokens, components, and material costs are all sourceable from existing tooling. Snap points and piece dimensions are NOT available anywhere as structured data and are the single make-or-break dependency for the project — see the go/no-go gate below.**

### Licensing landscape

| Source | License | Usable under our ground rules? |
|---|---|---|
| Fandom wiki (valheim.fandom.com) — text | CC BY-SA 3.0 | Yes, with attribution |
| Fandom wiki — images | Not auto-licensed; mostly Iron Gate screenshots claimed under fair use | Skip — legally shaky regardless |
| Weirdgloop wiki (valheim.weirdgloop.org) | CC BY-NC-SA 3.0 | Yes — non-commercial commitment satisfies the NC clause |
| Fextralife wiki | Custom / unclear | Skip |
| Iron Gate press kit | No explicit fan-content license | Do not redistribute ripped textures/models |

### Structured piece data — what exists

Programmatically obtainable:
- **Jötunn prefab list** — auto-generated per game version, gives every buildable piece's ID, token, English name, components. https://valheim-modding.github.io/Jotunn/data/prefabs/prefab-list.html
- **Jötunn material list** — companion table for materials. https://valheim-modding.github.io/Jotunn/data/prefabs/material-list.html
- **shudnal/BuildPiecesCustomized** — `bpcsaveall` console command dumps every piece config as JSON, including material costs. Best single source for a piece catalog.
- **ValheimJsonExporter** — reads Unity object data → JSON (items/recipes).
- **MoreVanillaBuildPrefabs** — source-code enumeration of buildable prefabs.

Not available as structured data anywhere:
- **Snap points and exact dimensions** live in Unity prefabs. **This is the critical dependency for the whole project** (see the "Snap-point / dimension extraction — go/no-go gate" section below). Numbers themselves aren't copyrightable, so a JSON of positions and bounds is fine to ship however it's produced; the question is only how to produce it reliably.

Wiki tables are prose-per-piece, not machine-friendly.

### Blueprint interop

**PlanBuild** (github.com/sirskunkalot/PlanBuild) is the canonical in-game planner mod and defines `.blueprint` / `.vbuild` formats. Both are plaintext, one piece per line, but **target `.blueprint`, not `.vbuild`** — corrected after reading PlanBuild's actual parser source, not just a summary:

- `.vbuild` line: `name rotX rotY rotZ rotW posX posY posZ [zdoData] [chance]` — rotation *before* position, no header, no metadata. It's the legacy BuildShare format; PlanBuild reads it only for backwards compatibility and **rewrites it to `.blueprint` on save** (`FileFormat.VBuild` branch in `Blueprint.ToFile` renames `.vbuild` → `.blueprint`). No current tool (PlanBuild, Expand World, ValheimBuildConverter) writes `.vbuild` — we would be the only `.vbuild` writer in the ecosystem.
- `.blueprint` line: `name;category;posX;posY;posZ;rotX;rotY;rotZ;rotW;additionalInfoJSON;scaleX;scaleY;scaleZ` (position before rotation, reversed vs. `.vbuild`), plus a `#Name`/`#Description`/`#Pieces` header block. Superset of `.vbuild`: adds category, per-piece scale, and `additionalInfo` (sign text, container/item-stand contents, ward state). This is what PlanBuild writes and what Valheimians.com's library is built on.
- **Position is relative to a per-blueprint origin** (the min corner across all placed pieces, or a designated center piece), not absolute world space — `Blueprint.Capture` subtracts this origin on save and re-adds it on placement. Emit min-corner-relative coordinates.
- **Handedness gotcha, unresolved — FLAGGED, not blocking, deferred until `.blueprint` export is actually picked up.** Unity/Valheim is left-handed, Three.js is right-handed. No axis flip exists anywhere in this codebase today (verified: nothing in `src/lib/scene/*` or `Viewport.svelte` negates an axis).

  **Best guess without testing (untested — replace with a real check before implementing, don't trust this):** likely *not* a clean pass-through, and rotations are the probable failure point, not positions.
  - **Positions**: raw Unity-native numbers, rendered directly in Three.js with no conversion. A bare (x, y, z) triple doesn't encode handedness by itself — translation/placement is the more likely part to transfer cleanly.
  - **Rotations**: this codebase quietly mixes two conventions. A snap point's *baseline* rotation comes straight from the Unity extractor (genuinely left-handed data). But every rotation the *user applies in the app* — the R key's 45° increments, and the snap-alignment logic — is computed with Three.js's own quaternion/Euler math, which is right-handed. These compose numerically without error, and look fine on screen because nothing has ever compared the result against the real game, but it's exactly the kind of mismatch that plausibly exports as rotations running the wrong direction (a piece turned "clockwise" in-app landing turned counterclockwise in PlanBuild).
  - Net guess: a naive raw export would likely produce a layout that's roughly right on the ground plan but with some pieces facing the wrong way — not garbage, but wrong enough to need a real fix. Confidence this needs *some* rotation conversion: moderate-to-high. Confidence in which exact conversion fixes it: low — don't guess that part, test it.

  **The cheap way to settle it, whenever this gets picked up:** round-trip a real `.blueprint` fixture (e.g. `TestBox_V2.blueprint` from github.com/AugusDogus/Buildheim) — import its known-good coordinates into this app's data model, render it, and see whether it looks right or mirrored/misrotated. Do this before writing an exporter, not after.
- Effort estimate: roughly a day, not near-free — the traps (origin subtraction, field order, invariant-culture number formatting, prefab name matching) all fail *silently* (loads fine, looks subtly wrong), not with an error.

Supporting `.blueprint` import/export gives instant interop with PlanBuild users and the Valheimians.com blueprint library. High-payoff feature, moderate (not low) effort once the handedness question is settled.

### Art strategy (resolved)

The visual goal is **rendered geometric shapes** sized from piece dimensions and shaded with flat per-material-family colors — no copyrighted Iron Gate art is needed or wanted.

Concretely:
- Each piece is drawn as procedurally generated geometry (box, wedge, slab, etc.) sized from its `pieces.json` entry. No sprite atlas, no per-piece hand art.
- **v1: flat colors only.** Surfaces are tinted by material family (wood / core-wood / stone / iron / thatch / etc.) so a wooden beam reads differently from a stone wall at a glance. Palette committed as part of the piece catalog.
- **Post-v1 (optional):** generic CC0/CC-BY tiling textures (wood grain, stone, thatch, dirt) can be applied per material family later. Good sources when we get there: **ambientCG** (CC0), **Poly Haven** (CC0), **Kenney.nl** (CC0), **OpenGameArt** (mixed CC0/CC-BY). Attribution added to the attribution page where required.
- No custom per-piece art, no ripped assets, no wiki screenshots, ever.

Consequence: the "no free icon pack exists" problem is a non-issue — we don't need icons at all. The piece palette can render tiny previews of the same procedural geometry, or use a text/labeled-box list.

### Existing planners

No polished web-based Valheim building planner appears to exist. This is a genuine gap in the fan-tool ecosystem, not a crowded space.

### Key source URLs (for follow-up during implementation)

- https://valheim.weirdgloop.org/w/Valheim_Wiki:Copyrights
- https://valheim.fandom.com/wiki/Valheim_Wiki:Copyrights
- https://valheim-modding.github.io/Jotunn/data/prefabs/prefab-list.html
- https://github.com/shudnal/BuildPiecesCustomized
- https://github.com/sirskunkalot/PlanBuild
- https://github.com/jessinthecloud/ValheimJsonExporter
- https://www.valheimians.com/builds/

---

---

## Pre-spike checklist (historical — gate passed, see result below)

Everything that must be in place before the go/no-go spike is a good use of time. Ordered so each item's failure is caught cheaply.

1. **Own Valheim.** Not free (~$20 on Steam). The plugin needs a live install to hook into.
2. **Modding stack on that install:**
   - BepInEx (Valheim's standard mod entrypoint).
   - Jötunn framework (JotunnDoc depends on it).
   - A **separate mod profile / save folder** — don't risk the main save while iterating.
3. **C# / .NET dev toolchain:**
   - .NET SDK + editor (Rider, VS, or `dotnet` CLI).
   - Reference assemblies from the local Valheim install (`assembly_valheim.dll` and friends) available to the build.
4. **JotunnDoc verified buildable locally, unchanged.** Clone https://github.com/Valheim-Modding/JotunnDoc, build against current Valheim + Jötunn versions, confirm it still produces its expected output files. Proves the toolchain end-to-end before writing any snap-point code — the worst failure mode is a weekend on plugin logic that turns out to be blocked by a bad reference-assembly setup.
5. **License audit on JotunnDoc + Jötunn.** Jötunn is MIT; confirm JotunnDoc's LICENSE is compatible with the derivative we'll produce.
6. **Ground-truth reference data.** Manually measure 2–3 pieces in-game using the known 2m grid (wood floor 2×2m, wood beam 2m, character ~1.85m). Provides truth data to validate the plugin's output against. Without it, you can't tell if the plugin is right.
7. **Output JSON schema sketched on paper.** Decide the shape (`{name, bounds:{x,y,z}, snapPoints:[{x,y,z,rot}]}`) before coding, so the webapp side later has a fixed contract.
8. **Extractor repo scaffolding.** Recommend a separate `valheim-piece-extractor` repo — C# / BepInEx doesn't mix cleanly with the TS webapp in one repo, and the extractor is reusable for other Valheim tools.

Explicitly **not** prerequisites for the spike (deferred until after the gate):
- Webapp framework choice, repo layout, MVP piece scope, structural integrity design, GitHub Pages deploy setup.

---

## Snap-point / dimension extraction — go/no-go gate

**This is the critical dependency. Without accurate snap points and piece dimensions, the project doesn't work — you can't simulate Valheim's grid-and-snap building with vague sizes. Sign-off on the rest of the plan is contingent on this spike succeeding.**

### Why it's hard

Snap points are child transforms on each `Piece` prefab in Unity. Dimensions live in mesh bounds or `BoxCollider` components on the same prefabs. Neither is exposed by the wikis or by any of the community JSON dumps I found (Jötunn prefab list, BuildPiecesCustomized, ValheimJsonExporter) — they cover names, tokens, components, and material costs, but not spatial data.

### Preferred approach — BepInEx runtime dump plugin

Write (or fork) a small BepInEx plugin that, at scene load:
1. Iterates every prefab in `ZNetScene.instance.m_prefabs`.
2. For each prefab with a `Piece` component, reads:
   - The piece's world-space `BoxCollider` or renderer bounds → dimensions.
   - Each child transform tagged as a snap point → local position + rotation.
3. Serializes the whole set to a JSON file next to the game executable.

Existing infrastructure to fork or model on: **JotunnDoc** (https://github.com/Valheim-Modding/JotunnDoc) already auto-generates the public prefab list on every game update via this exact mechanism — it just doesn't currently emit snap points. Extending it or writing a sibling plugin is a few hundred lines.

Legality: numeric spatial data is not copyrightable. Shipping the resulting JSON in the app repo is fine. The plugin itself never redistributes any Iron Gate art or code.

### Fallbacks (rank-ordered) if the preferred approach fails (historical — gate passed, see result below)

1. **AssetRipper / AssetStudio on a local install** — dump prefab YAML privately, extract numeric fields into JSON, commit. Legally fine (numbers only, no assets), operationally clunky, and breaks on every game update.
2. **Manual in-game measurement** — build one of each piece using the 2m grid and character height as reference, hand-encode. Feasible only for a wood-tier MVP subset (~15–20 pieces); weeks of tedium if extended to the full catalog.

### Gate criteria (historical — gate passed, see result below)

Before committing to Phase 1+, produce:
- A working plugin (or extracted YAML) that emits a machine-readable JSON with, for a representative sample of at least 10 pieces spanning wood/stone/iron families: piece name, bounding-box size, and the list of snap points as (local x, y, z, rotation).
- Spot-check three placements against the game: put two of the same piece in-game with their snap points connected, and verify our JSON's snap-point offsets match the observed positions.

If neither the preferred approach nor fallback 1 works, the project scope collapses to a **wood-tier-only manual MVP** or is abandoned. This is the single most important risk in the plan and must be de-risked before writing any webapp code.

### Gate result: PASSED

Built as `braidedcable/valheimdraft` (BepInEx plugin, MIT license). Both criteria met: 664 pieces dumped with valid bounds + snap points, sampled across wood/stone/iron (`wood_floor`, `wood_pole`, `wood_roof_icorner_67`, `iron_floor_2x2`, `flametal_gate`, `stone_floor_2x2`, `stone_wall_2x1`), and the corner-to-corner 2m snap spacing matches known game mechanics.

Findings that corrected the plan's assumptions, for whoever touches the extractor next:
- **Snap points are named `"$hud_snappoint_*"`**, not `"_snappoint*"` as Jötunn's piece-creation tutorial implied. The extractor matches `"snappoint"` case-insensitively to tolerate both.
- **Bounds can't come from `Collider.bounds`/`Renderer.bounds`** — these prefabs are read directly from `ZNetScene.m_prefabs` and never instantiated into a live scene, so the physics/render systems never compute them (comes back zero). Fixed by reading `MeshFilter.sharedMesh.bounds` (a static mesh-asset property) and combining through the transform hierarchy — both work regardless of active state.
- **Wear-state variants (`New`/`Worn`/`Broken`) are sibling subtrees, each with their own mesh.** Combining all of them badly skews bounds (one piece came back 2.3m "tall" for a floor tile). `GameObject.activeInHierarchy` doesn't distinguish them either, since `WearNTear.Awake()` — which normally flips the correct variant active — never runs on an uninstantiated prefab. Fixed by targeting the literal child named `"New"` and falling back to the whole prefab for pieces without wear-state grouping.
- Output written to `Documents/ValheimDraft/pieces-dump.json`, not under the game's install path — Valheim's exe is 32-bit, and unelevated writes under `Program Files (x86)` get silently redirected by Windows file virtualization.
- Extraction is triggered by polling `ZNetScene.instance` in `Update()`, not a Jötunn event — `PrefabManager.OnVanillaPrefabsAvailable` didn't fire reliably at a point where `ZNetScene` existed.

---

## Rendering (resolved): full 3D via Three.js

- Valheim building is inherently 3D — diagonal beams, angled roof pieces (26° / 45°), and vertical support chains flatten poorly in 2D or isometric.
- Structural integrity, if ever added, is a 3D problem; building it on a 2D renderer would force a rewrite.
- `.vbuild` piece entries are already x/y/z + rotation, so 3D interop is native.
- Real cost is placement UX (raycasting, ghost preview, snap highlighting, camera orbit), not rendering throughput.
- **De-risk built in:** ship free-orbit plus a small set of locked camera presets (top-down, front, iso-45°) so users have a simpler nav mode when free orbit is overkill.

## Resolved decisions

1. **Repo layout**: new dedicated repo — `braidedcable/valheimdraft-webapp` (separate from the `valheimdraft` extractor repo; both cloned into this devcontainer).
2. **Framework preference**: Svelte + Vite. Compiles away at build time, minimal runtime, gives reactive state for the palette/cost-tally/undo bookkeeping without hand-rolled DOM diffing, and avoids the extra integration layer (react-three-fiber) React would need for Three.js.
3. **MVP piece scope**: wood-tier subset first (~15-20 pieces: floor, wall, roof, pole, stairs, door). Materials mostly reskin the same shapes (box/wedge/cylinder) with flat color, so once shape generators exist for wood tier, adding other materials is mostly more `pieces.json` entries, not a rewrite.
4. **Structural integrity**: deferred past MVP, consistent with wood-tier-first — ship pure placement (place/rotate/remove, no stability simulation) before adding real support-propagation logic.
5. **`.blueprint` import/export** (retargeted from `.vbuild` — see "Blueprint interop" above for why): ~~export ships in MVP~~ **revised — moved to backlog, out of MVP scope.** This decision was written before the actual research (rotation-handedness question, real per-day effort estimate, "we'd be the only `.vbuild` writer in the ecosystem") existed; once that was known, it stopped being the "near-free" MVP add-on it was scoped as. Deprioritized by explicit user decision — see the "Backlog" section below.

---

## Structural integrity — design (not yet implemented)

Backlog item 2 ("never scoped past 'someday'; no design work started") gets
its actual design here, prompted by the user asking to plan it and then to
cross-reference the wiki before finalizing. **Design only — no code written
yet.** Sequencing and open questions below are what gates starting
implementation.

### Grounded mechanics (cross-referenced against the wiki, not guessed)

Fandom's `Building_stability` page returned HTTP 402 when fetched and
couldn't be checked. `valheim.weirdgloop.org/wiki/Building_stability` —
already on this doc's approved-source list (CC BY-NC-SA 3.0, satisfied by
the non-commercial ground rule) — worked, and states up front that it's
sourced from **decompiled `WearNTear.GetMaterialProperties`/
`WearNTear.UpdateSupport`** — the actual algorithm, not player folklore or a
secondary guide's paraphrase. (Two secondary guides — game8.co, a
`valheimhub.wiki` deep-dive — were also checked; neither added verifiable
numeric detail beyond confirming the general shape of the system, and
`valheimhub.wiki` explicitly says it doesn't cover the numeric thresholds.)

| Material | MaxSupport | MinSupport | VerticalLoss | HorizontalLoss |
|---|---|---|---|---|
| Wood | 100 | 10 | 0.125 | 0.2 |
| Hardwood (core wood) | 140 | 10 | 0.1 | 0.167 |
| Stone | 1000 | 100 | 0.125 | 1.0 |
| Iron | 1500 | 20 | 0.077 | 0.077 |
| Marble | 1500 | 100 | 0.125 | 0.5 |
| Ashstone | 2000 | 100 | 0.1 | 0.333 |

- **Ground contact**: a piece touching ground/terrain gets support set to
  its own material's `MaxSupport`.
- **Single-parent propagation**:
  `distance = √[(h1/2+h2/2)² + (w1/2+w2/2)²] + 0.1` (a 0.1m fudge factor),
  then `support = parent_support × (1 − AngledLoss × distance)`, where
  `AngledLoss` interpolates between `VerticalLoss` and `HorizontalLoss`
  based on the connection's angle from vertical.
- **Multi-parent**: when two parents are ≥100° apart from each other and
  both sit ≥0.05m below the piece, their contributions average together
  using only `VerticalLoss` ("mutual support").
- **Tick timing**: recalculated every 0.5s, ≤50 components per tick, so a
  large structure's support propagates gradually in the live game — not
  relevant to a static planner that only needs a converged end-state.
- **Collapse**: a piece "breaks" at or below its material's `MinSupport`.
  No source found describing the exact mechanism (instant destruction vs.
  continuous damage) — see open questions below.

**A non-obvious point this table makes precise, worth designing test cases
around rather than taking on faith:** stone's `HorizontalLoss` (1.0) is
*5× worse* per meter than wood's (0.2) — stone isn't "structurally stronger
per meter of span," it just starts 10× higher (`MaxSupport` 1000 vs. 100),
which nets out ahead for ordinary building spans. This also explains the
secondary-guide folklore that stone gives no extra *height* over wood
(`VerticalLoss` is nearly identical: 0.125 vs. 0.125) — height comes from
hardwood/iron's better `VerticalLoss`, not from stone.

### Genuine gaps — not filled by any source checked, flagged rather than guessed

- **Color-threshold breakpoints** (blue/green/yellow/orange/red on the
  in-game hammer-hover display). No numeric source found anywhere.
- **Cross-material clamping.** Does a piece's incoming support clamp to its
  *own* material's `MaxSupport`? This is what would explain the observed
  in-game behavior (from a secondary guide, not the primary source above)
  that a wood piece touching a stone piece "acts as if placed on the
  ground" — stone's support value is so far above wood's `MaxSupport` that,
  if uncapped, the formula would let stone hand wood an impossibly high
  number. A clamp is the natural fix but isn't stated by any source found.
- **Whose loss coefficients apply at a material boundary** — the wiki
  formula doesn't specify whether `AngledLoss` uses the *receiving* piece's
  material or the *parent's*, when they differ.
- **`Ancient`/`Ice`/`Timberwood`** exist in this catalog's already-dumped
  `materialType` enum (`Pieces and properties.md`) but have no entry in
  weirdgloop's table.
- **Exact semantics of `noSupportWear`** (already dumped per-piece, e.g.
  `wood_wall_quarter.json` has `"noSupportWear": true`). Working assumption
  — a piece with this flag doesn't itself get flagged/break from
  insufficient support (plausible for attached furniture/decoration) but
  still transmits support onward normally — needs confirmation, not yet
  verified against source.

### Resolving the gaps the same way this project already resolved snap points

Phase 0's own finding was "wikis are prose-per-piece, not machine-friendly"
— snap points and dimensions turned out to need a real runtime extractor,
not wiki scraping, and `valheimdraft` (the BepInEx plugin) was built for
exactly that. The same lesson applies here: the cleanest fix for every gap
above is extending that same plugin to reflect `WearNTear`'s static
material-properties table (and, if a per-instance override exists, verify
that too) directly off a live game install — resolves the missing
materials, the clamp question, and the cross-material-loss question all at
once, from ground truth rather than another secondary source. This is a
**Track A** item (needs Jared's Windows machine), the same bucket as the
original snap-point extractor and the `bpcsaveall` automation.

### How this maps onto the existing codebase

Checked end to end before designing the above, not assumed:

- `valheimdraft/shudnal.BuildPiecesCustomized/*.json` already dumps
  `materialType`, `supports` (bool), `health`, `noSupportWear`,
  `noRoofWear` per piece — but `scripts/build-catalog.ts` currently drops
  all of it, keeping only `cost`. `PieceData`/`pieces.json` has zero
  material/support fields today.
- The `MaxSupport`/`MinSupport`/loss-coefficient table is **not per-piece**
  — it's a static table keyed by `materialType`, so it belongs in a new
  webapp constants module, not in `pieces.json`.
- No adjacency graph exists between placed pieces today — `PlacedPiece` is
  just `{id, prefab, pos, rot}`. The real game finds neighbors via a
  physics overlap check (colliders within reach), which this project has no
  equivalent of. The closest existing substitute is the
  snap-point-coincidence data `worldSnapPoints()`/`snapPosition()`
  (`snapping.ts`) already compute during placement — two placed pieces
  would be considered "connected" for support purposes when they share a
  (near-)coincident snap point. **This is a real, flagged simplification**,
  not the literal game algorithm: it will miss any support relationship
  that exists in-game via raw proximity without a snapped connection, and
  needs to be stated as such wherever it ships, not silently treated as
  exact.
- `App.svelte`'s `$derived.by` pattern (already used by `CostTally`, a
  pure function of `placedPieces`) is the right shape for a support-map
  recompute — no new reactive architecture needed.
- `Viewport.svelte` already has a per-piece material-tint override path
  (used today for the selection-highlight red tint), reusable for stability
  coloring instead of building a new render path.

### Proposed phases (not started)

1. **Track A**: extend `valheimdraft`'s dumper to reflect
   `WearNTear`'s material-properties table live, resolving the gaps above
   from ground truth. Blocks nothing else from starting, but the constants
   used in phase 3 stay explicitly "wiki-sourced, pending verification"
   until this lands.
2. Carry `materialType`, `structural` (rename of the dumped `supports`
   bool — avoids colliding with "support" as a noun elsewhere in this
   design), and `noSupportWear` through `build-catalog.ts` into
   `PieceData`. `health`/`noRoofWear` explicitly **not** carried through —
   separate wear axis (rain/monster decay), out of scope for structural
   support.
3. New `src/lib/structural/` module: the material-properties table (cited
   to weirdgloop above, flagged pending phase-1 verification) plus a pure
   `computeSupport(placedPieces, pieces) → Map<id, {support, broken}>`,
   built on snap-coincidence adjacency + ground-contact detection (a
   piece's lowest bound point ≈ y=0), solved by bounded iterative
   relaxation — handles the mutual-support case's circularity without
   needing the real game's 0.5s/50-per-tick gradual propagation, which
   only matters for a live, ticking world, not a static planner computing
   one converged result.
4. **Tests first**, `snapping.test.ts`-style (`support.test.ts`): a ground
   piece reads its material's `MaxSupport`; a wood pole stack degrades
   toward `MinSupport` with height; a wood piece touching stone behaves as
   a foundation (per the clamping question above — this test is also how
   that question gets pinned down empirically rather than guessed); a
   mutual-support case with two ≥100°-apart parents below the piece.
5. Viewport visualization: a toolbar-toggled "stability view" recoloring
   placed pieces by support ratio, reusing the existing tint-override path.
   Color bands are cosmetic-only given no threshold source exists — ship
   with an explicit, adjustable approximation, not a claimed game-accurate
   mapping.

### Scope line (stated up front, not discovered mid-implementation)

A static readout of the *current* layout's stability — warns what would
collapse given real game formulas — and never animates, damages, or
deletes a piece. Consistent with this being a planning tool, not a physics
simulation. Real-time decay ticks, monster/weapon damage, and roof/rain
wear are explicitly out of scope.

---

## MVP status: COMPLETE (again)

Was declared complete, reopened to add vertical placement/snapping as a
required item, now done, merged, and verified:

**6. Vertical (Y-axis) placement and snapping — done.** Every piece
placement was locked to the ground plane; there was no way to build a
second story, stack poles, or place a wall on top of another wall.
Root cause (confirmed by reading the code and the data, not guessed): the
ghost's tentative position always came from a raycast against the flat
ground mesh only, with Y hardcoded to rest at ground level regardless of
where the cursor pointed. `snapPosition()`'s 3D snap search and the piece
data's own top/bottom snap points (e.g. `wood_pole` at y=±0.5) were already
correct and complete — the ghost just never got close enough to a stacked
snap point to trigger it.

**The fix** (`src/lib/Viewport.svelte` only, `snapping.ts`/`pieces.json`
untouched, as scoped): the ghost-positioning raycast now hits the ground
*and* already-placed pieces together (`raycastGroundAndPlaced()`, sorted by
distance so the nearest surface wins), and the tentative Y comes from
whatever surface was actually hit instead of always assuming 0. For a
ground hit this is numerically identical to the old formula (no
regression); for a piece-surface hit it lands within the existing
snap-search radius and locks onto the real pair. `raycastPlaced()` (used
for hover/delete/pickup) was left untouched.

**Verified two ways, not just visually:**
- Numerically, via the app's own Export JSON (exact `pos.y` values, not a
  screenshot guess): stacking two `Wood Pole (1m)` pieces produced a
  vertical delta of exactly `1.0` with zero horizontal drift; a third pole
  stacked via the pick-up-and-move path (not just fresh placement) landed
  another exact `1.0` on top of that. Horizontal ground-level snapping
  (two `Wood Floor` tiles) was unchanged — same Y, same 2.0-unit offset as
  before.
- Adversarially, by placing a piece on open ground *near* (not on top of)
  an unrelated tall piece, confirming it still rests at the normal
  ground-level height with no spurious upward snap — the fix doesn't make
  nearby tall pieces "magnetic."

Everything else from the original MVP scope remains done, deployed, and
verified:

- Place, snap, rotate, relocate, delete all 18 wood-tier pieces (decision 3), now including vertical stacking.
- Materials cost tally.
- Persistence: `localStorage` autosave, JSON export/import, shareable URL links.
- Full undo/redo.
- Attribution page + disclaimer, GitHub Pages deploy pipeline with CI typecheck.
- Structural integrity was never in MVP scope (decision 4) — no gap there.

### Scalability discussion: is the snap-scoring code becoming a piece-specific mess?

Raised directly by the user after three back-to-back snap-scoring fixes in
one day (top/bottom stacking → flush-vs-staggered → far-end reach →
degenerate-overlap exclusion). Worth recording the answer, not just the
reassurance:

**The algorithm itself is not piece-specific.** `snapPositionAlongRay()` and
`snapPosition()` contain zero branches on prefab name or piece category —
every operation works generically on `piece.snapPoints` (a plain array of
local offsets) and `piece.center`, using only vector/ray math. It would
behave identically for a piece with 2 snap points or 20. Runtime cost
scales with placed pieces in a scene, not catalog size — cataloging 600
more piece types doesn't add code paths or slow this loop down.

**What actually grew is the disambiguation heuristic, empirically, one
ambiguity class at a time** — top/bottom, flush/stagger, near/far-end,
same-side-overlap. Each is a genuine, general category (not a per-piece
rule) discovered by testing against only two real geometries (a
symmetric 4-corner wall, a 2-point pole). That's a real, narrower version
of the scaling concern: pieces with different snap-point geometry
(angled roofs, stairs — anything that doesn't look like "two ends of a
line" or "top and bottom of a stack") could plausibly expose a
disambiguation case not yet covered, since the space of tested inputs is
still small relative to the eventual catalog.

**The mitigation, not just a promise:** the standing regression suite
(`src/lib/scene/snapping.test.ts`, `npm run test`) that came out of this
same conversation. It turns "wait for the next user report to reveal the
next ambiguity class" into "run every known case in under a second
whenever `snapping.ts` changes." The discipline going forward: any future
piece tier with meaningfully different snap-point geometry gets tested
against this suite (and extended with new cases as needed) before being
called done, rather than shipping and waiting to hear about the gap.

One narrower, honestly-flagged residual risk: `SNAP_RADIUS`,
`RAY_SNAP_REACH`, and the near-vertical/overlap-exclusion thresholds are
fixed absolute world-space numbers, calibrated against roughly-2m-scale
wood-tier pieces. A future tier with wildly different scale (tiny
decorative items, oversized stone structures) might need these
recalibrated — a tuning pass, not a redesign, when that tier arrives.

See "Backlog" below for what's separately deferred (not part of MVP) and why.

## Backlog (post-MVP, low priority — revisit later, not now)

1. **`.blueprint` export/import** — moved out of MVP scope (decision 5). Real effort (~a day, not near-free) with one open technical question: whether exported rotations need a Unity-left-handed ↔ Three.js-right-handed conversion. Full writeup, including a best-guess-without-testing reasoning chain (positions probably fine, rotations probably need conversion — moderate-to-high confidence something's needed, low confidence on the exact fix), is in "Blueprint interop" above. **Before implementing:** round-trip a real `.blueprint` fixture (e.g. `TestBox_V2.blueprint` from github.com/AugusDogus/Buildheim) through this app's data model and check whether it renders right-side-up or mirrored/misrotated — don't guess the conversion, test it. Import is a further step past export — needs prefab-name mapping and more error handling.
2. **Structural integrity simulation** (Valheim's beam-support rules) — design done, see "Structural integrity — design (not yet implemented)" above (wiki-sourced material constants, phased plan, open questions flagged); implementation not started. Phase 1 (verifying the material-properties table against a live game install) is a Track A item.
3. **CC0 tiling textures** in place of flat material colors — purely cosmetic, optional, no urgency. Candidate sources already identified if picked up: ambientCG, Poly Haven, Kenney.nl, OpenGameArt (see "Art strategy" above).
4. **Mesh instancing** — only matters if framerate becomes a real problem at higher piece counts; not needed at current wood-tier scale.
5. **Known minor gap, not urgent:** Toolbar's Undo/Redo *buttons* (as opposed to the Ctrl+Z/Ctrl+Shift+Z keyboard shortcuts) don't cancel an in-progress piece move first. Confirmed low-severity by direct testing — no crash, no data corruption, recoverable via the existing right-click-cancel. See the undo/redo entry under Track B below for full detail.
6. **Track A item 5 — `bpcsaveall` automation, needs in-game verification.** Code is written but only checked by review, not run in-game. Low priority since current cost data already in hand covers what's needed; only matters if the piece catalog grows and needs a refreshed cost dump.
7. **Track A item 4 — `.blueprint` round-trip test** (export from the app, import into PlanBuild in-game, confirm the layout matches). Blocked on item 1 above existing first.

### Untriaged: feature & look-and-feel ideas (2026-09-25, post-catalog-expansion)

Raised in conversation after all three catalog batches shipped (204 pieces).
None of these have design work, effort estimates, or priority yet — listed
here so they aren't lost, to be triaged (and merged into the numbered list
above, or dropped) when picked up.

**Also worth checking now that the catalog spans a much wider size/shape
range than when these were last tuned:**
- The "Roof Cross" shape (`cross`, an X-truss) was a generator guess never
  verified against a real in-game screenshot — could be a bowtie instead.
- `SNAP_RADIUS`/`RAY_SNAP_REACH` (`snapping.ts`) were tuned against ~2m
  wood-tier pieces; the catalog now spans tiny iron cage pieces to 6m+
  drawbridges and hasn't been re-tested at either extreme.

**Features:**
- Duplicate/clone a placed piece (right-click or a shortcut), instead of
  re-selecting from the palette every time.
- Multi-select (box-select) + group move/rotate/delete.
- Mirror/symmetry mode — build one half, auto-mirror across an axis.
- Named save slots — currently one autosave slot; support multiple local
  saved layouts.
- Cost tally grouped by crafting station (workbench/forge/stonecutter/
  blackforge/etc.), not just a flat material list.
- Snap-point visualization — show small markers at a piece's connection
  points while placing/hovering, so snapping behavior is visible.

**Look and feel:**
- Ground grid overlay (aligned to the 1m/2m building grid) — the flat green
  plane currently gives no depth/scale reference.
- Piece preview thumbnails in the palette (204 pieces across 14 groups is a
  lot to scan as text-only rows).
- Soft/contact shadows under placed pieces — the scene currently reads as
  slightly "floating."
- Selection highlight as an outline/glow instead of the current flat red
  tint, which fights with a piece's own material color.
- Sky/backdrop instead of the flat dark background.
- Smooth camera transitions between the Iso/Top/Front presets instead of an
  instant cut.

---

## Work tracks

Two tracks, because one of them needs Jared's Windows gaming PC and the
other needs this devcontainer. Track A sits in a queue for the next time
Jared's at that machine; Track B proceeds regardless. Within Track B nothing
is truly parallel — it's a solo project — so the grouping below is "what's
unblocked right now," not a dependency graph to work simultaneously.

**Status:** MVP complete, including vertical placement/snapping — see
"MVP status: COMPLETE (again)" near the top of this doc for the technical
detail, and "Backlog" for what's separately deferred and why. A
headless-browser verification harness (`npm run verify`, Playwright +
Chromium) now exists so UI changes can be checked in this devcontainer
without deploying first — CI also runs `npm run check` now, not just
`build`.

**Correction (subagent-driven session, materials-tally + dedupe batch):**
`.vbuild` was the wrong export target — see "Blueprint interop" and
"Resolved decisions" above for the full correction. Short version: no
current tool writes `.vbuild` anymore, PlanBuild upgrades it to
`.blueprint` on save, and `.blueprint` is a superset (name/category/scale/
signs/chest contents) that the ecosystem actually reads and writes today.
Target `.blueprint` when that work starts (tracked in "Backlog").

### Track A — needs Jared's Windows machine

1. ~~Copy `Documents\ValheimDraft\pieces-dump.json` into this devcontainer~~
   **Done** — committed to the `valheimdraft` repo.
2. ~~Run `bpcsaveall`~~ **Done** — output committed under
   `valheimdraft/shudnal.BuildPiecesCustomized/` as one JSON file per piece,
   filename keyed by prefab name (e.g. `wood_floor.json`), which lines up
   directly with the dump's `prefab` field — no name-mapping needed for the
   Phase-B merge. 422 of 429 files match a dump prefab; coverage for the
   wood tier specifically is complete (every `wood_*` building piece has a
   cost file).
3. ~~Re-run the extractor~~ **Done** — `center` is now emitted and verified
   against `wood_floor` (near-zero, as expected for a symmetric piece), and
   the snap-point local-to-root composition fix is in. See "Known extractor
   gaps" below for what's now resolved vs. still open.
4. **`.vbuild` round-trip test** — export from the app, import into
   PlanBuild in-game, verify the layout matches. Not until export exists in
   Track B.
5. **Automate `bpcsaveall` + colocate its output** — code written, **not
   yet verified in-game** (next gaming-PC trip: pull, rebuild, redeploy,
   load a world, check `Documents/ValheimDraft/shudnal.BuildPiecesCustomized/`
   populates and the log shows a `copied N bpcsaveall files` line):
   - `bpcsaveall` is a standard `Terminal.ConsoleCommand` (from
     `shudnal.BuildPiecesCustomized`, confirmed via its source). ValheimDraft
     can trigger it itself with `Terminal.instance.TryRunCommand("bpcsaveall")`
     once the console exists — same kind of readiness check `Update()`
     already does for `ZNetScene.instance`. Soft dependency: check the mod's
     plugin GUID (`shudnal.BuildPiecesCustomized`) is loaded first so this is
     a no-op (not an error) when it isn't installed.
   - BuildPiecesCustomized's output directory is **hardcoded, not
     configurable** — always `Paths.ConfigPath/shudnal.BuildPiecesCustomized/`
     (confirmed from source). True colocation (BPC writing directly into
     ValheimDraft's folder) isn't possible; the practical equivalent is
     ValheimDraft copying those JSON files into its own
     `Documents/ValheimDraft/` output right after triggering the save.
   - Net effect: one trip to the gaming PC (load a world) produces both
     outputs together, in one place, with no manual console typing.

### Track B — devcontainer, proceeds regardless of Track A

**Done:**
- ~~Vite + Svelte scaffold~~ Vite + Svelte + TS, GH Pages `base` path set
  (`/valheimdraft-webapp/`), demo boilerplate stripped.
- ~~GitHub Actions workflow~~ `.github/workflows/deploy.yml`, builds and
  deploys via the modern Actions-based Pages flow (`upload-pages-artifact` +
  `deploy-pages`). Pages source is set to GitHub Actions (done manually —
  couldn't set via API, same token permission limit as repo creation).
  **Live and deploying successfully on every push**:
  https://braidedcable.github.io/valheimdraft-webapp/
- ~~Attribution page + disclaimer~~ Toggled from the header; credits
  BuildPiecesCustomized (Unlicense), Jötunn (MIT), and the weirdgloop wiki
  (CC BY-NC-SA 3.0) — licenses checked from source, not assumed. Disclaimer
  in header and footer.
- ~~Pin the MVP wood-tier prefab list~~ 18 pieces (floor ×2, wall ×3, pole
  ×2, beam, door, stair, roof ×4, gate, fence, window, stepladder) — all
  verified present in both `pieces-dump.json` and the cost data before
  picking them.
- ~~Hand-author shape/material-family mapping~~ Done as part of building
  `pieces.json` (below) rather than as a separate artifact. Turned out to
  need eight shapes, not the three originally guessed — see "Shape mapping
  is an ongoing task, not a one-time list" below for why.
- ~~Stub `pieces.json`~~ **Skipped the stub** — Track A already had real
  data in hand (bounds/center/snap points from `pieces-dump.json`, costs
  from `bpcsaveall`), so `src/data/pieces.json` was built from real data
  directly. Also dedupes the confirmed exact-duplicate-snap-point gap at
  load time (`ashwood_stair`-style duplicates), per the "known extractor
  gaps" note that this belongs in the webapp loader.
- ~~Scene-state shape~~ Formalized as `PlacedPiece` in `src/lib/types.ts`:
  `{id, prefab, pos:{x,y,z}, rot:{x,y,z,w}}` — `id` is a UI-only
  `crypto.randomUUID()` key, not part of the exportable shape. Already
  JSON-clean; persistence/export work builds directly on it, no further
  formalization needed.

**Shape geometry** (`src/lib/scene/geometry.ts`) — procedural geometry sized
from each piece's real bounds, flat material-family colors. Final set, all
confirmed correct by eye against the deployed site (this environment has no
browser, so every one of these was verified on the live GitHub Pages deploy,
not locally): `box` (most pieces), `cylinder` (poles — a round pole as a box
would look wrong), `wedge` (thin sloped panel — roofs; first attempt was a
solid triangular-prism ramp, visibly wrong, a "thick block" not a surface),
`stairs` (zigzag riser/tread profile — visibly stepped in-game, not a flat
ramp like roofs), `ladder` (two rails + evenly spaced rungs, an open frame),
`fence` (two rails + vertical slats, a picket silhouette — an earlier
horizontal-crossbar attempt, also tried on `wood_gate` first, read as a
bookshelf, not a fence), `hip`/`valley` (roof corners — two thin triangles
sharing a diagonal fold, peak/valley corner grounded in each piece's real
snap-point data after a first guess picked the wrong diagonal). `wood_gate`
itself ended up plain `box` — its bounds turned out to represent only a
hinge post, not a full gate leaf, and no shape primitive fixes wrong bounds
(see lesson 2 below).

### Shape mapping is an ongoing task, not a one-time list

Three lessons from getting the 18 MVP pieces right, all apply well beyond
this batch — worth remembering whenever the catalog grows past wood tier:

1. **Any "functional" piece (not a plain structural wall/floor/roof) likely
   needs its own shape**, not just a box, to read as distinct from
   structural pieces at a glance — doors, gates, fences, ladders, stairs,
   windows, and probably more as the catalog grows. This isn't a fixed list
   that gets written once; it's per-piece visual judgment, most practically
   done by looking at the deployed result the way this MVP batch was
   checked, not guessed up front.
2. **Some pieces' extracted bounds may only cover a structural sub-part of
   a compound/animated object, not the full visual piece** — confirmed for
   `wood_gate`: its bounds (`{x:0.3, y:3, z:0.5}`) look like a single hinge
   post, not a full gate leaf, unlike `wood_door`'s properly proportioned
   `{x:2, y:2.02, z:0.5}`. No shape primitive fixes a wrong bounding box —
   giving a bad box a fancy frame just produces a *differently* wrong
   shape (confirmed: looked "like a narrow bookshelf"). The honest fix is
   rendering what the data actually represents (here, a plain box/beam),
   not dressing it up. Compound/animated pieces (anything hinged, or with
   moving parts) are the ones to watch for this; if it recurs often once
   the catalog grows, worth revisiting the extractor's bounds capture for
   those specifically rather than working around it per-piece in the
   webapp.
3. **When a shape's exact topology matters (which corner is high, which
   edge connects to what), ground it in the piece's own real snap-point
   data, not a guessed general convention.** `wood_roof_ocorner`/`icorner`
   needed a folded hip/valley shape (confirmed by eye — corner roof pieces
   are visibly folded in-game, not a flat panel like the plain roof piece),
   built as two thin triangles sharing a diagonal fold. First attempt
   guessed which diagonal corner was the peak from general hip-roof
   convention — wrong diagonal, and the piece read as "scooted inward"
   relative to adjacent straight panels. Checking the piece's actual
   snap-point data directly (exactly one of its four grid corners at y=1,
   not the one guessed) fixed it. A separate, unrelated bug compounded
   this: the hand-built corner geometry spanned `[0, height]` instead of
   being centered on local origin like every other shape (`±bounds.y/2`),
   which is the convention piece positioning relies on — fixed by
   centering it to match. Marked "good enough for now" by the user, with
   a known remaining nitpick (lower edges not perfectly coplanar with the
   straight roof piece's lower edge) deferred rather than chased further.

**Done and verified in-browser:**
- Placement UX: click a palette piece to select it, ghost preview follows
  the cursor (ground raycast), left-click to commit. Snapping
  (`src/lib/scene/snapping.ts`) finds the closest pair between the ghost's
  own snap points and any placed piece's, and if within 1m shifts the ghost
  so that pair coincides exactly (edge-to-edge). Palette selection and
  placed pieces are owned by `App.svelte` and bound down through
  `Viewport`/`PiecePalette`, so state survives toggling the attribution
  panel. **User-verified** — this was the biggest remaining unknown
  (raycasting, pointer events, the Svelte-reactivity-into-imperative-
  Three.js bridge via `$effect` inside `onMount`) and it works.
  Controls, revised after hands-on feedback (original Esc-to-cancel /
  click-placed-piece-to-remove scheme replaced entirely):
  - **WASD** pans the camera, relative to current facing, smooth while
    held (clock-based delta). Works regardless of selection/move state —
    originally all keyboard handling was gated behind an active selection.
  - **R** rotates the ghost 45° at a time (only while placing/moving).
  - **Right-click** cancels the current placement or move (replaced Esc);
    the browser's context menu is suppressed on the canvas.
  - **Middle-click** deletes whatever placed piece is under the cursor,
    independent of any other state.
  - **Left-click** on an existing placed piece (with nothing else active)
    picks it up to relocate — ghost follows the cursor with the same
    snapping logic, preserving the piece's current rotation, click again
    to drop. Selecting a palette piece mid-move cancels the move.
  - Shipped with a real bug from this rework, since fixed: picking up a
    piece hid it immediately but left the ghost unpositioned until the
    next mouse-move, so a click without moving the mouse made the piece
    vanish with nothing visible in its place — reported as "still
    deletes," actually a missing initial ghost placement.
  - Second bug, since fixed: OrbitControls binds left-drag/middle-drag/
    right-drag to rotate/dolly/pan — the same buttons this app's own
    actions use — and firing on `pointerdown` meant just *starting* a
    camera drag fired the action too (e.g. repositioning the camera while
    a piece was selected dropped a spurious piece every time). Fixed by
    moving all action logic to `pointerup`, gated on the pointer having
    moved less than 5px since the matching `pointerdown` — a real click,
    not a drag.
- Piece palette (`src/lib/PiecePalette.svelte`) is clickable — selects/
  deselects a prefab to place, highlights the active selection.

**Done and verified in-browser (materials-tally + dedupe batch):**
- Materials cost tally (`src/lib/CostTally.svelte`) — `$derived.by` sum of
  `getPieceData(prefab).cost` across `placedPieces`, rendered in the
  `<aside>` below the palette. Verified interactively: placing a Wood Floor
  updates the tally from "No pieces placed yet." to "2 Wood".
- Snap-point dedupe (`src/lib/scene/snapping.ts`) — collapses identical
  (within 1e-5) pos+rot snap-point pairs once at catalog-load time, in the
  `piecesByPrefab` map that both `snapping.ts` and (indirectly) `Viewport`
  read through. Resolves the contradiction two entries up in this doc
  ("dedupes... at load time" vs. "still outstanding") — it's now actually
  done. No behavior change on the current 18-piece catalog (verified zero
  duplicates exist today); this is defensive for when the catalog grows.
- Headless verification harness (`npm run verify`) — see top of Track B
  status section above.

**Done and verified in-browser (persistence-chain batch, same session as
above):**
- `localStorage` save/load (`src/lib/persistence.ts`, autosave `$effect` in
  `App.svelte`) — versioned envelope, validated on read, degrades to empty
  on any storage failure (private browsing, quota, disabled). Refresh
  round-trip and Clear-all-persists-empty both verified interactively.
  `Toolbar.svelte` was extracted from `App.svelte`'s inline header as part
  of this task, specifically so later toolbar-adding tasks (below) wouldn't
  each re-edit `App.svelte`'s markup.
- JSON export/import — Export downloads `valheimdraft-<timestamp>.json` via
  `persistence.ts`'s `serialize()`; Import validates via `deserialize()`
  and shows an inline error on malformed files without touching existing
  state. Ids are regenerated (`crypto.randomUUID()`) on import since
  `PlacedPiece.id` is a UI-only key, not part of the layout's meaning.
  Round-trip and malformed-file error path both verified interactively.
- Undo/redo — history lives in `App.svelte` as `past`/`future` snapshot
  stacks driven by a single `$effect` watching `placedPieces` (same pattern
  as the autosave effect), which makes Clear-all and JSON import undoable
  for free without touching those files. Two re-entrancy traps handled: a
  `suppressHistoryPush` flag so undo/redo's own reassignment isn't recorded
  as a new step, and `untrack()` around the `past`/`future` reads/writes
  inside the effect (writing to them would otherwise re-trigger the same
  effect — hit `effect_update_depth_exceeded` during development before
  this fix). Ctrl+Z/Ctrl+Shift+Z/Ctrl+Y bound in `Viewport.svelte`; an
  in-progress move (piece picked up, not yet dropped) is cancelled before
  an undo/redo fires via the keyboard path. **Known minor gap, confirmed
  low-severity by direct testing, not fixed:** the Toolbar's Undo/Redo
  *buttons* don't go through that same move-cancel step (only the keyboard
  shortcut does) — triggering undo/redo via the button while mid-move can
  leave a ghost that silently fails to commit on the next click. No crash,
  no data corruption, no console errors (verified), and the existing
  right-click-cancel always recovers it. Worth closing if it comes up, not
  urgent.
- Shareable URL — `src/lib/shareUrl.ts` encodes the scene via
  `CompressionStream('gzip')` + base64url (a `g`/`r` prefix tag lets the
  decoder fall back to uncompressed base64url if `CompressionStream` isn't
  available), capped at 8000 encoded characters. `App.svelte` decodes
  `location.hash` on startup (after the synchronous `localStorage` restore,
  since decoding is async and `$state`'s initial value can't await
  anything), takes priority over the localStorage-restored layout, and
  clears the hash immediately so a reload or a failed decode never
  re-applies it. A shared-link load does not itself become an undo step
  (Ctrl+Z right after opening a link is a no-op, by design) — **this was
  checked directly against a real timing race, not just assumed**: an
  earlier hypothesis that the async decode could race the undo-history
  effect's first run and corrupt the *next* action's undo entry turned out,
  on instrumented testing, not to occur in practice (the effect's first run
  reliably completes before gzip decompression resolves) — no code change
  was needed, but it was verified rather than trusted from the agent's
  report alone.

**Done and verified in-browser (vertical placement, added after MVP was
first declared complete):**
- Vertical (Y-axis) placement and snapping (`src/lib/Viewport.svelte`) —
  see "MVP status: COMPLETE (again)" near the top of this doc for the full
  root-cause and fix writeup. In short: the placement raycast now targets
  the ground *and* already-placed pieces together instead of the ground
  alone, so the ghost's tentative height reflects whatever's actually under
  the cursor — which was the only missing piece, since `snapPosition()`'s
  3D search and the piece data's own top/bottom snap points were already
  correct. Verified numerically via the app's own Export JSON (exact
  `pos.y` deltas of `1.0` stacking `Wood Pole` pieces, both via fresh
  placement and via picking up and moving an existing piece), and
  adversarially (placing near, not on, an unrelated tall piece still rests
  at normal ground height — no spurious magnetic snapping). Horizontal
  ground-level snapping confirmed unchanged (same `pos.y`, same 2.0-unit
  offset as before the change).

**Done and verified in-browser (rotation control, matching the real
game's scroll-to-rotate scheme):**
- Scroll-wheel piece rotation (`src/lib/Viewport.svelte`) — scrolling now
  rotates the placement ghost by 45° per notch (same increment as the
  existing R key, which still works too) while a piece is active
  (selected from the palette, or picked up to relocate); scrolling zooms
  the camera as before when nothing is active. The tricky part: OrbitControls
  registers its own `wheel` listener on the same canvas in its
  constructor, so a naive second listener calling `preventDefault()`
  would not stop it from also firing — both rotation and zoom would
  happen together. Fixed by registering the app's own listener in the
  capture phase (`{ capture: true, passive: false }`) and calling
  `stopImmediatePropagation()` when a piece is active, which reliably
  runs before OrbitControls' bubble-phase listener regardless of
  registration order. A `updateGhostPosition()` helper was extracted out
  of `handlePointerMove` so the ghost visibly reflects a scroll-triggered
  rotation immediately, without waiting for the next mouse move (R now
  benefits from this too, for consistency). Verified numerically via
  Export JSON: 2 scroll notches → exactly 90° yaw, both via fresh
  placement and via the pick-up-and-relocate path; confirmed zero camera
  movement while scrolling with a piece active (bit-for-bit identical
  camera position before/after); confirmed the ghost updates with zero
  intervening mouse movement; confirmed idle-scroll zoom and the R key
  both still work.
- **A real pre-existing bug found and fixed while adversarially testing
  the above:** `raycastPlaced()`/`raycastGroundAndPlaced()` could
  silently miss a piece that was just re-rendered (e.g. right after a
  deselect, which rebuilds `placedGroup` with fresh mesh instances) if
  the raycast happened before the next animation frame — Three.js
  raycasting reads `matrixWorld` directly, and a newly-created/re-added
  `Object3D`'s `matrixWorld` isn't recomputed until the next render pass,
  not synchronously. Reproduced directly (not just theorized): picking up
  a piece immediately after deselecting, with zero intervening mouse
  movement, intermittently failed to register at all — persisted even
  with a 100ms wait, which ruled out a simple "just needs more time" race
  and pointed at matrix staleness specifically. Fixed by forcing
  `placedGroup.updateMatrixWorld(true)` at the top of both raycast
  helpers — cheap at wood-tier piece counts, correct regardless of
  render-loop timing. This bug predates this session's work (both
  raycast helpers already existed) but directly affected the
  pickup-then-rotate flow being verified, so it was fixed in place rather
  than filed separately.

**Done and verified in-browser (vertical-snap reliability — user-reported
"stacking works but snapping to the upper points feels unreliable"):**
- **Diagnosis, measured directly rather than guessed:** `SNAP_RADIUS`
  (1.0 world units, in `src/lib/scene/snapping.ts`) was not the problem —
  placing a `Wood Wall (Log)` (2.44m × 0.55m deep × 0.53m tall, snap
  points at local y=±0.25) and offsetting the second placement in small
  pixel increments showed every offset that landed on the wall's *own
  surface* snapped to an exact 0.500 delta; the failure was that the
  wall's 0.55m depth is a thin raycast target — miss it by more than
  roughly half that depth and the raycast falls straight through to the
  ground, a full piece-height below the real connection point, which no
  radius increase could bridge without also risking false-positive snaps
  to unrelated ground-level pieces.
- **Fix**: `snapPositionAlongRay()` (`src/lib/scene/snapping.ts`) —
  independent of whether the raycast hit the target piece's mesh, it
  finds the closest real snap point to the *aiming ray itself*
  (`THREE.Ray.distanceToPoint()`, independently verified to correctly
  clamp to the forward half-line — a point behind the ray reports
  distance-to-origin, not a false near-zero from treating the ray as an
  infinite line) within a new, more generous `RAY_SNAP_REACH` (1.5 world
  units — deliberately separate from `SNAP_RADIUS`, which still governs
  the reliable point-to-point case once a good tentative position
  exists). `Viewport.svelte`'s `updateGhostPosition()` now calls this
  instead of the plain `snapPosition()` (kept, unchanged, still exported).
  This matches how the real game's own snap system works: it detects
  nearby connection points around where you're aiming, not "did your ray
  hit this exact triangle."
- **A real design flaw caught mid-implementation, not shipped:** the
  initial proposed disambiguator (for pieces with multiple snap points at
  the same x/z but different heights, e.g. a wall's top vs. bottom —
  which a straight-down ray can't tell apart) was "pick whichever pairing
  lands closest to the raycast-based tentative position" — but
  `tentativePos.y` is exactly the untrustworthy value this fix exists to
  correct, so that scheme would have systematically preferred re-embedding
  the new piece at the *same* height as the target over actually stacking
  on it. Replaced with: rank candidates by how little the new piece's
  vertical extent would overlap the target's (prefer sitting flush against
  it over sinking into it), then by proximity, then — since "on top" and
  "underneath" are equally close to a perfectly vertical ray — prefer the
  higher of two tied candidates, matching the ordinary build-upward
  expectation.
- **Verified numerically** (Export JSON, not screenshots): the reported
  failure case (a wall placed ~20px off-center across the target wall's
  depth) reproduced exactly on unmodified `main` (delta ≈0, no stack) and
  now snaps correctly (delta exactly 0.500); the effective forgiveness
  extends to ~44px of depth-offset before correctly giving up (~46px+)
  rather than snapping unboundedly; horizontal floor-to-floor snapping is
  unchanged (exact 2.0-unit offset, same height); two pieces placed
  ~15 units apart don't spuriously cross-snap; vertical pole-stacking and
  scroll-wheel rotation (both from the immediately preceding session)
  remain unaffected.
- **Follow-up correction, same day, user-reported:** the overlap heuristic
  above was itself wrong for a case its own testing hadn't covered — a
  wall placed *end-to-end* next to another (extending a wall line
  horizontally, both at the same height) came out **staggered**, offset
  up or down by the snap-point spacing, instead of flush. Why: a flush
  connection is *supposed* to have full vertical overlap (both walls
  occupy the identical height range — that's what flush means), so
  "prefer minimal overlap" actively penalized the correct answer and
  preferred a mismatched top-to-bottom pairing instead. Testing at the
  time covered pure vertical stacking and floor-to-floor (floors have
  snap points at only one height, so this exact failure mode can't occur
  there) but never end-to-end wall-to-wall — a real gap in verification
  coverage, not just bad luck.

  **Redesigned per direct user feedback**, replacing overlap-scoring
  entirely: score every qualifying candidate by how close the piece's own
  *resulting visual center* (root + rotated `piece.center`, exactly as
  `Viewport.svelte`'s `positionMesh()` renders it) would land to the
  *aiming ray itself* — not an abstract property of the candidate, but
  literally where the cursor is pointing. One rule resolves both cases
  through the same logic: aiming above a piece puts the "stack on top"
  candidate's center near the continuing ray (embedding into it doesn't);
  aiming level with a wall's end puts the "flush" candidate's center near
  the ray (a staggered mismatch doesn't). No special-casing which
  scenario it is.

  **One genuine mathematical limit, not a design flaw:** when the aiming
  ray is (near) perfectly vertical — the ordinary case for the "Top"
  camera preset aimed anywhere near screen center — distance-to-candidate-
  center carries *no* real signal at all, since a vertical ray's distance
  to a point depends only on horizontal offset, never height; two
  candidates directly above vs. below the same point are exactly tied by
  construction, differing only by camera-math floating-point noise
  (measured ~1e-4). Detected directly from the ray's own shape
  (`ray.direction.x²+z² < 0.01²`, calibrated against the "Top" preset's
  deliberate small tilt to avoid gimbal lock, vs. ~1e-2+ for any
  meaningfully off-center aim) rather than by comparing scores generally,
  so it only engages in that specific degenerate regime and never
  interferes with ordinary scoring elsewhere. Within it, falls back to
  the same "prefer building upward" convention the old code already used.
  Verified numerically both ways: end-to-end wall extension now lands
  both pieces at the identical Y (to float precision); wall-on-wall
  stack, pole stack, and floor edge-to-edge all re-confirmed unaffected;
  aiming above vs. level with the same wall produces the two different
  correct outcomes (stack vs. flush-extend) from the one mechanism.
- **Follow-up, same day, user-reported:** long pieces (e.g. a 2.44m wall)
  couldn't reliably reach a target with their *far* end — the previous
  fix's `centerDist` scoring (correctly used to disambiguate same-target
  candidates) was, when it was the ONLY ranking criterion, penalizing any
  candidate whose center wasn't near the ray — which any far-end
  connection necessarily is, by construction (the far end sits at the
  target; the center sits half a piece-length away from it). Fixed by
  reordering into a proper three-level comparison: `rayDist` (distance
  from the ray to the real target point — independent of piece geometry,
  so it doesn't care which end reaches it) now decides PRIMARILY which
  connection point the user means; `centerDist` only breaks ties between
  candidates that share the same target point (exactly the top/bottom and
  flush/stagger cases the previous fix solved); the near-vertical "prefer
  higher" fallback still applies as the last resort, one level deeper.
- **A second, deeper issue found via the new unit suite while adding the
  far-end test — not by inspection, by actually running it:** nothing
  excluded a candidate from connecting via the SAME local snap offset the
  target used for that point, rather than the complementary one — which
  places the new piece in exact positional coincidence with the piece
  it's connecting to. Confirmed this could win under `rayDist`/`centerDist`
  scoring for a majority of tested camera angles (4 of 5), since a fully
  degenerate, 100%-overlapping candidate can still score well by pure
  distance metrics. Fixed with a hard exclusion (not a scoring input —
  ray/center distance are legitimate signals for "which real connection
  did you mean," but "does this erase an existing piece" isn't a matter
  of degree): any candidate landing within 0.05 units of any placed
  piece's own root position is skipped outright, checked against every
  placed piece, not just the one owning the target point.
- **Also found and fixed in the same pass:** the flush-end-to-end test
  added the previous round only asserted `result.y`, which the degenerate
  same-side candidate above *also* satisfies (same height, wrong X) — so
  that test had been passing for the wrong reason since it was written.
  Recalibrated with a realistic `tentativePos` + ray combination (a
  ray-only version turned out to be genuinely ambiguous between
  flush-extend and stack-above/below for a wall's fully symmetric 4-corner
  layout — not a bug, just not representative of real usage, where the
  raw ground raycast also carries real signal) and strengthened to check
  x, y, and z.
- **A standing regression suite now exists** (`src/lib/scene/snapping.test.ts`,
  `npm run test`, wired into CI) covering every case above as a pure unit
  test against real catalog prefabs — no browser, no camera, no pixel
  targeting. Added specifically because this session's three rounds of
  snap-scoring fixes were each found via real usage after the previous
  fix shipped; see the "MVP status" section's scalability discussion
  below for the full reasoning. Extend this suite, not a fresh throwaway
  script, for any future snapping.ts change — including whatever new
  piece tiers (stone, iron, roofs, stairs) turn out to need.

**Everything not yet built from here is tracked in the "Backlog" section
near the top of this doc, not repeated here.**

### Known extractor gaps

- **Duplicate snap points — fixed in the webapp's loader.** `ashwood_stair`
  (not in the current wood-tier catalog) had two exact duplicates —
  `(0,1,-1)` and `(0,0,1)` — matching the wear-state-subtree theory (the
  snap-point query matches inactive children too). Fixed at
  `src/lib/scene/snapping.ts`'s catalog-load time (dedupe by pos+rot, 1e-5
  epsilon), not in the extractor, per the original plan. The current
  18-piece catalog has zero duplicates, so this was defensive, not a live
  bug fix — it protects the catalog once it grows past wood tier.
- **Bounds `center` — fixed and verified.** `PieceData` now carries `center`
  (`bounds.center`) alongside `size`; re-ran the extractor and confirmed
  against `wood_floor` (comes back near-zero, as expected for a symmetric
  piece).
- **Snap-point local-to-root composition — fixed.** Position/rotation are
  now composed through the transform hierarchy into the prefab root's local
  space (same approach `GetBounds` already used for mesh corners), instead
  of raw `t.localPosition`/`t.localRotation` relative to each transform's
  immediate parent. `wood_floor` still checks out correctly post-fix.

Also from inspecting the dump: **410 of 664 pieces have zero snap points**
— sampling them shows this is expected, not a bug (food, furniture, material
stacks, saplings, siege weapons — items placed freely, not on the snap
grid). Worth remembering when picking the MVP wood-tier piece list: filter
for pieces that actually have `snapPoints`, not just anything with a `Piece`
component.

---

## Verification (once implementation begins)

- Local: `npm run dev` — place, rotate, remove pieces; save/load round-trips.
- `.vbuild` round-trip: export from the app, import into PlanBuild in-game, verify layout matches (Track A item 4).
- Deploy `main` to `gh-pages` and click through the same flows on the live site (GitHub Pages project sites don't do native per-PR previews — verification happens against the deployed site, not a PR preview).
- License audit before first deploy: confirm no wiki images or ripped assets are in the repo; confirm attribution page is present and disclaimer is visible in the deployed UI.

---

## Catalog expansion — all three batches shipped (post-MVP)

MVP shipped 18 hand-picked wood pieces with no generator — `pieces.json` was
written by hand from `pieces-dump.json` + `bpcsaveall` data in one commit.
211 buildable pieces in the source data have snap points; 180 weren't in the
app. This work built a repeatable pipeline to grow the catalog in reviewed
batches instead of continuing to hand-author entries one at a time.

**Batches** (grouped by material family, not by how hard each one turned out
to be): 1 = wood gaps + core wood + wood-iron + darkwood + stone + iron. 2 =
ashwood + grausten + flametal + black marble. 3 = timberwood + scalewood +
dvergr + misc. **All three batches are shipped** — 204 of 207 classified
pieces (the 3 excluded are wall-hanging adornments, see "New shapes" below).
Batch 1 was built directly; batches 2 and 3 were built by two parallel
subagents, each in an isolated git worktree, working only in
`catalog-overrides.json` for their own families and validating independently
via `CATALOG_FAMILIES=<families> npm run catalog` (see "Parallel batches 2
and 3" below for how that was set up and what came out of it). `maxBatch: 3`
in `scripts/catalog-overrides.json` ships all of them.

### The pipeline

- **`scripts/build-catalog.ts`** (run via `npm run catalog`, no build step —
  Node 24 strips TS types natively) joins `pieces-dump.json`, the
  `shudnal.BuildPiecesCustomized/*.json` per-piece files, and the Hammer
  section of `Pieces and properties.md` (the only source of English piece
  names — parsed directly, not hardcoded). `VALHEIMDRAFT_DATA` overrides the
  default `../valheimdraft` data-repo path.
- **`src/lib/catalog/derive.ts`** — the classification logic, pure and
  THREE-free so it's shared unchanged between the generator and the vitest
  suite (`derive.test.ts`). For each piece it infers a shape from the raw
  snap-point pattern (2 diagonal points → `beam`, 3 → `triangle`, a 4-corner
  box with one odd-height corner → `hip`/`valley`, 5 = corners+center →
  `cross`, 6 = eave+ridge → `ridge`, etc.) and flags anything that doesn't
  fit a known pattern, has a functional name (`door|gate|grate|window|
  shutter|hatch|arch`, unless it's a `stair`/`ladder`, which already have
  legacy shapes) with no dedicated shape, or has bounds that look wrong
  relative to its own snap points (sub-mesh bounds, off-center pivot,
  oversized).
- **`scripts/catalog-overrides.json`** is the only hand-maintained file: it
  pins the original 18 MVP pieces' shape/family/bounds/center exactly as
  they were (labels are NOT pinned — see below), assigns material families
  by prefab-prefix regex, forces a shape for the handful of pieces the
  auto-classifier can't resolve on its own (see "New shapes" below), and
  lists batch/family exceptions.
- **`catalog-report.md`/`.json`** (generator output, committed) is the
  reviewable artifact — every classified piece, its verdict (CLEAN /
  NEEDS_NEW_SHAPE / SUSPICIOUS / REVIEW / EXCLUDE), and why. This is what
  gets read before raising `maxBatch`, not just trusting the generator ran
  without errors. The generator itself refuses to write any output
  (`process.exit(1)`) if a piece in a *shipped* batch isn't CLEAN or its
  family has no registered render color.

**Labels switched to in-game names** for all pieces, including the original
18 (e.g. "Wood Wall (Log)" → "Log Beam 2 m", matching what the Hammer menu
actually shows) — a deliberate decision made when this batch was scoped, not
an accident of the generator. Shape/family/bounds/center for those 18 are
still frozen (`pinned: true` in the overrides), so this only changed what's
displayed, not what's rendered or how saved layouts resolve.

### New shapes

`box`/`cylinder`/`wedge`/`stairs`/`ladder`/`fence`/`hip`/`valley` (the
original MVP set) gained `beam`, `triangle`, `cross`, `ridge`, `arch`,
`lattice`, `door` — all built in `src/lib/scene/geometry.ts`, driven by a
`geom` parameter block the generator precomputes from real snap-point data
and stores in `pieces.json` (see `src/lib/catalog/types.ts`'s `ShapeParams`
union). `hip`/`valley` were also generalized: which corner is the odd one
out (`geom.odd`) now comes from the piece's own snap data instead of being
hardcoded to the two original wood corner pieces (unchanged default when
`geom` is absent, so the two pinned pieces render identically to before).

Three of these needed a manual shape override rather than pure
auto-classification, all in `catalog-overrides.json`'s `pieces` map:
- `stone_arch`/`darkwood_arch` → `arch`. Auto-classification can't tell an
  archway from a flat panel by snap-point count alone (they don't share one
  consistent pattern), and the functional-name rule (`arch` in the name)
  already routes them to NEEDS_NEW_SHAPE, so this is a targeted fix, not a
  gap in the pattern logic.
- `iron_floor_1x1_v2`/`_2x2`/`iron_wall_1x1`/`_2x2`, `iron_grate` → `lattice`
  (frame + bar grid). Left to auto-classification these are plain 8-corner
  boxes (a valid CLEAN verdict), but a solid box is wrong for a see-through
  cage piece. `iron_grate` specifically is the in-game **"Iron Gate"** (not
  a floor grate — found by checking the actual label, not assumed from the
  prefab name) and uses vertical-bars-only (`bars: "vertical"`), matching a
  portcullis rather than a cage floor/wall.
- `darkwood_gate` → `door` (2 leaves).
- `wood_fence_gate` → kept `fence`, with `boundsFrom: "snaps"` — its real
  bounds cover only the hinge post (0.12m vs. ~2m of snap extent), the same
  sub-mesh-bounds problem `wood_gate` already had in the MVP catalog.

**Two real bugs found and fixed during this batch, not just theorized:**
- **Classification bug, caught by eye before shipping, not by a test:** the
  first version of the "4 corners, 2 heights → sloped wedge" rule didn't
  check whether the height split actually correlated with depth. A plain
  vertical wall (`woodwall`: two corners at y=+1, two at y=-1, but *both
  groups at the same z*) matches "2/2 height split" exactly as well as a
  real roof panel does, and was rendering as a tilted ramp instead of a flat
  wall. Fixed by requiring the low and high corner groups to also differ in
  depth (z) before calling it a slope — otherwise it's `box`. This wasn't
  wood-tier-specific: the same fix corrected the same misclassification for
  every wall-type piece across all three batches (ashwood, grausten, scale,
  dvergr, stave, stone_fence, crystal_wall, stake_wall — all previously
  wrong), confirmed by re-running the generator and diffing the report.
- **Runtime crash, caught by the headless verify gallery, not by vitest:**
  `door`'s first implementation merged an `ExtrudeGeometry` (the frame,
  non-indexed) with `BoxGeometry` leaves (indexed by default) via
  `mergeGeometries()`, which requires all-or-none of its inputs to be
  indexed — this failed silently in the browser (a `console.error` from
  Three.js, not a thrown exception) and left `placedGroup` in a broken state
  that crashed the next render effect. Fixed by calling `.toNonIndexed()` on
  the leaf boxes before merging. `derive.test.ts`'s "every piece builds
  geometry with finite vertex positions" check *should* catch this class of
  bug in vitest going forward — confirmed by re-running it against the
  fixed code, not just asserted.
- **Design iteration, not a bug:** `door`'s first visual pass (a flush,
  subtly recessed leaf) was indistinguishable from a plain box in a
  screenshot — this app's flat directional lighting has no shading cue for
  a few-centimeter depth difference. Redesigned to cut a real geometric
  opening through the frame (same technique as `arch`) with the leaf/leaves
  visibly offset within it, which reads correctly in silhouette from any
  angle rather than relying on shading.

### Palette and cost display

`PiecePalette.svelte` is no longer a flat list — pieces group into
collapsible `<details>` sections by family (in the same order the generator
already sorted `pieces.json`, so no duplicate ordering config at runtime),
each in in-game menu order, plus a search box that filters by label/prefab
and force-opens matching groups. Cost items (in the palette and
`CostTally.svelte`) show display names (`RoundLog` → "Core wood", etc.) via
`src/lib/catalog/itemNames.ts`, reading a generator-written
`src/data/item-names.json` built from `catalog-overrides.json`'s
`itemNames` map.

### Snapping change

`snapping.ts`'s degenerate-overlap exclusion (in `snapPositionAlongRay`,
prevents a candidate from landing exactly on an existing piece's root) was
narrowed from "any placed piece" to "same prefab **and** same rotation".
Some pieces have a snap point exactly at their own root (`darkwood_arch`,
confirmed the only one in batch 1) — the old any-piece check blocked a
*second*, differently-rotated arch from ever connecting to the same point,
which is a real, valid connection, not a duplicate. Covered by new
`snapping.test.ts` cases: same-prefab+same-rotation still blocked
(regression baseline), same-prefab+different-rotation now allowed (the
fix), and a mixed-prefab coincidence (`wood_floor`/`iron_floor_2x2`, which
happen to share a real local snap offset) confirming the narrowing doesn't
accidentally exclude too little either.

### Verification

`npm run catalog && npm run check && npm run test` all pass. `npm run
verify` (with `VERIFY_GALLERY=1`) seeds `localStorage` with every batch-1
piece in an adaptively-spaced grid per family, screenshots each
(`.verify/gallery-<family>.png`), and checked for console errors — this is
how the shape work above was actually reviewed, since this environment has
no interactive browser. Every batch-1 family was reviewed this way,
including targeted close-ups (front-on for the arch/door shapes
specifically) before the two bugs above were found and fixed.

**Not shipped in batch 1, resolved when batches 2/3 shipped** (see below):
`piece_stakewall_blackwood`'s off-center pivot, `blackmarble_column_1/2`'s
18-snap-point pattern, `stave_wall_2x2`'s 6-point pattern, and the various
"arch"-named pieces that turned out to be roofs, windows, or doors rather
than doorways.

**Still open:** the "Roof Cross" shape's X-vs-bowtie question (built as an
X per the generator's guess; wasn't specifically re-verified against a real
in-game screenshot).

### Parallel batches 2 and 3

Batches 2 and 3 were built by two subagents working simultaneously, each in
its own isolated git worktree (`Agent` tool, `isolation: "worktree"`), so
their edits couldn't collide on the same working copy. Each was scoped to
*only* edit `scripts/catalog-overrides.json`'s `pieces` map for its own
families and explicitly told not to touch `derive.ts`/`geometry.ts`/
`build-catalog.ts` — if a piece needed something the existing shapes/override
mechanisms couldn't express, the instruction was to flag it and move on
rather than invent a fix mid-batch. This kept both agents' real work
(interpreting each piece's actual data, choosing the right shape, visually
verifying it) fully independent, with only a thin, mechanical integration
step left afterward.

**Two generic capabilities were added to the generator *before* spawning the
agents**, specifically so neither agent needed to touch shared code:
- **`CATALOG_FAMILIES=family,family npm run catalog`** overrides the
  normally-cumulative `batch <= maxBatch` shipped filter with an explicit
  family list. Batches are cumulative by design (`maxBatch: 3` ships batches
  1-3 together), which would otherwise make it impossible to validate batch
  3 in isolation while batch 2 was simultaneously mid-fix in a different
  worktree — every batch-3 test run would fail on batch 2's still-broken
  pieces too. This sidesteps that entirely: each agent validated with a real
  `npm run catalog` run, a real `pieces.json`, and real rendering, scoped to
  only its own families, regardless of the other batch's state.
- **`{"accept": true, "note": "..."}`** in a piece's override entry keeps
  whatever shape `classify()` already guessed (which is often already
  correct) but forces the verdict to CLEAN when only a heuristic sanity
  check — bounds-vs-snap-box mismatch, off-center pivot, oversized — false
  flagged it. Used for e.g. `ashwood_wall_roof_26`/`_upsidedown` (a real
  gable triangle whose shallow 26 degree eave overhang just missed the
  bounds-sanity tolerance) and both drawbridge pieces (genuinely oversized,
  not bad data).

**A real generator-schema gap the batch-2 agent found and correctly worked
around, then fixed properly afterward:** `piece_grausten_roof_45_arch` and
`_arch_corner`/`_corner2` are roof panels/corners, not doorways, despite
"Arch" in their in-game names ("Grausten Arched Roof(...)") — a case where
the functional-name heuristic's veto is a false positive, confirmed by
comparing their raw snap points directly against `piece_grausten_roof_45`/
`_corner`/`_corner2` (plain roof pieces one prefab-name away, already
shipping CLEAN with the mechanically-correct shape). The corner variants'
own snap points are *identical* to their non-arch siblings — the correct
shape is `triangle` with real snap-derived `geom`. But the override
mechanism only ever computes `geom` for `lattice`/`door` overrides, so
forcing `shape: "triangle"` on a functional-name-matched piece would throw
`"requires geom"` at render time — a real schema gap, not a piece-specific
problem. The agent, correctly scoped away from touching `derive.ts`, worked
around it with `shape: "valley"` (no `geom` needed, defaults to the same
odd-corner guess the two original pinned wood corner pieces use) — visually
reasonable but not the mechanically exact shape, and using a *default*
rather than *derived* odd corner. Fixed properly during integration by
giving `classify()` an optional `bypassFunctionalName` flag (and a matching
`"bypassFunctionalName": true` override field) that skips just the
door/gate/arch name veto and lets the piece fall through to the ordinary
snap-pattern dispatch — both corner pieces now render with the exact same
derived `geom` as their siblings, confirmed identical
(`piece_grausten_roof_45_arch_corner`'s `geom.p` matches
`piece_grausten_roof_45_corner`'s, same 3 points).

**Integration:** both worktree branches were merged into `main` (batch 2
fast-forwarded cleanly; batch 3 needed a real merge, conflicting only in the
two *generated* report files and in adjacent, non-overlapping additions to
`catalog-overrides.json`'s `pieces` map — resolved by hand, then
`npm run catalog` regenerated both report files fresh). Both agents also
independently found the same real gap outside their assigned scope:
`src/lib/scene/materials.ts` had no color entries for *any* batch 2/3
family, which — because the generator hard-fails on a shipped piece whose
family has no registered color — would have blocked either batch from
building at all. The batch-2 agent added its four families' colors
directly (flagged clearly as a scope exception, necessary to validate
anything); the batch-3 agent added its own temporarily, verified with them,
then reverted before committing and flagged the gap instead. All eight
colors (`ashwood`, `grausten`, `flametal`, `blackmarble`, `timberwood`,
`scalewood`, `dvergr`, `misc`) were reconciled into one commit during
integration.

Verified the same way batch 1 was: `npm run catalog` (`maxBatch: 3`, zero
FAIL lines, 204 of 207 classified pieces shipped), `npm run check`,
`npm run test` (57 tests — both agents correctly left the test files alone,
per instructions), `npm run build`, and `VERIFY_GALLERY=1 npm run verify`
across all 14 families with no console errors, plus targeted close-up
screenshots (front-view) confirming every new `arch`/`door`/`lattice` piece
across both batches — including the three new doors/gates
(`piece_hexagonal_door`, `stave_gate`, `ashwood_door`) and the grausten
archways — reads correctly rather than as a plain box.

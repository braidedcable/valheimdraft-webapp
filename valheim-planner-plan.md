# Valheim Building Simulator — GitHub Pages Webapp

## Context

Build a browser-based interactive Valheim building simulator, hosted on GitHub Pages, where a user can place buildable pieces (walls, beams, roofs, floors, etc.) to design bases. This document captures **Phase 0** — an asset-availability investigation the user asked for up front.

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

**PlanBuild** (github.com/sirskunkalot/PlanBuild) is the canonical in-game planner mod and defines `.blueprint` / `.vbuild` formats. `.vbuild` is **plaintext, one piece per line** (piece name, position, rotation) — trivial to parse. Supporting import/export gives instant interop with PlanBuild users and the Valheimians.com blueprint library. High-payoff, low-effort feature.

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
5. **`.vbuild` import/export**: export ships in MVP (near-free — same shape as the scene-state format below, one line per piece). Import is v2 — needs prefab-name mapping and error handling that export doesn't.

---

## Work tracks

Two tracks, because one of them needs Jared's Windows gaming PC and the
other needs this devcontainer. Track A sits in a queue for the next time
Jared's at that machine; Track B proceeds regardless. Within Track B nothing
is truly parallel — it's a solo project — so the grouping below is "what's
unblocked right now," not a dependency graph to work simultaneously.

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
  `deploy-pages`). **Needs one manual step**: repo Settings → Pages →
  Source → GitHub Actions — couldn't set this via API (same token
  permission limit as repo creation earlier). Won't actually deploy until
  that's flipped.
- ~~Attribution page + disclaimer~~ Toggled from the header; credits
  BuildPiecesCustomized (Unlicense), Jötunn (MIT), and the weirdgloop wiki
  (CC BY-NC-SA 3.0) — licenses checked from source, not assumed. Disclaimer
  in header and footer.
- ~~Pin the MVP wood-tier prefab list~~ 18 pieces (floor ×2, wall ×3, pole
  ×2, beam, door, stair, roof ×4, gate, fence, window, stepladder) — all
  verified present in both `pieces-dump.json` and the cost data before
  picking them.
- ~~Hand-author shape/material-family mapping~~ Done as part of building
  `pieces.json` (below) rather than as a separate artifact — three shapes
  cover all 18: `box` (most pieces), `cylinder` (poles — a round pole
  rendered as a box would look wrong), `wedge` (roofs/stairs, via
  `ExtrudeGeometry` on a triangle profile).
- ~~Stub `pieces.json`~~ **Skipped the stub** — Track A already had real
  data in hand (bounds/center/snap points from `pieces-dump.json`, costs
  from `bpcsaveall`), so `src/data/pieces.json` was built from real data
  directly. Also dedupes the confirmed exact-duplicate-snap-point gap at
  load time (`ashwood_stair`-style duplicates), per the "known extractor
  gaps" note that this belongs in the webapp loader.
- ~~Scene-state shape~~ Not yet formalized in code (no persistence/`.vbuild`
  work started), but the decision stands: `{prefab, pos:{x,y,z}, rot:{x,y,z,w}}`.

**Also done, ahead of "needs scaffold + stub data" below:**
- Three.js viewport (`src/lib/Viewport.svelte`): procedural geometry sized
  from each piece's real bounds, flat material-family colors, OrbitControls
  with iso/top/front camera presets. Renders the whole palette in a grid as
  an end-to-end sanity check of the art strategy — **not real placement UX**.
- Piece palette UI (`src/lib/PiecePalette.svelte`) — read-only list of
  names + costs for now; click-to-select/place is placement UX, not built.
- Build and `svelte-check` both pass clean. **Visually verified against the
  deployed site** (this environment has no browser, so this had to happen
  on the live GitHub Pages deploy rather than `npm run dev` locally).
  Deployed 4 times over the course of getting it right: `wedge` originally
  meant a solid triangular-prism ramp, which was wrong for every non-box
  shape it was applied to — roofs are a thin sloped panel, not a filled
  block (fixed, confirmed correct); stairs are visibly stepped, not flat
  (given their own `stairs` shape — zigzag profile extruded across width);
  the ladder is an open rail+rung frame, not a solid surface either (given
  its own `ladder` shape — two rails + evenly spaced rungs, merged). All
  three now confirmed correct by eye. `cylinder` (poles) and `box`
  (everything else) needed no changes.

**Still needed — the bulk of the remaining work:**
- Placement UX: cursor raycast → ghost mesh preview → snap-point highlight
  → click to commit, plus rotate/remove hotkeys. Turns the palette from a
  read-only list into an actual editor.

**Needs the scene-state shape (not placement UX being finished):**
- Save/load to `localStorage`.
- Export/import as JSON.
- `.vbuild` export — near-free given the shared state shape.
- Undo/redo (state snapshots).
- Shareable URL (encode state in the hash).

**Cost data is in** (`pieces.json` already carries each piece's `cost`
array) — materials cost tally is now just UI work: sum `cost` across placed
pieces and render it, no longer blocked on Track A.

**Explicitly deferred past MVP:**
- Structural integrity simulation (Valheim's beam-support rules).
- Swapping flat material colors for CC0 tiling textures.
- `.vbuild` import.
- Mesh instancing — plain meshes are fine at a wood-tier piece count, and
  instancing complicates per-piece raycast/select/remove. Add it if
  framerate actually becomes a problem.

### Known extractor gaps

- **Duplicate snap points — confirmed, not yet fixed.** `ashwood_stair` has
  two exact duplicates — `(0,1,-1)` and `(0,0,1)`, identical position *and*
  rotation each. Matches the wear-state-subtree theory (the snap-point query
  matches inactive children too). **Fix belongs in the webapp's loader**
  (dedupe identical `pos`+`rot` pairs on load), not the extractor — still
  outstanding, pick it up whenever the piece-loading code gets written
  (Track B).
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

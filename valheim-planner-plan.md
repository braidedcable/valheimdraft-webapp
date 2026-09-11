# Valheim Building Simulator — GitHub Pages Webapp

## Context

Build a browser-based interactive Valheim building simulator, hosted on GitHub Pages, where a user can place buildable pieces (walls, beams, roofs, floors, etc.) to design bases. This document captures **Phase 0** — an asset-availability investigation the user asked for up front — and sketches the implementation only at the level of high-level phases, deliberately leaving details to be fleshed out once Phase 0 conclusions are accepted.

Current repo (`/workspace`) is an unrelated devcontainer project; the webapp is greenfield and would live either in a subdirectory or a separate repo (decision deferred).

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

### Key source URLs (for follow-up in Phase 1)

- https://valheim.weirdgloop.org/w/Valheim_Wiki:Copyrights
- https://valheim.fandom.com/wiki/Valheim_Wiki:Copyrights
- https://valheim-modding.github.io/Jotunn/data/prefabs/prefab-list.html
- https://github.com/shudnal/BuildPiecesCustomized
- https://github.com/sirskunkalot/PlanBuild
- https://github.com/jessinthecloud/ValheimJsonExporter
- https://www.valheimians.com/builds/

---

---

## Pre-spike checklist

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

### Fallbacks (rank-ordered) if the preferred approach fails

1. **AssetRipper / AssetStudio on a local install** — dump prefab YAML privately, extract numeric fields into JSON, commit. Legally fine (numbers only, no assets), operationally clunky, and breaks on every game update.
2. **Manual in-game measurement** — build one of each piece using the 2m grid and character height as reference, hand-encode. Feasible only for a wood-tier MVP subset (~15–20 pieces); weeks of tedium if extended to the full catalog.

### Gate criteria

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

## High-level implementation phases

Deliberately sketchy — flesh out after Phase 0 conclusions are accepted and the open questions below are resolved.

### Phase 1 — Prototype scope decision (no code yet)

**Rendering (resolved): full 3D via Three.js.** Rationale:
- Valheim building is inherently 3D — diagonal beams, angled roof pieces (26° / 45°), and vertical support chains flatten poorly in 2D or isometric.
- Structural integrity (Phase 5) is a 3D problem; building it on a 2D renderer would force a rewrite.
- `.vbuild` piece entries are already x/y/z + rotation, so 3D interop is native.
- Real cost is placement UX (raycasting, ghost preview, snap highlighting, camera orbit), not rendering throughput. Three.js handles the mesh count comfortably via instancing.
- **De-risk built in:** ship free-orbit plus a small set of locked camera presets (top-down, front, iso-45°) so users have a simpler nav mode when free orbit is overkill. Cheap addition on top of the 3D pipeline.

Resolved (see "Open questions" below): repo is `braidedcable/valheimdraft-webapp`, framework is Svelte, MVP scope is wood-tier only, structural integrity is deferred past MVP.

Still to nail down with the user:
- Whether `.vbuild` import/export is in MVP or v2.

### Phase 2 — Build the piece catalog
Depends on the snap-point / dimension extraction gate above having passed.
- Run BuildPiecesCustomized `bpcsaveall` in a local Valheim install to dump piece names + material costs.
- Cross-reference with Jötunn prefab list for coverage.
- Run the BepInEx dimension/snap-point dump plugin (from the gate spike) to produce spatial data.
- Merge cost data + spatial data into a single `pieces.json`, the app's source of truth.
- Commit `pieces.json` (numeric data only, no ripped assets).

### Phase 3 — Core webapp skeleton
- Static site (Svelte + Vite). No server, deployable to GitHub Pages.
- **Three.js scene** with procedurally sized meshes per piece, flat material-family colors, and instancing for repeated pieces.
- Piece palette UI populated from `pieces.json`, scoped to wood-tier pieces for MVP (~15-20 pieces: floor, wall, roof, pole, stairs, door). Non-wood materials mostly reskin the same handful of shapes, so extending the palette later is additive, not a rework.
- Placement UX: cursor raycast → ghost mesh preview → snap-point highlight → click to commit. Remove and rotate hotkeys. Expect this to be the bulk of Phase 3 effort.
- Camera: free orbit + locked presets (top-down, front, iso-45°), pan and zoom.

### Phase 4 — Persistence & sharing
- Save/load to `localStorage`.
- Export/import as JSON.
- `.vbuild` export (and import if time permits) — PlanBuild is the reference implementation.
- Shareable URL (encode state in query string or hash).

### Phase 5 — Polish
- Materials cost tally (sum from `pieces.json`).
- Structural integrity indicator (Valheim's beam-support rules; may be v2).
- Undo/redo.
- Keyboard shortcuts.
- Attribution page and "unofficial fan project" disclaimer wired into the UI from day one, not bolted on at the end (per project ground rules).
- Optional: swap flat material-family colors for CC0 tiling textures. Deferred from v1 per user decision.

### Phase 6 — Ship
- GitHub Actions workflow to build and deploy to `gh-pages`.
- README with disclaimer, credits, license notes.

---

## Open questions to resolve before Phase 1 — RESOLVED

1. **Repo layout**: new dedicated repo — `braidedcable/valheimdraft-webapp` (separate from the `valheimdraft` extractor repo; both cloned into this devcontainer).
2. **Framework preference**: Svelte + Vite. Rationale: compiles away at build time, minimal runtime, gives reactive state for the palette/cost-tally/undo bookkeeping (Phase 5) without hand-rolled DOM diffing, and avoids the extra integration layer (react-three-fiber) React would need for Three.js.
3. **MVP piece scope**: wood-tier subset first (~15-20 pieces). Since materials mostly reskin the same shapes (box/wedge/cylinder) with flat color, once shape generators exist for wood tier, adding other materials is mostly more `pieces.json` entries, not a rewrite.
4. **Structural integrity**: deferred past MVP, consistent with wood-tier-first — ship pure placement (place/rotate/remove, no stability simulation) before adding real support-propagation logic.

Still open: whether `.vbuild` import/export is in MVP or v2 (see Phase 1 above).

---

## Verification (once implementation begins)

- Local: `npm run dev` (or equivalent) — place, rotate, remove pieces; save/load round-trips.
- `.vbuild` round-trip: export from the app, import into PlanBuild in-game, verify layout matches.
- Deploy preview via GitHub Pages branch on a PR, click through the same flows.
- License audit before first deploy: confirm no wiki images or ripped assets are in the repo; confirm attribution page is present and disclaimer is visible in the deployed UI.

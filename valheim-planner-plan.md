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
5. **`.blueprint` import/export** (retargeted from `.vbuild` — see "Blueprint interop" above for why): export ships in MVP, roughly a day of work given `PlacedPiece` already matches the needed shape — not near-free, since origin-relative coordinates, field order, and number formatting all need to be right, and the Unity/Three.js handedness question needs confirming first. Import is v2 — needs prefab-name mapping and error handling that export doesn't.

---

## Work tracks

Two tracks, because one of them needs Jared's Windows gaming PC and the
other needs this devcontainer. Track A sits in a queue for the next time
Jared's at that machine; Track B proceeds regardless. Within Track B nothing
is truly parallel — it's a solo project — so the grouping below is "what's
unblocked right now," not a dependency graph to work simultaneously.

**Status as of this session's end:** the app is live and functional —
https://braidedcable.github.io/valheimdraft-webapp/. You can place, snap,
rotate, relocate, and delete all 18 MVP wood-tier pieces, with a live
materials cost tally, working camera controls (orbit, WASD pan, presets),
persistence (`localStorage` autosave, JSON export/import, shareable URL
links), and full undo/redo. A headless-browser verification harness
(`npm run verify`, Playwright + Chromium) now exists so UI changes can be
checked in this devcontainer without deploying first — CI also runs
`npm run check` now, not just `build`. The entire persistence/undo/share
backlog from the previous session's list is done; the one remaining item is
`.blueprint` export (not `.vbuild` — see correction below), deferred
pending the Unity/Three.js coordinate-handedness question. Track A has one
outstanding item verified only by code review, not in-game (item 5,
`bpcsaveall` automation) — low priority, current data already in hand
covers what's needed.

**Correction (subagent-driven session, materials-tally + dedupe batch):**
`.vbuild` was the wrong export target — see "Blueprint interop" and
"Resolved decisions" below for the full correction. Short version: no
current tool writes `.vbuild` anymore, PlanBuild upgrades it to
`.blueprint` on save, and `.blueprint` is a superset (name/category/scale/
signs/chest contents) that the ecosystem actually reads and writes today.
Target `.blueprint` when that work starts.

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

**Explicitly deferred past MVP:**
- Structural integrity simulation (Valheim's beam-support rules).
- Swapping flat material colors for CC0 tiling textures.
- `.blueprint` export/import — see "Blueprint interop" correction above;
  budget ~a day, not near-free, and confirm the Unity/Three.js handedness
  question before writing the serializer. Deferred (not started) in favor
  of finishing the persistence/undo/share chain first.
- Mesh instancing — plain meshes are fine at a wood-tier piece count, and
  instancing complicates per-piece raycast/select/remove. Add it if
  framerate actually becomes a problem.

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

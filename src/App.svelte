<script lang="ts">
  import { untrack } from 'svelte';
  import Viewport from './lib/Viewport.svelte';
  import PiecePalette from './lib/PiecePalette.svelte';
  import CostTally from './lib/CostTally.svelte';
  import Attribution from './lib/Attribution.svelte';
  import Toolbar from './lib/Toolbar.svelte';
  import { serialize, deserialize } from './lib/persistence';
  import { decodeSceneFromHash } from './lib/shareUrl';
  import type { PlacedPiece } from './lib/types';

  const STORAGE_KEY = 'valheimdraft:scene:v1';
  const HISTORY_LIMIT = 50;

  function restorePieces(): PlacedPiece[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) return [];
      return deserialize(raw) ?? [];
    } catch {
      return [];
    }
  }

  let showAttribution = $state(false);
  // Which palette piece is selected does NOT participate in undo history —
  // it's a UI selection, not a scene edit, and undoing a placement should
  // not also yank the palette selection out from under the user.
  let selectedPrefab = $state<string | null>(null);
  let placedPieces = $state<PlacedPiece[]>(restorePieces());
  let sharedLinkError = $state<string | null>(null);

  $effect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, serialize(placedPieces));
    } catch {
      // Storage unavailable (private browsing, quota, disabled) — degrade
      // to in-memory only rather than crashing.
    }
  });

  // --- Undo/redo history ---
  //
  // Every mutation to placedPieces (Viewport's place/move/delete, Toolbar's
  // Clear all, and JSON import) is already a whole-array reassignment, so
  // rather than wrapping each call site to push history explicitly, this
  // watches placedPieces reactively with a single $effect — the exact same
  // pattern the localStorage autosave effect above already uses, and it
  // gets Clear all/import undo support for free without touching those
  // files.
  //
  // The re-entrancy trap: undo()/redo() themselves reassign placedPieces,
  // which would re-trigger this same effect and push a spurious history
  // entry, corrupting the stack. `suppressHistoryPush` is set immediately
  // before an undo/redo reassignment and consumed (cleared) the next time
  // this effect runs, so that specific reassignment is recorded as "just
  // move the baseline forward" rather than "record a new undoable step".
  let past = $state<PlacedPiece[][]>([]);
  let future = $state<PlacedPiece[][]>([]);
  let canUndo = $derived(past.length > 0);
  let canRedo = $derived(future.length > 0);

  let historyInitialized = false;
  let suppressHistoryPush = false;
  let lastSnapshot: PlacedPiece[];

  $effect(() => {
    const current = placedPieces;
    if (!historyInitialized) {
      // The effect's first run is just registering the initial value, not
      // a change — nothing to push.
      historyInitialized = true;
      lastSnapshot = current;
      return;
    }
    if (suppressHistoryPush) {
      suppressHistoryPush = false;
      lastSnapshot = current;
      return;
    }
    // A genuine new action: record where we came from, and drop any redo
    // branch — standard undo/redo semantics (a new action after undoing
    // discards the future).
    //
    // A second, subtler re-entrancy trap lives right here: reading `past`/
    // `future` (even just to spread them into a new array) registers them
    // as dependencies of *this* effect, so writing to them below would
    // re-trigger it forever (effect_update_depth_exceeded — hit this while
    // testing). `untrack` reads/writes them without subscribing, since
    // this effect's only real dependency should be `placedPieces`.
    untrack(() => {
      past = [...past, lastSnapshot].slice(-HISTORY_LIMIT);
      future = [];
    });
    lastSnapshot = current;
  });

  function undo() {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    past = past.slice(0, -1);
    future = [...future, placedPieces].slice(-HISTORY_LIMIT);
    suppressHistoryPush = true;
    placedPieces = previous;
  }

  function redo() {
    if (future.length === 0) return;
    const next = future[future.length - 1];
    future = future.slice(0, -1);
    past = [...past, placedPieces].slice(-HISTORY_LIMIT);
    suppressHistoryPush = true;
    placedPieces = next;
  }

  // --- Loading a shared layout from the URL hash ---
  //
  // A link like #g<base64url...> is an explicit intent to load that
  // specific layout, so it takes priority over whatever restorePieces()
  // found in localStorage above. Decoding is async (gzip decompression),
  // but placedPieces's *initial* $state value has to be synchronous, so
  // there's no way to have the hash-decoded value be that initial value.
  // Instead: seed placedPieces from localStorage as usual (above), then if
  // a hash is present, kick off the async decode here and swap it in once
  // it resolves. This means there's one brief initial render of the
  // localStorage-restored (or empty) state before the shared layout
  // appears — unavoidable given the platform's compression API is async,
  // and harmless since it's typically a same-frame swap.
  //
  // The hash is cleared immediately (not after decoding) so a failed
  // decode, a slow decode the user navigates away from, or simply
  // reloading the page never keeps re-applying — or re-attempting to
  // apply — the same shared link over the user's own subsequent edits,
  // and so the address bar doesn't keep showing a stale, very long hash.
  if (location.hash.length > 1) {
    const encoded = location.hash.slice(1);
    history.replaceState(null, '', location.pathname + location.search);

    decodeSceneFromHash(encoded).then((pieces) => {
      if (pieces === null) {
        sharedLinkError = 'That share link is invalid or corrupted — showing your saved layout instead.';
        return;
      }

      // Should Ctrl+Z right after opening a shared link undo back to the
      // pre-load (localStorage/empty) state? No — the user never asked for
      // that prior layout, so unraveling to it via undo would be
      // surprising. suppressHistoryPush marks this reassignment as moving
      // the undo baseline forward rather than recording an undoable step,
      // the same mechanism undo()/redo() use above. The net effect: Ctrl+Z
      // right after a shared-link load is simply a no-op (nothing in
      // `past` yet), which matches "undo does nothing surprising".
      suppressHistoryPush = true;
      placedPieces = pieces;
    });
  }
</script>

<div class="app">
  <Toolbar
    bind:placedPieces
    bind:showAttribution
    {canUndo}
    {canRedo}
    onUndo={undo}
    onRedo={redo}
    {sharedLinkError}
  />

  <main>
    {#if showAttribution}
      <div class="attribution-panel">
        <Attribution />
      </div>
    {:else}
      <aside>
        <PiecePalette bind:selectedPrefab />
        <CostTally {placedPieces} />
      </aside>
      <div class="viewport-wrap">
        <Viewport bind:selectedPrefab bind:placedPieces onUndo={undo} onRedo={redo} />
      </div>
    {/if}
  </main>

  <footer>
    <p class="disclaimer">Unofficial fan project. Not affiliated with or endorsed by Iron Gate Studio.</p>
    <a href="https://github.com/braidedcable/valheimdraft-webapp" target="_blank" rel="noreferrer">Source on GitHub</a>
  </footer>
</div>

<style>
  :global(html, body, #app) {
    height: 100%;
    margin: 0;
  }
  :global(body) {
    background: #14161a;
    color: #e8e8e8;
    font-family: system-ui, sans-serif;
  }

  .app {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .disclaimer {
    font-size: 0.75rem;
    color: #9a9a9a;
    margin: 0;
  }

  main {
    flex: 1;
    display: flex;
    min-height: 0;
  }

  aside {
    width: 220px;
    border-right: 1px solid #2a2d33;
    overflow-y: auto;
  }

  .viewport-wrap {
    flex: 1;
  }

  .attribution-panel {
    max-width: 640px;
    margin: 0 auto;
    padding: 1.5rem;
  }
  .attribution-panel :global(dt) {
    font-weight: 600;
    margin-top: 1rem;
  }
  .attribution-panel :global(dd) {
    margin: 0.15rem 0 0;
    color: #cfcfcf;
  }

  footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.4rem 1rem;
    border-top: 1px solid #2a2d33;
  }
  footer a {
    color: #8fb4ff;
    font-size: 0.8rem;
  }
</style>

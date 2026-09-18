<script lang="ts">
  import Viewport from './lib/Viewport.svelte';
  import PiecePalette from './lib/PiecePalette.svelte';
  import CostTally from './lib/CostTally.svelte';
  import Attribution from './lib/Attribution.svelte';
  import Toolbar from './lib/Toolbar.svelte';
  import { serialize, deserialize } from './lib/persistence';
  import type { PlacedPiece } from './lib/types';

  const STORAGE_KEY = 'valheimdraft:scene:v1';

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
  let selectedPrefab = $state<string | null>(null);
  let placedPieces = $state<PlacedPiece[]>(restorePieces());

  $effect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, serialize(placedPieces));
    } catch {
      // Storage unavailable (private browsing, quota, disabled) — degrade
      // to in-memory only rather than crashing.
    }
  });
</script>

<div class="app">
  <Toolbar bind:placedPieces bind:showAttribution />

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
        <Viewport bind:selectedPrefab bind:placedPieces />
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

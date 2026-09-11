<script lang="ts">
  import Viewport from './lib/Viewport.svelte';
  import PiecePalette from './lib/PiecePalette.svelte';
  import Attribution from './lib/Attribution.svelte';

  let showAttribution = $state(false);
</script>

<div class="app">
  <header>
    <h1>ValheimDraft</h1>
    <p class="disclaimer">Unofficial fan project. Not affiliated with or endorsed by Iron Gate Studio.</p>
    <button class="link-button" onclick={() => (showAttribution = !showAttribution)}>
      {showAttribution ? 'Back to planner' : 'Attribution'}
    </button>
  </header>

  <main>
    {#if showAttribution}
      <div class="attribution-panel">
        <Attribution />
      </div>
    {:else}
      <aside>
        <PiecePalette />
      </aside>
      <div class="viewport-wrap">
        <Viewport />
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

  header {
    display: flex;
    align-items: baseline;
    gap: 1rem;
    padding: 0.5rem 1rem;
    border-bottom: 1px solid #2a2d33;
  }
  header h1 {
    font-size: 1.1rem;
    margin: 0;
  }
  .disclaimer {
    font-size: 0.75rem;
    color: #9a9a9a;
    margin: 0;
  }
  header .disclaimer {
    flex: 1;
  }

  .link-button {
    background: none;
    border: none;
    color: #8fb4ff;
    cursor: pointer;
    font-size: 0.85rem;
    padding: 0;
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

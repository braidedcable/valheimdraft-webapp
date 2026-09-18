<script lang="ts">
  import type { PlacedPiece } from './types';

  let { placedPieces = $bindable(), showAttribution = $bindable() }: {
    placedPieces: PlacedPiece[];
    showAttribution: boolean;
  } = $props();
</script>

<header>
  <h1>ValheimDraft</h1>
  <p class="disclaimer">Unofficial fan project. Not affiliated with or endorsed by Iron Gate Studio.</p>
  {#if placedPieces.length > 0}
    <button class="link-button" onclick={() => (placedPieces = [])}>
      Clear all ({placedPieces.length})
    </button>
  {/if}
  <button class="link-button" onclick={() => (showAttribution = !showAttribution)}>
    {showAttribution ? 'Back to planner' : 'Attribution'}
  </button>
</header>

<style>
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
</style>

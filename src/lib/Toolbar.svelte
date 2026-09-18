<script lang="ts">
  import type { PlacedPiece } from './types';
  import { serialize, deserialize } from './persistence';

  let { placedPieces = $bindable(), showAttribution = $bindable() }: {
    placedPieces: PlacedPiece[];
    showAttribution: boolean;
  } = $props();

  let importError = $state<string | null>(null);
  let fileInput: HTMLInputElement | undefined = $state();

  function exportLayout() {
    const json = serialize(placedPieces);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `valheimdraft-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function triggerImport() {
    importError = null;
    fileInput?.click();
  }

  async function handleFileSelected(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    // Reset so selecting the same filename again still fires a change event.
    input.value = '';
    if (!file) return;

    const text = await file.text();
    const pieces = deserialize(text);
    if (pieces === null) {
      importError = `"${file.name}" isn't a valid ValheimDraft layout file.`;
      return;
    }

    // Regenerate ids on import: PlacedPiece.id is a UI-only key (see
    // types.ts / Viewport.svelte's crypto.randomUUID() on placement), not
    // part of the layout's meaning. Import currently replaces the whole
    // array so a collision can't happen today, but minting fresh ids keeps
    // that guarantee true if a future "merge/append" import mode reuses
    // this same path alongside existing in-memory pieces.
    placedPieces = pieces.map((piece) => ({ ...piece, id: crypto.randomUUID() }));
    importError = null;
  }
</script>

<header>
  <h1>ValheimDraft</h1>
  <p class="disclaimer">Unofficial fan project. Not affiliated with or endorsed by Iron Gate Studio.</p>
  {#if importError}
    <p class="error">{importError}</p>
  {/if}
  {#if placedPieces.length > 0}
    <button class="link-button" onclick={() => (placedPieces = [])}>
      Clear all ({placedPieces.length})
    </button>
  {/if}
  <button class="link-button" onclick={exportLayout}>Export</button>
  <button class="link-button" onclick={triggerImport}>Import</button>
  <input
    bind:this={fileInput}
    type="file"
    accept=".json,application/json"
    class="visually-hidden"
    onchange={handleFileSelected}
  />
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

  .error {
    font-size: 0.8rem;
    color: #ff8f8f;
    margin: 0;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>

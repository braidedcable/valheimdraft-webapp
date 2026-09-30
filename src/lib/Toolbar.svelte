<script lang="ts">
  import type { PlacedPiece } from './types';
  import { serialize, deserializeScene } from './persistence';
  import { GROUND_STEP, stepGroundLevel } from './scene/ground';
  import ShareDialog from './ShareDialog.svelte';
  import ImportCodeDialog from './ImportCodeDialog.svelte';
  import FeedbackDialog from './FeedbackDialog.svelte';

  let {
    placedPieces = $bindable(),
    showAttribution = $bindable(),
    groundLevel = $bindable(0),
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    sharedLinkError = null,
  }: {
    placedPieces: PlacedPiece[];
    showAttribution: boolean;
    groundLevel?: number;
    canUndo: boolean;
    canRedo: boolean;
    onUndo: () => void;
    onRedo: () => void;
    // Set by App.svelte when a shared link in location.hash failed to
    // decode on startup. Surfaced here so it uses the same error-message
    // convention as importError below, rather than inventing a second one.
    sharedLinkError?: string | null;
  } = $props();

  let importError = $state<string | null>(null);
  let fileInput: HTMLInputElement | undefined = $state();
  let showFeedback = $state(false);
  let showImportCode = $state(false);

  let showShare = $state(false);

  function exportLayout() {
    const json = serialize(placedPieces, groundLevel);
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
    const scene = deserializeScene(text);
    if (scene === null) {
      importError = `"${file.name}" isn't a valid ValheimDraft layout file.`;
      return;
    }

    // Regenerate ids on import: PlacedPiece.id is a UI-only key (see
    // types.ts / Viewport.svelte's crypto.randomUUID() on placement), not
    // part of the layout's meaning. Import currently replaces the whole
    // array so a collision can't happen today, but minting fresh ids keeps
    // that guarantee true if a future "merge/append" import mode reuses
    // this same path alongside existing in-memory pieces.
    placedPieces = scene.pieces.map((piece) => ({ ...piece, id: crypto.randomUUID() }));
    groundLevel = scene.groundLevel;
    importError = null;
  }
</script>

<header>
  <h1>ValheimDraft</h1>
  <p class="disclaimer">Unofficial fan project. Not affiliated with or endorsed by Iron Gate Studio.</p>
  {#if sharedLinkError}
    <p class="error">{sharedLinkError}</p>
  {/if}
  {#if importError}
    <p class="error">{importError}</p>
  {/if}
  <span class="ground-control">
    <span class="ground-readout">Ground: {groundLevel}</span>
    <button class="link-button" aria-label="Lower ground" onclick={() => (groundLevel = stepGroundLevel(groundLevel, -GROUND_STEP))}>−</button>
    <button class="link-button" aria-label="Raise ground" onclick={() => (groundLevel = stepGroundLevel(groundLevel, GROUND_STEP))}>+</button>
    <button class="link-button" onclick={() => (groundLevel = 0)} disabled={groundLevel === 0}>Reset</button>
  </span>
  <button class="link-button" onclick={onUndo} disabled={!canUndo}>Undo</button>
  <button class="link-button" onclick={onRedo} disabled={!canRedo}>Redo</button>
  {#if placedPieces.length > 0}
    <button class="link-button" onclick={() => (placedPieces = [])}>
      Clear all ({placedPieces.length})
    </button>
  {/if}
  <button class="link-button" onclick={exportLayout}>Export</button>
  <button class="link-button" onclick={triggerImport}>Import</button>
  <button class="link-button" onclick={() => (showImportCode = true)}>Import code</button>
  <button class="link-button" onclick={() => (showShare = true)}>Share</button>
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
  <button class="link-button" onclick={() => (showFeedback = true)}>Report bug / suggest feature</button>
</header>

<ImportCodeDialog
  bind:open={showImportCode}
  onLoad={(pieces, level) => {
    placedPieces = pieces;
    groundLevel = level;
  }}
/>
<ShareDialog bind:open={showShare} pieces={placedPieces} {groundLevel} />
<FeedbackDialog bind:open={showFeedback} pieceCount={placedPieces.length} />

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

  .link-button:disabled {
    color: #5a5f68;
    cursor: default;
  }

  .ground-control {
    font-size: 0.85rem;
    display: inline-flex;
    gap: 0.4rem;
    align-items: baseline;
  }

  .ground-readout {
    display: inline-block;
    min-width: 5.5em;
    font-variant-numeric: tabular-nums;
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

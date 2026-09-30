<script lang="ts">
  import { decodeSceneFromInput } from './shareUrl';
  import type { PlacedPiece } from './types';

  let {
    open = $bindable(false),
    onLoad,
  }: {
    open: boolean;
    onLoad: (pieces: PlacedPiece[], groundLevel: number) => void;
  } = $props();

  let dialogEl: HTMLDialogElement | undefined = $state();
  let text = $state('');
  let error = $state<string | null>(null);

  $effect(() => {
    if (!dialogEl) return;
    if (open && !dialogEl.open) dialogEl.showModal();
    else if (!open && dialogEl.open) dialogEl.close();
  });

  function handleClose() {
    open = false;
    text = '';
    error = null;
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === dialogEl) dialogEl?.close();
  }

  async function load(event: SubmitEvent) {
    event.preventDefault();
    const scene = await decodeSceneFromInput(text);
    if (!scene) {
      error = "That doesn't look like a valid build code or share link.";
      return;
    }
    onLoad(scene.pieces, scene.groundLevel);
    dialogEl?.close();
  }
</script>

<dialog bind:this={dialogEl} onclose={handleClose} onclick={handleBackdropClick} class="import-dialog">
  <form class="body" onsubmit={load}>
    <h2>Import build code</h2>
    <p class="hint">Paste a build code (or a share link) from the Share dialog. This replaces your current build; Undo brings it back.</p>
    <textarea rows="7" bind:value={text} oninput={() => (error = null)} placeholder="Paste build code here…" aria-label="Paste build code"></textarea>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <div class="actions">
      <button type="button" class="link-button" onclick={() => dialogEl?.close()}>Cancel</button>
      <button type="submit" class="primary" disabled={!text.trim()}>Load build</button>
    </div>
  </form>
</dialog>

<style>
  .import-dialog {
    background: #1c1f25;
    color: #e8e8e8;
    border: 1px solid #2a2d33;
    border-radius: 8px;
    padding: 0;
    width: min(480px, calc(100vw - 2rem));
  }
  .import-dialog::backdrop {
    background: rgba(0, 0, 0, 0.55);
  }
  .body {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1.25rem;
  }
  h2 {
    margin: 0;
    font-size: 1.05rem;
  }
  .hint {
    margin: 0;
    font-size: 0.8rem;
    color: #9a9a9a;
  }
  .error {
    margin: 0;
    font-size: 0.85rem;
    color: #ff8a8a;
  }
  textarea {
    background: #14161a;
    color: #e8e8e8;
    border: 1px solid #2a2d33;
    border-radius: 4px;
    padding: 0.5rem;
    font: 0.75rem monospace;
    width: 100%;
    box-sizing: border-box;
    resize: vertical;
    word-break: break-all;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
  }
  .primary {
    background: #3a6ff0;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 0.45rem 0.9rem;
    cursor: pointer;
    font-size: 0.85rem;
  }
  .primary:disabled {
    opacity: 0.5;
    cursor: default;
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

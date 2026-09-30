<script lang="ts">
  import { encodeSceneToCode, MAX_HASH_LENGTH, buildShareUrl } from './shareUrl';
  import type { PlacedPiece } from './types';

  let {
    open = $bindable(false),
    pieces,
    groundLevel = undefined,
  }: {
    open: boolean;
    pieces: PlacedPiece[];
    groundLevel?: number;
  } = $props();

  let dialogEl: HTMLDialogElement | undefined = $state();
  let inputEl: HTMLInputElement | undefined = $state();
  let url = $state('');
  let code = $state('');
  let urlTooLong = $state(false);
  let codeEl: HTMLTextAreaElement | undefined = $state();
  let copiedWhat = $state<'link' | 'code' | null>(null);
  let error = $state<string | null>(null);
  let loading = $state(false);
  let copyFailed = $state(false);
  let copyTimer: ReturnType<typeof setTimeout> | undefined;
  let requestId = 0;

  $effect(() => {
    if (!dialogEl) return;
    if (open && !dialogEl.open) {
      dialogEl.showModal();
    } else if (!open && dialogEl.open) {
      dialogEl.close();
    }
  });

  // Re-encode whenever the dialog opens. Only `open` is tracked here;
  // generate() reads pieces untracked so edits behind the modal don't thrash.
  $effect(() => {
    if (open) {
      void generate();
    }
  });

  async function generate() {
    const id = ++requestId;
    url = '';
    code = '';
    urlTooLong = false;
    error = null;
    copiedWhat = null;
    copyFailed = false;
    const snapshot = pieces;
    if (snapshot.length === 0) return;
    loading = true;
    try {
      const encoded = await encodeSceneToCode(snapshot, groundLevel ?? 0);
      if (id !== requestId) return;
      code = encoded;
      // Long builds can't reliably fit in a URL; the code always works.
      urlTooLong = encoded.length > MAX_HASH_LENGTH;
      url = urlTooLong ? '' : buildShareUrl(location, encoded);
    } catch (err) {
      if (id !== requestId) return;
      error =
        err instanceof Error && err.message
          ? err.message
          : 'Could not create a share link. Try Export instead.';
    } finally {
      if (id === requestId) loading = false;
    }
  }

  function selectAll() {
    inputEl?.select();
  }

  async function copy(what: 'link' | 'code') {
    const text = what === 'link' ? url : code;
    if (!text) return;
    copyFailed = false;
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      (what === 'link' ? inputEl : codeEl)?.select();
      try {
        ok = document.execCommand('copy');
      } catch {
        ok = false;
      }
    }
    if (ok) {
      copiedWhat = what;
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => (copiedWhat = null), 2000);
    } else {
      copyFailed = true;
      (what === 'link' ? inputEl : codeEl)?.select();
    }
  }

  function handleClose() {
    open = false;
    requestId++;
    clearTimeout(copyTimer);
    url = '';
    code = '';
    urlTooLong = false;
    error = null;
    loading = false;
    copiedWhat = null;
    copyFailed = false;
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === dialogEl) {
      dialogEl?.close();
    }
  }
</script>

<dialog bind:this={dialogEl} onclose={handleClose} onclick={handleBackdropClick} class="share-dialog">
  <div class="body">
    <h2>Share this build</h2>

    {#if pieces.length === 0}
      <p class="hint">There's nothing to share yet. Place some pieces first.</p>
    {:else if error}
      <p class="error" role="alert">{error}</p>
      <p class="hint">You can use Export to save your build as a file instead.</p>
    {:else if loading || !code}
      <p class="hint">Creating link…</p>
    {:else}
      <p class="hint">
        {pieces.length} piece{pieces.length === 1 ? '' : 's'}
      </p>
      {#if url}
        <label class="field">
          Link
          <input
            bind:this={inputEl}
            type="text"
            readonly
            value={url}
            aria-label="Share link"
            onfocus={selectAll}
            onclick={selectAll}
          />
        </label>
        <button type="button" class="primary small" onclick={() => copy('link')}>
          {copiedWhat === 'link' ? 'Copied!' : 'Copy link'}
        </button>
      {:else if urlTooLong}
        <p class="hint">This build is too large for a link — use the build code below instead.</p>
      {/if}
      <label class="field">
        Build code <span class="hint">({code.length.toLocaleString()} characters — paste it via Import code)</span>
        <textarea
          bind:this={codeEl}
          readonly
          rows="5"
          value={code}
          aria-label="Build code"
          onfocus={(e) => e.currentTarget.select()}
          onclick={(e) => e.currentTarget.select()}
        ></textarea>
      </label>
      <button type="button" class="primary small" onclick={() => copy('code')}>
        {copiedWhat === 'code' ? 'Copied!' : 'Copy code'}
      </button>
      {#if copyFailed}
        <p class="error">Couldn't copy automatically. The text is selected; press Ctrl+C.</p>
      {/if}
    {/if}

    <div class="actions">
      <button type="button" class="link-button" onclick={() => dialogEl?.close()}>Close</button>
    </div>
  </div>
</dialog>

<style>
  .share-dialog {
    background: #1c1f25;
    color: #e8e8e8;
    border: 1px solid #2a2d33;
    border-radius: 8px;
    padding: 0;
    width: min(480px, calc(100vw - 2rem));
  }
  .share-dialog::backdrop {
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
  input[type='text'] {
    background: #14161a;
    color: #e8e8e8;
    border: 1px solid #2a2d33;
    border-radius: 4px;
    padding: 0.5rem;
    font: inherit;
    font-size: 0.8rem;
    width: 100%;
    box-sizing: border-box;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.85rem;
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
  .primary.small {
    align-self: flex-start;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    margin-top: 0.25rem;
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

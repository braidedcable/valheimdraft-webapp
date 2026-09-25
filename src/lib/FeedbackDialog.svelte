<script lang="ts">
  import { buildIssueUrl, type FeedbackType } from './feedbackUrl';

  let {
    open = $bindable(false),
    pieceCount,
  }: {
    open: boolean;
    pieceCount: number;
  } = $props();

  let dialogEl: HTMLDialogElement | undefined = $state();
  let type = $state<FeedbackType>('bug');
  let title = $state('');
  let description = $state('');

  // The native <dialog> element owns its own open/closed state (showModal()
  // / close()), which doesn't automatically track a Svelte prop. This
  // effect is the one place that reconciles the two: whenever `open`
  // changes, push it onto the element; the reverse direction (element ->
  // prop) happens in handleClose below, via the dialog's native 'close'
  // event (fired on Escape, backdrop click via the click handler below, or
  // our own .close() calls).
  $effect(() => {
    if (!dialogEl) return;
    if (open && !dialogEl.open) {
      dialogEl.showModal();
    } else if (!open && dialogEl.open) {
      dialogEl.close();
    }
  });

  function handleClose() {
    open = false;
    // Clear the form on every close (Cancel, Escape, backdrop, or a
    // successful submit) so reopening the dialog never shows a stale draft
    // from a previous report.
    type = 'bug';
    title = '';
    description = '';
  }

  function handleBackdropClick(event: MouseEvent) {
    // <dialog> has no built-in "click outside to close" — a click that
    // lands on the dialog element itself (not something inside the <form>)
    // is on the backdrop, since the form doesn't fill the dialog's padding.
    if (event.target === dialogEl) {
      dialogEl?.close();
    }
  }

  function submit(event: SubmitEvent) {
    event.preventDefault();
    const url = buildIssueUrl(type, title.trim(), description.trim(), {
      pageUrl: location.href,
      userAgent: navigator.userAgent,
      pieceCount,
    });
    window.open(url, '_blank', 'noopener,noreferrer');
    dialogEl?.close();
  }
</script>

<dialog bind:this={dialogEl} onclose={handleClose} onclick={handleBackdropClick} class="feedback-dialog">
  <form onsubmit={submit}>
    <h2>Report a bug or suggest a feature</h2>
    <p class="hint">
      This opens a prefilled issue on <strong>GitHub</strong> in a new tab — you'll need a GitHub
      account to submit it there.
    </p>

    <fieldset class="type-toggle">
      <legend class="visually-hidden">Report type</legend>
      <label><input type="radio" bind:group={type} value="bug" /> Bug</label>
      <label><input type="radio" bind:group={type} value="feature" /> Feature request</label>
    </fieldset>

    <label class="field">
      Title
      <input
        type="text"
        bind:value={title}
        required
        maxlength="200"
        placeholder={type === 'bug' ? 'Pieces disappear after undo' : 'Add a grid snap toggle'}
      />
    </label>

    <label class="field">
      {type === 'bug' ? 'Steps to reproduce, and expected vs. actual behavior' : 'What would you like to see, and why?'}
      <textarea
        bind:value={description}
        required
        rows="6"
        placeholder={type === 'bug'
          ? '1. ...\n2. ...\nExpected: ...\nActual: ...'
          : 'Describe the feature and the problem it would solve.'}
      ></textarea>
    </label>

    {#if type === 'bug'}
      <p class="hint">The current page URL, piece count, and browser info are added automatically.</p>
    {/if}

    <div class="actions">
      <button type="button" class="link-button" onclick={() => dialogEl?.close()}>Cancel</button>
      <button type="submit">Open on GitHub</button>
    </div>
  </form>
</dialog>

<style>
  .feedback-dialog {
    background: #1c1f25;
    color: #e8e8e8;
    border: 1px solid #2a2d33;
    border-radius: 8px;
    padding: 0;
    width: min(480px, calc(100vw - 2rem));
  }
  .feedback-dialog::backdrop {
    background: rgba(0, 0, 0, 0.55);
  }

  form {
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

  .type-toggle {
    display: flex;
    gap: 1rem;
    border: none;
    padding: 0;
    margin: 0;
    font-size: 0.9rem;
  }
  .type-toggle label {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    cursor: pointer;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    font-size: 0.85rem;
  }

  input[type='text'],
  textarea {
    background: #14161a;
    color: #e8e8e8;
    border: 1px solid #2a2d33;
    border-radius: 4px;
    padding: 0.5rem;
    font: inherit;
    resize: vertical;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    margin-top: 0.25rem;
  }

  .actions button[type='submit'] {
    background: #3a6ff0;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 0.45rem 0.9rem;
    cursor: pointer;
    font-size: 0.85rem;
  }

  .link-button {
    background: none;
    border: none;
    color: #8fb4ff;
    cursor: pointer;
    font-size: 0.85rem;
    padding: 0;
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

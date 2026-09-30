<script lang="ts">
  import piecesData from '../data/pieces.json';
  import { displayItemName } from './catalog/itemNames';

  let {
    recent,
    selectedPrefab = $bindable(null),
    onClear,
  }: { recent: string[]; selectedPrefab: string | null; onClear?: () => void } = $props();

  const byPrefab = new Map(piecesData.pieces.map((p) => [p.prefab, p]));
  const rows = $derived(recent.map((id) => byPrefab.get(id)).filter((p) => p !== undefined));

  function select(prefab: string) {
    selectedPrefab = selectedPrefab === prefab ? null : prefab;
  }
</script>

<div class="recent">
  <div class="header">
    <span>Recently used</span>
    {#if rows.length > 0}
      <button class="clear" onclick={() => onClear?.()}>Clear</button>
    {/if}
  </div>
  {#if rows.length === 0}
    <p class="empty">Pieces you place will show up here.</p>
  {:else}
    <ul>
      {#each rows as piece (piece.prefab)}
        <li>
          <button class="row" class:selected={selectedPrefab === piece.prefab} onclick={() => select(piece.prefab)}>
            <span class="label">{piece.label}</span>
            <span class="cost">
              {#each piece.cost as c, i}{i > 0 ? ', ' : ''}{c.amount} {displayItemName(c.item)}{/each}
            </span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .recent {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.4rem 0.5rem;
    font-size: 0.85rem;
    font-weight: 600;
    color: #cfcfcf;
    border-bottom: 1px solid #2a2d33;
  }
  .clear {
    all: unset;
    font-size: 0.75rem;
    font-weight: 400;
    color: #8fb4ff;
    cursor: pointer;
  }
  .clear:hover {
    text-decoration: underline;
  }
  .empty {
    margin: 0;
    padding: 0.6rem 0.5rem;
    font-size: 0.8rem;
    color: #8a8d93;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li {
    border-top: 1px solid #24262b;
  }
  li:first-child {
    border-top: none;
  }
  .row {
    all: unset;
    box-sizing: border-box;
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    width: 100%;
    padding: 0.35rem 0.5rem;
    font-size: 0.85rem;
    cursor: pointer;
  }
  .row:hover {
    background: #1e2126;
  }
  .row.selected {
    background: #2a3f5f;
  }
  .cost {
    color: #9a9a9a;
    text-align: right;
  }
</style>

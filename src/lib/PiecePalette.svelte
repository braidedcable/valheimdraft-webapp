<script lang="ts">
  import piecesData from '../data/pieces.json';

  let { selectedPrefab = $bindable(null) }: { selectedPrefab: string | null } = $props();

  function select(prefab: string) {
    selectedPrefab = selectedPrefab === prefab ? null : prefab;
  }
</script>

<ul class="palette">
  {#each piecesData.pieces as piece (piece.prefab)}
    <li>
      <button
        class:selected={selectedPrefab === piece.prefab}
        onclick={() => select(piece.prefab)}
      >
        <span class="label">{piece.label}</span>
        <span class="cost">
          {#each piece.cost as c, i}{i > 0 ? ', ' : ''}{c.amount} {c.item}{/each}
        </span>
      </button>
    </li>
  {/each}
</ul>

<style>
  .palette {
    list-style: none;
    margin: 0;
    padding: 0;
    overflow-y: auto;
  }
  .palette li {
    border-bottom: 1px solid #2a2d33;
  }
  .palette button {
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
  .palette button:hover {
    background: #1e2126;
  }
  .palette button.selected {
    background: #2a3f5f;
  }
  .cost {
    color: #9a9a9a;
    white-space: nowrap;
  }
</style>

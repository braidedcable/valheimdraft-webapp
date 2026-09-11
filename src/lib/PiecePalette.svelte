<script lang="ts">
  import piecesData from '../data/pieces.json';
</script>

<!--
  Read-only listing for now — click-to-select/place is part of the
  placement UX work, not built yet. This just confirms pieces.json's real
  data (costs, shapes) is flowing into the UI.
-->
<ul class="palette">
  {#each piecesData.pieces as piece (piece.prefab)}
    <li>
      <span class="label">{piece.label}</span>
      <span class="cost">
        {#each piece.cost as c, i}{i > 0 ? ', ' : ''}{c.amount} {c.item}{/each}
      </span>
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
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.35rem 0.5rem;
    font-size: 0.85rem;
    border-bottom: 1px solid #2a2d33;
  }
  .cost {
    color: #9a9a9a;
    white-space: nowrap;
  }
</style>

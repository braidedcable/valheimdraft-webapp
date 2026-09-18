<script lang="ts">
  import { getPieceData } from './scene/snapping';
  import type { PlacedPiece } from './types';

  let { placedPieces }: { placedPieces: PlacedPiece[] } = $props();

  const totals = $derived.by(() => {
    const byItem = new Map<string, number>();
    for (const placed of placedPieces) {
      const piece = getPieceData(placed.prefab);
      if (!piece) continue;
      for (const c of piece.cost) {
        byItem.set(c.item, (byItem.get(c.item) ?? 0) + c.amount);
      }
    }
    return [...byItem.entries()].map(([item, amount]) => ({ item, amount }));
  });
</script>

<div class="cost-tally">
  <h2>Materials</h2>
  {#if totals.length === 0}
    <p class="empty">No pieces placed yet.</p>
  {:else}
    <ul>
      {#each totals as t (t.item)}
        <li><span class="amount">{t.amount}</span> {t.item}</li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .cost-tally {
    padding: 0.5rem;
    border-top: 1px solid #2a2d33;
  }
  .cost-tally h2 {
    font-size: 0.85rem;
    margin: 0 0 0.4rem;
    color: #e8e8e8;
  }
  .empty {
    font-size: 0.8rem;
    color: #9a9a9a;
    margin: 0;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }
  li {
    font-size: 0.85rem;
    color: #cfcfcf;
  }
  .amount {
    color: #8fb4ff;
    font-weight: 600;
  }
</style>

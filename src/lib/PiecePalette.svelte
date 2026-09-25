<script lang="ts">
  import piecesData from '../data/pieces.json';
  import { familyLabel } from './catalog/familyLabels';
  import { displayItemName } from './catalog/itemNames';

  let { selectedPrefab = $bindable(null) }: { selectedPrefab: string | null } = $props();

  let query = $state('');

  const STORAGE_KEY = 'valheimdraft.paletteOpenGroups';

  function loadOpenGroups(): Set<string> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return new Set(JSON.parse(raw));
    } catch {
      // private browsing / storage disabled — fall through to "none open"
    }
    return new Set();
  }

  function saveOpenGroups(groups: Set<string>) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...groups]));
    } catch {
      // best-effort only
    }
  }

  let openGroups = $state(loadOpenGroups());

  function handleToggle(family: string, event: Event) {
    const open = (event.currentTarget as HTMLDetailsElement).open;
    if (open) openGroups.add(family);
    else openGroups.delete(family);
    openGroups = new Set(openGroups);
    saveOpenGroups(openGroups);
  }

  // pieces.json is already sorted by family (in in-game menu order) by the
  // generator, so grouping by first-seen order here reproduces that same
  // group order without duplicating it at runtime.
  const groups = $derived.by(() => {
    const byFamily = new Map<string, (typeof piecesData.pieces)[number][]>();
    for (const piece of piecesData.pieces) {
      if (!byFamily.has(piece.family)) byFamily.set(piece.family, []);
      byFamily.get(piece.family)!.push(piece);
    }
    return [...byFamily.entries()].map(([family, pieces]) => ({ family, pieces }));
  });

  const trimmedQuery = $derived(query.trim().toLowerCase());

  const filteredGroups = $derived.by(() =>
    groups
      .map((g) => ({
        family: g.family,
        matched: trimmedQuery
          ? g.pieces.filter(
              (p) => p.label.toLowerCase().includes(trimmedQuery) || p.prefab.toLowerCase().includes(trimmedQuery)
            )
          : g.pieces,
      }))
      .filter((g) => g.matched.length > 0)
  );

  function select(prefab: string) {
    selectedPrefab = selectedPrefab === prefab ? null : prefab;
  }
</script>

<div class="palette">
  <input class="search" type="text" placeholder="Search pieces…" bind:value={query} />
  <div class="groups">
    {#each filteredGroups as g (g.family)}
      <details open={trimmedQuery ? true : openGroups.has(g.family)} ontoggle={(e) => handleToggle(g.family, e)}>
        <summary>
          <span>{familyLabel(g.family)}</span>
          <span class="count">{g.matched.length}</span>
        </summary>
        <ul>
          {#each g.matched as piece (piece.prefab)}
            <li>
              <button class:selected={selectedPrefab === piece.prefab} onclick={() => select(piece.prefab)}>
                <span class="label">{piece.label}</span>
                <span class="cost">
                  {#each piece.cost as c, i}{i > 0 ? ', ' : ''}{c.amount} {displayItemName(c.item)}{/each}
                </span>
              </button>
            </li>
          {/each}
        </ul>
      </details>
    {/each}
  </div>
</div>

<style>
  .palette {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }
  .search {
    margin: 0.4rem 0.5rem;
    padding: 0.3rem 0.5rem;
    font-size: 0.85rem;
    background: #1e2126;
    border: 1px solid #2a2d33;
    color: #e8e8e8;
    border-radius: 3px;
  }
  .groups {
    overflow-y: auto;
    flex: 1;
    min-height: 0;
  }
  details {
    border-bottom: 1px solid #2a2d33;
  }
  summary {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.35rem 0.5rem;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    color: #cfcfcf;
    user-select: none;
  }
  .count {
    font-weight: 400;
    color: #8a8d93;
    font-size: 0.75rem;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li {
    border-top: 1px solid #24262b;
  }
  button {
    all: unset;
    box-sizing: border-box;
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    width: 100%;
    padding: 0.35rem 0.5rem 0.35rem 0.9rem;
    font-size: 0.85rem;
    cursor: pointer;
  }
  button:hover {
    background: #1e2126;
  }
  button.selected {
    background: #2a3f5f;
  }
  .cost {
    color: #9a9a9a;
    white-space: nowrap;
  }
</style>

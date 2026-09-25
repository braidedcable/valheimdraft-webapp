// Display names for palette group headers. Falls back to a humanized
// version of the family key for any family not listed here yet (new
// families land here as later catalog batches are reviewed and shipped).
const FAMILY_LABELS: Record<string, string> = {
  wood: 'Wood',
  core_wood: 'Core wood',
  woodiron: 'Wood-iron',
  darkwood: 'Darkwood',
  stone: 'Stone',
  iron: 'Iron',
  ashwood: 'Ashwood',
  grausten: 'Grausten',
  flametal: 'Flametal',
  blackmarble: 'Black marble',
  timberwood: 'Timberwood',
  scalewood: 'Scalewood',
  dvergr: 'Dvergr',
  misc: 'Misc',
};

export function familyLabel(family: string): string {
  return FAMILY_LABELS[family] ?? family.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

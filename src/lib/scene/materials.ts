// Flat per-material-family colors, per the art strategy in the plan doc.
// Only "wood" is used by the current MVP piece set; other families are
// placeholders for when the catalog grows past wood tier.
export const MATERIAL_FAMILY_COLORS: Record<string, number> = {
  wood: 0xb08a5c,
  core_wood: 0x8a6a45,
  darkwood: 0x4b3526,
  woodiron: 0x7a6a58,
  stone: 0x9a9a9a,
  iron: 0x6b6f76,
  thatch: 0xcdbb7a,
  ashwood: 0xcfc7ac,
  grausten: 0xa39c8c,
  flametal: 0x5c2a1f,
  blackmarble: 0x45454c,
  timberwood: 0xc9963f,
  scalewood: 0x6f8a6b,
  dvergr: 0x5b5a6e,
  misc: 0x8f8878,
};

export function colorForFamily(family: string): number {
  return MATERIAL_FAMILY_COLORS[family] ?? 0xff00ff; // magenta = "missing mapping", loud on purpose
}

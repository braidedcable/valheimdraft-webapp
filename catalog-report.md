# Catalog report

## Summary

| Batch | Verdict | Count |
|---|---|---|
| 0 | EXCLUDE | 3 |
| 1 | CLEAN | 86 |
| 2 | CLEAN | 48 |
| 2 | NEEDS_NEW_SHAPE | 14 |
| 2 | SUSPICIOUS | 1 |
| 2 | REVIEW | 10 |
| 3 | CLEAN | 40 |
| 3 | NEEDS_NEW_SHAPE | 1 |
| 3 | SUSPICIOUS | 3 |
| 3 | REVIEW | 1 |

## Batch 0 (shipped)

| Prefab | Label | Family | Shape | Verdict | Reason |
|---|---|---|---|---|---|
| darkwood_raven | Raven Adornment | darkwood | — | EXCLUDE | adornment, hangs off a wall rather than standing on the snap grid |
| darkwood_wolf | Wolf Adornment | darkwood | — | EXCLUDE | adornment, hangs off a wall rather than standing on the snap grid |
| wood_dragon1 | Wood Dragon Adornment | wood | — | EXCLUDE | adornment, hangs off a wall rather than standing on the snap grid |

## Batch 1 (shipped)

| Prefab | Label | Family | Shape | Verdict | Reason |
|---|---|---|---|---|---|
| darkwood_arch | Darkwood Arch | darkwood | arch | CLEAN | see stone_arch |
| darkwood_beam | Darkwood Beam 2 m | darkwood | box | CLEAN | 2 snap points on one axis |
| darkwood_beam_26 | Darkwood Beam 26° | darkwood | beam | CLEAN | snap-derived: 2 diagonal snap points |
| darkwood_beam_45 | Darkwood Beam 45° | darkwood | beam | CLEAN | snap-derived: 2 diagonal snap points |
| darkwood_beam_67 | Darkwood Beam 67° | darkwood | beam | CLEAN | snap-derived: 2 diagonal snap points |
| darkwood_beam4x4 | Darkwood Beam 4 m | darkwood | box | CLEAN | 2 snap points on one axis |
| darkwood_decowall | Carved Darkwood Divider | darkwood | box | CLEAN | 4 corners, height split 2/2 but no depth correlation — plain wall, not a slope |
| darkwood_gate | Darkwood Gate | darkwood | door | CLEAN | manual shape override |
| darkwood_pole | Darkwood Pole 2m | darkwood | cylinder | CLEAN | 2 vertical snap points, round cross-section |
| darkwood_pole4 | Darkwood Pole 4m | darkwood | cylinder | CLEAN | 2 vertical snap points, round cross-section |
| darkwood_roof | Shingle Roof 26° | darkwood | wedge | CLEAN | 4 corners, height split 2/2, depth-correlated — sloped panel |
| darkwood_roof_45 | Shingle Roof 45° | darkwood | wedge | CLEAN | 4 corners, height split 2/2, depth-correlated — sloped panel |
| darkwood_roof_67 | Shingle Roof 67° | darkwood | wedge | CLEAN | 4 corners, height split 2/2, depth-correlated — sloped panel |
| darkwood_roof_icorner | Shingle Roof Inner Corner 26° | darkwood | valley | CLEAN | 4 corners, height split 3/1 (odd corner C low) |
| darkwood_roof_icorner_45 | Shingle Roof Inner Corner 45° | darkwood | valley | CLEAN | 4 corners, height split 3/1 (odd corner C low) |
| darkwood_roof_icorner_67 | Shingle Roof Inner Corner 67° | darkwood | valley | CLEAN | 4 corners, height split 3/1 (odd corner C low) |
| darkwood_roof_ocorner | Shingle Roof Outer Corner 26° | darkwood | hip | CLEAN | 4 corners, height split 3/1 (odd corner A high) |
| darkwood_roof_ocorner_45 | Shingle Roof Outer Corner 45° | darkwood | hip | CLEAN | 4 corners, height split 3/1 (odd corner A high) |
| darkwood_roof_ocorner_67 | Shingle Roof Outer Corner 67° | darkwood | hip | CLEAN | 4 corners, height split 3/1 (odd corner A high) |
| darkwood_roof_top | Shingle Roof Ridge 26° | darkwood | ridge | CLEAN | snap-derived: 6 snap points (4 eave + 2 ridge) |
| darkwood_roof_top_45 | Shingle Roof Ridge 45° | darkwood | ridge | CLEAN | snap-derived: 6 snap points (4 eave + 2 ridge) |
| darkwood_roof_top_67 | Shingle Roof Ridge 67° | darkwood | ridge | CLEAN | snap-derived: 6 snap points (4 eave + 2 ridge) |
| iron_floor_1x1_v2 | Cage Floor 1x1 | iron | lattice | CLEAN | a cage floor reads as a solid box otherwise; grid bars approximate the see-through cage look |
| iron_floor_2x2 | Cage Floor 2x2 | iron | lattice | CLEAN | see iron_floor_1x1_v2 |
| iron_grate | Iron Gate | iron | lattice | CLEAN | in-game name is 'Iron Gate', not a floor grate — a functional piece, vertical bars only (portcullis-style) |
| iron_wall_1x1 | Cage Wall 1x1 | iron | lattice | CLEAN | see iron_floor_1x1_v2 |
| iron_wall_2x2 | Cage Wall 2x2 | iron | lattice | CLEAN | see iron_floor_1x1_v2 |
| stone_arch | Stone Arch | stone | arch | CLEAN | functional archway; classify() can't tell an archway from a flat panel by snap-point count alone |
| stone_floor_2x2 | Stone Floor 2x2 | stone | box | CLEAN | 8 corner snap points — full box |
| stone_pillar | Stone Pillar | stone | box | CLEAN | 8 corner snap points — full box |
| stone_stair | Stone Stair | stone | stairs | CLEAN | functional piece (stair) — using the existing stairs shape |
| stone_wall_1x1 | Stone Wall 1x1 | stone | box | CLEAN | 8 corner snap points — full box |
| stone_wall_2x1 | Stone Wall 2x1 | stone | box | CLEAN | 8 corner snap points — full box |
| stone_wall_4x2 | Stone Wall 4x2 | stone | box | CLEAN | 8 corner snap points — full box |
| wood_beam | Wood Beam 2 m | wood | box | CLEAN | pinned (existing MVP piece, unchanged) |
| wood_beam_1 | Wood Beam 1 m | wood | box | CLEAN | 2 snap points on one axis |
| wood_beam_26 | Wood Beam 26° | wood | beam | CLEAN | snap-derived: 2 diagonal snap points |
| wood_beam_45 | Wood Beam 45° | wood | beam | CLEAN | snap-derived: 2 diagonal snap points |
| wood_beam_67 | Wood Beam 67° | wood | beam | CLEAN | snap-derived: 2 diagonal snap points |
| wood_door | Wood Door | wood | box | CLEAN | pinned (existing MVP piece, unchanged) |
| wood_fence | Roundpole Fence | wood | fence | CLEAN | pinned (existing MVP piece, unchanged) |
| wood_fence_gate | Roundpole Gate | wood | fence | CLEAN | bounds cover only the hinge post (0.12m vs ~2m of snap extent), same sub-mesh-bounds issue as wood_gate; using the snap-point box instead |
| wood_floor | Wood Floor 2x2 | wood | box | CLEAN | pinned (existing MVP piece, unchanged) |
| wood_floor_1x1 | Wood Floor 1x1 | wood | box | CLEAN | pinned (existing MVP piece, unchanged) |
| wood_gate | Wood Gate | wood | box | CLEAN | pinned (existing MVP piece, unchanged) |
| wood_log_26 | Log Beam 26° | core_wood | beam | CLEAN | snap-derived: 2 diagonal snap points |
| wood_log_45 | Log Beam 45° | core_wood | beam | CLEAN | snap-derived: 2 diagonal snap points |
| wood_log_67 | Log Beam 67° | core_wood | beam | CLEAN | snap-derived: 2 diagonal snap points |
| wood_pole | Wood Pole 1 m | wood | cylinder | CLEAN | pinned (existing MVP piece, unchanged) |
| wood_pole_log | Log Pole 2 m | core_wood | cylinder | CLEAN | 2 vertical snap points, round cross-section |
| wood_pole_log_4 | Log Pole 4 m | core_wood | cylinder | CLEAN | 2 vertical snap points, round cross-section |
| wood_pole2 | Wood Pole 2 m | wood | cylinder | CLEAN | pinned (existing MVP piece, unchanged) |
| wood_roof | Thatch Roof 26° | wood | wedge | CLEAN | pinned (existing MVP piece, unchanged) |
| wood_roof_45 | Thatch Roof 45° | wood | wedge | CLEAN | 4 corners, height split 2/2, depth-correlated — sloped panel |
| wood_roof_67 | Thatch Roof 67° | wood | wedge | CLEAN | 4 corners, height split 2/2, depth-correlated — sloped panel |
| wood_roof_icorner | Thatch Roof Inner Corner 26° | wood | valley | CLEAN | pinned (existing MVP piece, unchanged) |
| wood_roof_icorner_45 | Thatch Roof Inner Corner 45° | wood | valley | CLEAN | 4 corners, height split 3/1 (odd corner C low) |
| wood_roof_icorner_67 | Thatch Roof Inner Corner 67° | wood | valley | CLEAN | 4 corners, height split 3/1 (odd corner C low) |
| wood_roof_ocorner | Thatch Roof Outer Corner 26° | wood | hip | CLEAN | pinned (existing MVP piece, unchanged) |
| wood_roof_ocorner_45 | Thatch Roof Outer Corner 45° | wood | hip | CLEAN | 4 corners, height split 3/1 (odd corner A high) |
| wood_roof_ocorner_67 | Thatch Roof Outer Corner 67° | wood | hip | CLEAN | 4 corners, height split 3/1 (odd corner A high) |
| wood_roof_top | Thatch Roof Ridge 26° | wood | wedge | CLEAN | pinned (existing MVP piece, unchanged) |
| wood_roof_top_45 | Thatch Roof Ridge 45° | wood | ridge | CLEAN | snap-derived: 6 snap points (4 eave + 2 ridge) |
| wood_roof_top_67 | Thatch Roof Ridge 67° | wood | ridge | CLEAN | snap-derived: 6 snap points (4 eave + 2 ridge) |
| wood_stair | Wood Stairs | wood | stairs | CLEAN | pinned (existing MVP piece, unchanged) |
| wood_stepladder | Wood Ladder | wood | ladder | CLEAN | pinned (existing MVP piece, unchanged) |
| wood_wall_half | Wood Wall Half | wood | box | CLEAN | pinned (existing MVP piece, unchanged) |
| wood_wall_log | Log Beam 2 m | wood | box | CLEAN | pinned (existing MVP piece, unchanged) |
| wood_wall_log_4x0.5 | Log Beam 4 m | core_wood | box | CLEAN | 4 corners, height split 2/2 but no depth correlation — plain wall, not a slope |
| wood_wall_quarter | Wood Wall 1x1 | wood | box | CLEAN | pinned (existing MVP piece, unchanged) |
| wood_wall_roof_45 | Wood Wall 45° | wood | triangle | CLEAN | snap-derived: 3 snap points (gable triangle) |
| wood_wall_roof_45_upsidedown | Wood Wall 45° (Inverted) | wood | triangle | CLEAN | snap-derived: 3 snap points (gable triangle) |
| wood_wall_roof_67_a | Wood Wall 67° | wood | triangle | CLEAN | snap-derived: 3 snap points (gable triangle) |
| wood_wall_roof_67_upsidedown | Wood Wall 67° (Inverted) | wood | triangle | CLEAN | snap-derived: 3 snap points (gable triangle) |
| wood_wall_roof_a | Wood Wall 26° | wood | triangle | CLEAN | snap-derived: 3 snap points (gable triangle) |
| wood_wall_roof_top | Wood Roof Cross 26° | wood | cross | CLEAN | snap-derived: 5 snap points (4 corners + center) — X truss |
| wood_wall_roof_top_45 | Wood Roof Cross 45° | wood | cross | CLEAN | snap-derived: 5 snap points (4 corners + center) — X truss |
| wood_wall_roof_top_67 | Wood Roof Cross 67° | wood | cross | CLEAN | snap-derived: 5 snap points (4 corners + center) — X truss |
| wood_wall_roof_upsidedown | Wood Wall 26° (Inverted) | wood | triangle | CLEAN | snap-derived: 3 snap points (gable triangle) |
| wood_window | Wood Shutter | wood | box | CLEAN | pinned (existing MVP piece, unchanged) |
| woodiron_beam | Wood Iron Beam | woodiron | box | CLEAN | 2 snap points on one axis |
| woodiron_beam_26 | Wood Iron Beam 26° | woodiron | beam | CLEAN | snap-derived: 2 diagonal snap points |
| woodiron_beam_45 | Wood Iron Beam 45° | woodiron | beam | CLEAN | snap-derived: 2 diagonal snap points |
| woodiron_beam_67 | Wood Iron Beam 67° | woodiron | beam | CLEAN | snap-derived: 2 diagonal snap points |
| woodiron_pole | Wood Iron Pole | woodiron | box | CLEAN | 2 snap points on one axis |
| woodwall | Wood Wall | wood | box | CLEAN | 4 corners, height split 2/2 but no depth correlation — plain wall, not a slope |

## Batch 2

| Prefab | Label | Family | Shape | Verdict | Reason |
|---|---|---|---|---|---|
| ashwood_arch_big | Ashwood Arch | ashwood | — | NEEDS_NEW_SHAPE | functional piece (name matches door|gate|grate|window|shutter|hatch|arch) — must not render as a plain box |
| ashwood_door | Ashwood Door | ashwood | — | NEEDS_NEW_SHAPE | functional piece (name matches door|gate|grate|window|shutter|hatch|arch) — must not render as a plain box |
| ashwood_wall_arch | Ashwood Arched Wall | ashwood | — | NEEDS_NEW_SHAPE | functional piece (name matches door|gate|grate|window|shutter|hatch|arch) — must not render as a plain box |
| blackmarble_arch | Black Marble Arch | blackmarble | — | NEEDS_NEW_SHAPE | functional piece (name matches door|gate|grate|window|shutter|hatch|arch) — must not render as a plain box |
| flametal_gate | Flametal Gate | flametal | — | NEEDS_NEW_SHAPE | functional piece (name matches door|gate|grate|window|shutter|hatch|arch) — must not render as a plain box |
| Piece_grausten_pillar_arch | Grausten Medium Arch | grausten | — | NEEDS_NEW_SHAPE | functional piece (name matches door|gate|grate|window|shutter|hatch|arch) — must not render as a plain box |
| Piece_grausten_pillar_arch_small | Grausten Small Arch | grausten | — | NEEDS_NEW_SHAPE | functional piece (name matches door|gate|grate|window|shutter|hatch|arch) — must not render as a plain box |
| piece_grausten_roof_45_arch | Grausten Arched Roof | grausten | — | NEEDS_NEW_SHAPE | functional piece (name matches door|gate|grate|window|shutter|hatch|arch) — must not render as a plain box |
| piece_grausten_roof_45_arch_corner | Grausten Arched Roof Corner | grausten | — | NEEDS_NEW_SHAPE | functional piece (name matches door|gate|grate|window|shutter|hatch|arch) — must not render as a plain box |
| piece_grausten_roof_45_arch_corner2 | Grausten Arched Roof Corner | grausten | — | NEEDS_NEW_SHAPE | functional piece (name matches door|gate|grate|window|shutter|hatch|arch) — must not render as a plain box |
| Piece_grausten_wall_arch | Grausten Wall Arch | grausten | — | NEEDS_NEW_SHAPE | functional piece (name matches door|gate|grate|window|shutter|hatch|arch) — must not render as a plain box |
| Piece_grausten_wall_arch_inverted | Grausten Wall Arch (Inverted) | grausten | — | NEEDS_NEW_SHAPE | functional piece (name matches door|gate|grate|window|shutter|hatch|arch) — must not render as a plain box |
| Piece_grausten_window_2x2 | Grausten Window 2x2 | grausten | — | NEEDS_NEW_SHAPE | functional piece (name matches door|gate|grate|window|shutter|hatch|arch) — must not render as a plain box |
| Piece_grausten_window_4x2 | Grausten Window 4x2 | grausten | — | NEEDS_NEW_SHAPE | functional piece (name matches door|gate|grate|window|shutter|hatch|arch) — must not render as a plain box |
| piece_stakewall_blackwood | Ashwood Stakewall | ashwood | — | SUSPICIOUS | off-center pivot: center is 1.60m from snap-box middle |
| ashwood_wall_roof_26 | Ashwood Wall 26° | ashwood | triangle | REVIEW | derived geometry's y extent (1.00) differs from bounds (1.69) by more than the 60%-140% tolerance |
| ashwood_wall_roof_26_upsidedown | Ashwood Wall 26° (Inverted) | ashwood | triangle | REVIEW | derived geometry's y extent (1.00) differs from bounds (1.69) by more than the 60%-140% tolerance |
| blackmarble_column_1 | Black Marble Column Small | blackmarble | — | REVIEW | 18 snap points, unrecognized pattern |
| blackmarble_column_2 | Black Marble Column Wide | blackmarble | — | REVIEW | 18 snap points, unrecognized pattern |
| blackmarble_floor_triangle | Black Marble Floor Triangle | blackmarble | — | REVIEW | 6 snap points, unrecognized pattern |
| blackmarble_tip | Black Marble Quarter Spire | blackmarble | — | REVIEW | 5 snap points, unrecognized pattern |
| Piece_grausten_pillarbase_medium | Grausten Medium Pillar | grausten | — | REVIEW | 10 snap points, unrecognized pattern |
| Piece_grausten_pillarbase_tapered | Grausten Tapered Pillar | grausten | — | REVIEW | 10 snap points, unrecognized pattern |
| Piece_grausten_pillarbase_tapered_inverted | Grausten Tapered Pillar (Inverted) | grausten | — | REVIEW | 10 snap points, unrecognized pattern |
| Piece_grausten_pillarbeam_medium | Grausten Medium Beam | grausten | — | REVIEW | 10 snap points, unrecognized pattern |
| ashwood_beam_1m | Ashwood Beam 1 m | ashwood | box | CLEAN | 2 snap points on one axis |
| ashwood_beam_2m | Ashwood Beam 2 m | ashwood | box | CLEAN | 2 snap points on one axis |
| ashwood_deco_floor | Ashwood Decorative Floor | ashwood | box | CLEAN | 4 corner snap points at a single height |
| ashwood_decowall_2x2 | Ashwood Decorative Wall | ashwood | box | CLEAN | 4 corners, height split 2/2 but no depth correlation — plain wall, not a slope |
| ashwood_decowall_divider | Ashwood Divider | ashwood | box | CLEAN | 4 corners, height split 2/2 but no depth correlation — plain wall, not a slope |
| ashwood_decowall_tree | Ashwood Decorative Window | ashwood | box | CLEAN | 4 corners, height split 2/2 but no depth correlation — plain wall, not a slope |
| ashwood_floor_1x1 | Ashwood Floor 1x1 | ashwood | box | CLEAN | 4 corner snap points at a single height |
| ashwood_floor_2x2 | Ashwood Floor 2x2 | ashwood | box | CLEAN | 4 corner snap points at a single height |
| ashwood_halfwall_1x2 | Ashwood Half Wall | ashwood | box | CLEAN | 4 corners, height split 2/2 but no depth correlation — plain wall, not a slope |
| ashwood_pole_1m | Ashwood Pole 1 m | ashwood | cylinder | CLEAN | 2 vertical snap points, round cross-section |
| ashwood_pole_2m | Ashwood Pole 2 m | ashwood | cylinder | CLEAN | 2 vertical snap points, round cross-section |
| ashwood_quarterwall_1x1 | Ashwood Quarter Wall | ashwood | box | CLEAN | 4 corners, height split 2/2 but no depth correlation — plain wall, not a slope |
| ashwood_stair | Ashwood Stair | ashwood | stairs | CLEAN | functional piece (stair) — using the existing stairs shape |
| ashwood_wall_2x2 | Ashwood Wall | ashwood | box | CLEAN | 4 corners, height split 2/2 but no depth correlation — plain wall, not a slope |
| ashwood_wall_beam_26 | Ashwood Beam 26° | ashwood | beam | CLEAN | snap-derived: 2 diagonal snap points |
| ashwood_wall_beam_45 | Ashwood Beam 45° | ashwood | beam | CLEAN | snap-derived: 2 diagonal snap points |
| ashwood_wall_beam_67 | Ashwood Beam 67° | ashwood | beam | CLEAN | snap-derived: 2 diagonal snap points |
| ashwood_wall_cross_26 | Ashwood Roof Cross 26° | ashwood | cross | CLEAN | snap-derived: 5 snap points (4 corners + center) — X truss |
| ashwood_wall_cross_45 | Ashwood Roof Cross 45° | ashwood | cross | CLEAN | snap-derived: 5 snap points (4 corners + center) — X truss |
| ashwood_wall_cross_67 | Ashwood Roof Cross 67° | ashwood | cross | CLEAN | snap-derived: 5 snap points (4 corners + center) — X truss |
| ashwood_wall_roof_45 | Ashwood Wall 45° | ashwood | triangle | CLEAN | snap-derived: 3 snap points (gable triangle) |
| ashwood_wall_roof_45_upsidedown | Ashwood Wall 45° (Inverted) | ashwood | triangle | CLEAN | snap-derived: 3 snap points (gable triangle) |
| ashwood_wall_roof_67_a | Ashwood Wall 67° | ashwood | triangle | CLEAN | snap-derived: 3 snap points (gable triangle) |
| ashwood_wall_roof_67_upsidedown | Ashwood Wall 67° (Inverted) | ashwood | triangle | CLEAN | snap-derived: 3 snap points (gable triangle) |
| blackmarble_1x1 | Black Marble 1x1x1 | blackmarble | box | CLEAN | 8 corner snap points — full box |
| blackmarble_2x1x1 | Black Marble 2x1x1 | blackmarble | box | CLEAN | 8 corner snap points — full box |
| blackmarble_2x2x2 | Black Marble 2x2x2 | blackmarble | box | CLEAN | 8 corner snap points — full box |
| blackmarble_base_1 | Black Marble Plinth | blackmarble | box | CLEAN | 8 corner snap points — full box |
| blackmarble_basecorner | Black Marble Plinth Corner | blackmarble | box | CLEAN | 8 corner snap points — full box |
| blackmarble_floor | Black Marble Floor | blackmarble | box | CLEAN | 8 corner snap points — full box |
| blackmarble_out_1 | Black Marble Cornice | blackmarble | box | CLEAN | 8 corner snap points — full box |
| blackmarble_outcorner | Black Marble Cornice Corner | blackmarble | box | CLEAN | 8 corner snap points — full box |
| blackmarble_stair | Black Marble Stair | blackmarble | stairs | CLEAN | functional piece (stair) — using the existing stairs shape |
| Piece_flametal_beam | Flametal Beam | flametal | box | CLEAN | 2 snap points on one axis |
| Piece_flametal_pillar | Flametal Pillar | flametal | cylinder | CLEAN | 2 vertical snap points, round cross-section |
| Piece_grausten_floor_1x1 | Grausten Floor 1x1 | grausten | box | CLEAN | 8 corner snap points — full box |
| Piece_grausten_floor_2x2 | Grausten Floor 2x2 | grausten | box | CLEAN | 8 corner snap points — full box |
| Piece_grausten_floor_4x4 | Grausten Floor 4x4 | grausten | box | CLEAN | 8 corner snap points — full box |
| Piece_grausten_pillarbase_small | Grausten Small Pillar | grausten | cylinder | CLEAN | 2 vertical snap points, round cross-section |
| Piece_grausten_pillarbeam_small | Grausten Small Beam | grausten | box | CLEAN | 2 snap points on one axis |
| piece_grausten_roof_45 | Grausten Roof | grausten | wedge | CLEAN | 4 corners, height split 2/2, depth-correlated — sloped panel |
| piece_grausten_roof_45_corner | Grausten Roof Corner | grausten | triangle | CLEAN | snap-derived: 3 snap points (gable triangle) |
| piece_grausten_roof_45_corner2 | Grausten Roof Corner | grausten | triangle | CLEAN | snap-derived: 3 snap points (gable triangle) |
| Piece_grausten_stone_ladder | Grausten Steep Stairs | grausten | ladder | CLEAN | functional piece (ladder) — using the existing ladder shape |
| piece_grausten_stonestair | Grausten Stairs | grausten | stairs | CLEAN | functional piece (stair) — using the existing stairs shape |
| Piece_grausten_wall_1x2 | Grausten Wall 1x2 | grausten | box | CLEAN | 4 corners, height split 2/2 but no depth correlation — plain wall, not a slope |
| Piece_grausten_wall_2x2 | Grausten Wall 2x2 | grausten | box | CLEAN | 4 corners, height split 2/2 but no depth correlation — plain wall, not a slope |
| Piece_grausten_wall_4x2 | Grausten Wall 4x2 | grausten | box | CLEAN | 4 corners, height split 2/2 but no depth correlation — plain wall, not a slope |

## Batch 3

| Prefab | Label | Family | Shape | Verdict | Reason |
|---|---|---|---|---|---|
| piece_hexagonal_door | Hexagonal Gate | dvergr | — | NEEDS_NEW_SHAPE | functional piece (name matches door|gate|grate|window|shutter|hatch|arch) — must not render as a plain box |
| piece_drawbridge | Timberwood Drawbridge | misc | — | SUSPICIOUS | oversized: a bounds axis exceeds 6m |
| piece_drawbridge_log | Rustic Drawbridge | misc | — | SUSPICIOUS | oversized: a bounds axis exceeds 6m |
| stave_gate | Timberwood Gate | timberwood | — | SUSPICIOUS | oversized: a bounds axis exceeds 6m |
| stave_wall_2x2 | Timber Wall | timberwood | — | REVIEW | 6 snap points, unrecognized pattern |
| crystal_wall_1x1 | Crystal Wall 1x1 | misc | box | CLEAN | 4 corners, height split 2/2 but no depth correlation — plain wall, not a slope |
| hearth | Hearth | misc | box | CLEAN | 8 corner snap points — full box |
| piece_dvergr_metal_wall_2x2 | Dvergr Metal Wall | dvergr | box | CLEAN | 4 corners, height split 2/2 but no depth correlation — plain wall, not a slope |
| piece_dvergr_spiralstair | Dvergr Spiral Staircase Left | dvergr | stairs | CLEAN | functional piece (stair) — using the existing stairs shape |
| piece_dvergr_spiralstair_right | Dvergr Spiral Staircase Right | dvergr | stairs | CLEAN | functional piece (stair) — using the existing stairs shape |
| piece_dvergr_stake_wall | Dvergr Stakewall | dvergr | box | CLEAN | 4 corners, height split 2/2 but no depth correlation — plain wall, not a slope |
| piece_icecube | Ice Block | misc | box | CLEAN | 8 corner snap points — full box |
| scale_halfwall_1x2 | Scalewood Half Wall | scalewood | box | CLEAN | 4 corners, height split 2/2 but no depth correlation — plain wall, not a slope |
| scale_quarterwall_1x1 | Scalewood Quarter Wall | scalewood | box | CLEAN | 4 corners, height split 2/2 but no depth correlation — plain wall, not a slope |
| scale_wall_2x2 | Scalewood Wall | scalewood | box | CLEAN | 4 corners, height split 2/2 but no depth correlation — plain wall, not a slope |
| scale_wall_roof_26 | Scalewood Wall 26° Left | scalewood | triangle | CLEAN | snap-derived: 3 snap points (gable triangle) |
| scale_wall_roof_26_flipped | Scalewood Wall 26° Right | scalewood | triangle | CLEAN | snap-derived: 3 snap points (gable triangle) |
| scale_wall_roof_26_upsidedown | Scalewood Wall 26° Right (Inverted) | scalewood | triangle | CLEAN | snap-derived: 3 snap points (gable triangle) |
| scale_wall_roof_26_upsidedown_flipped | Scalewood Wall 26° Left (Inverted) | scalewood | triangle | CLEAN | snap-derived: 3 snap points (gable triangle) |
| scale_wall_roof_45 | Scalewood Wall 45° Left | scalewood | triangle | CLEAN | snap-derived: 3 snap points (gable triangle) |
| scale_wall_roof_45_flipped | Scalewood Wall 45° Right | scalewood | triangle | CLEAN | snap-derived: 3 snap points (gable triangle) |
| scale_wall_roof_45_upsidedown | Scalewood Wall 45° Right (Inverted) | scalewood | triangle | CLEAN | snap-derived: 3 snap points (gable triangle) |
| scale_wall_roof_45_upsidedown_flipped | Scalewood Wall 45° Left (Inverted) | scalewood | triangle | CLEAN | snap-derived: 3 snap points (gable triangle) |
| scale_wall_roof_67 | Scalewood Wall 67° Left | scalewood | triangle | CLEAN | snap-derived: 3 snap points (gable triangle) |
| scale_wall_roof_67_flipped | Scalewood Wall 67° Right | scalewood | triangle | CLEAN | snap-derived: 3 snap points (gable triangle) |
| scale_wall_roof_67_upsidedown | Scalewood Wall 67° Right (Inverted) | scalewood | triangle | CLEAN | snap-derived: 3 snap points (gable triangle) |
| scale_wall_roof_67_upsidedown_flipped | Scalewood Wall 67° Left (Inverted) | scalewood | triangle | CLEAN | snap-derived: 3 snap points (gable triangle) |
| stake_wall | Stakewall | misc | box | CLEAN | 4 corners, height split 2/2 but no depth correlation — plain wall, not a slope |
| stave_beam_26 | Timber Beam 26° | timberwood | beam | CLEAN | snap-derived: 2 diagonal snap points |
| stave_beam_2m | Timber Beam 2m | timberwood | box | CLEAN | 2 snap points on one axis |
| stave_beam_45 | Timber Beam 45° | timberwood | beam | CLEAN | snap-derived: 2 diagonal snap points |
| stave_beam_4m | Timber Beam 4m | timberwood | box | CLEAN | 2 snap points on one axis |
| stave_beam_67 | Timber Beam 67° | timberwood | beam | CLEAN | snap-derived: 2 diagonal snap points |
| stave_deco_beam_26 | Decorated Timber Beam 26° | timberwood | beam | CLEAN | snap-derived: 2 diagonal snap points |
| stave_deco_beam_2m | Decorated Timber Beam 2m | timberwood | box | CLEAN | 2 snap points on one axis |
| stave_deco_beam_45 | Decorated Timber Beam 45° | timberwood | beam | CLEAN | snap-derived: 2 diagonal snap points |
| stave_deco_beam_67 | Decorated Timber Beam 67° | timberwood | beam | CLEAN | snap-derived: 2 diagonal snap points |
| stave_deco_pole_2m | Decorated Timber Pole 2m | timberwood | box | CLEAN | 2 snap points on one axis |
| stave_deco_wall_2x2 | Lathed Timber Wall | timberwood | box | CLEAN | 4 corners, height split 2/2 but no depth correlation — plain wall, not a slope |
| stave_pole_2m | Timber Pole 2m | timberwood | cylinder | CLEAN | 2 vertical snap points, round cross-section |
| stave_pole_4m | Timber Pole 4m | timberwood | cylinder | CLEAN | 2 vertical snap points, round cross-section |
| stave_wall_cross_26 | Timber Roof Cross 26° | timberwood | cross | CLEAN | snap-derived: 5 snap points (4 corners + center) — X truss |
| stave_wall_cross_45 | Timber Roof Cross 45° | timberwood | cross | CLEAN | snap-derived: 5 snap points (4 corners + center) — X truss |
| stave_wall_cross_67 | Timber Roof Cross 67° | timberwood | cross | CLEAN | snap-derived: 5 snap points (4 corners + center) — X truss |
| stone_fence | Stone Fence | misc | box | CLEAN | 4 corners, height split 2/2 but no depth correlation — plain wall, not a slope |

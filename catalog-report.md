# Catalog report

## Summary

| Batch | Verdict | Count |
|---|---|---|
| 0 | EXCLUDE | 3 |
| 1 | CLEAN | 86 |
| 2 | CLEAN | 73 |
| 3 | CLEAN | 45 |

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

## Batch 2 (shipped)

| Prefab | Label | Family | Shape | Verdict | Reason |
|---|---|---|---|---|---|
| ashwood_arch_big | Ashwood Arch | ashwood | arch | CLEAN | 3-point pattern (bottom-left/top-left/top-right, bottom-right corner missing) and near-identical bounds/proportions to darkwood_arch — a genuine walkable archway, same motif |
| ashwood_beam_1m | Ashwood Beam 1 m | ashwood | box | CLEAN | 2 snap points on one axis |
| ashwood_beam_2m | Ashwood Beam 2 m | ashwood | box | CLEAN | 2 snap points on one axis |
| ashwood_deco_floor | Ashwood Decorative Floor | ashwood | box | CLEAN | 4 corner snap points at a single height |
| ashwood_decowall_2x2 | Ashwood Decorative Wall | ashwood | box | CLEAN | 4 corners, height split 2/2 but no depth correlation — plain wall, not a slope |
| ashwood_decowall_divider | Ashwood Divider | ashwood | box | CLEAN | 4 corners, height split 2/2 but no depth correlation — plain wall, not a slope |
| ashwood_decowall_tree | Ashwood Decorative Window | ashwood | box | CLEAN | 4 corners, height split 2/2 but no depth correlation — plain wall, not a slope |
| ashwood_door | Ashwood Door | ashwood | door | CLEAN | 2m-wide, 3m-tall single door opening; leaves:1 since it's named Door (not Gate) — darkwood_gate's 2-leaf pattern is reserved for pieces named Gate |
| ashwood_floor_1x1 | Ashwood Floor 1x1 | ashwood | box | CLEAN | 4 corner snap points at a single height |
| ashwood_floor_2x2 | Ashwood Floor 2x2 | ashwood | box | CLEAN | 4 corner snap points at a single height |
| ashwood_halfwall_1x2 | Ashwood Half Wall | ashwood | box | CLEAN | 4 corners, height split 2/2 but no depth correlation — plain wall, not a slope |
| ashwood_pole_1m | Ashwood Pole 1 m | ashwood | cylinder | CLEAN | 2 vertical snap points, round cross-section |
| ashwood_pole_2m | Ashwood Pole 2 m | ashwood | cylinder | CLEAN | 2 vertical snap points, round cross-section |
| ashwood_quarterwall_1x1 | Ashwood Quarter Wall | ashwood | box | CLEAN | 4 corners, height split 2/2 but no depth correlation — plain wall, not a slope |
| ashwood_stair | Ashwood Stair | ashwood | stairs | CLEAN | functional piece (stair) — using the existing stairs shape |
| ashwood_wall_2x2 | Ashwood Wall | ashwood | box | CLEAN | 4 corners, height split 2/2 but no depth correlation — plain wall, not a slope |
| ashwood_wall_arch | Ashwood Arched Wall | ashwood | arch | CLEAN | 3-point pattern (bottom-left/top-left/top-right, bottom-right missing) — same archway motif as darkwood_arch/ashwood_arch_big, just at 1x1 wall-panel scale |
| ashwood_wall_beam_26 | Ashwood Beam 26° | ashwood | beam | CLEAN | snap-derived: 2 diagonal snap points |
| ashwood_wall_beam_45 | Ashwood Beam 45° | ashwood | beam | CLEAN | snap-derived: 2 diagonal snap points |
| ashwood_wall_beam_67 | Ashwood Beam 67° | ashwood | beam | CLEAN | snap-derived: 2 diagonal snap points |
| ashwood_wall_cross_26 | Ashwood Roof Cross 26° | ashwood | cross | CLEAN | snap-derived: 5 snap points (4 corners + center) — X truss |
| ashwood_wall_cross_45 | Ashwood Roof Cross 45° | ashwood | cross | CLEAN | snap-derived: 5 snap points (4 corners + center) — X truss |
| ashwood_wall_cross_67 | Ashwood Roof Cross 67° | ashwood | cross | CLEAN | snap-derived: 5 snap points (4 corners + center) — X truss |
| ashwood_wall_roof_26 | Ashwood Wall 26° | ashwood | triangle | CLEAN | same 3-point gable-triangle family as ashwood_wall_roof_45/_67 (all already CLEAN); the sanity check's y-extent ratio (1.00 vs bounds 1.69 = 0.59) just misses the 0.6 floor because a shallow 26° roof has proportionally more eave overhang beyond the triangle's defining points than the steeper 45°/67° variants — classify()'s own triangle guess is correct, only the heuristic tolerance false-flagged it |
| ashwood_wall_roof_26_upsidedown | Ashwood Wall 26° (Inverted) | ashwood | triangle | CLEAN | see ashwood_wall_roof_26 — inverted variant, same shallow-eave-overhang explanation |
| ashwood_wall_roof_45 | Ashwood Wall 45° | ashwood | triangle | CLEAN | snap-derived: 3 snap points (gable triangle) |
| ashwood_wall_roof_45_upsidedown | Ashwood Wall 45° (Inverted) | ashwood | triangle | CLEAN | snap-derived: 3 snap points (gable triangle) |
| ashwood_wall_roof_67_a | Ashwood Wall 67° | ashwood | triangle | CLEAN | snap-derived: 3 snap points (gable triangle) |
| ashwood_wall_roof_67_upsidedown | Ashwood Wall 67° (Inverted) | ashwood | triangle | CLEAN | snap-derived: 3 snap points (gable triangle) |
| blackmarble_1x1 | Black Marble 1x1x1 | blackmarble | box | CLEAN | 8 corner snap points — full box |
| blackmarble_2x1x1 | Black Marble 2x1x1 | blackmarble | box | CLEAN | 8 corner snap points — full box |
| blackmarble_2x2x2 | Black Marble 2x2x2 | blackmarble | box | CLEAN | 8 corner snap points — full box |
| blackmarble_arch | Black Marble Arch | blackmarble | arch | CLEAN | one snap-point column (x=-1) is fully solid top+bottom, the other (x=1) is open at the bottom — the same 'archway cut into one side' motif as stone_arch; 1.14m depth matches stone_arch's 1.13m, both far thicker than a thin wall panel |
| blackmarble_base_1 | Black Marble Plinth | blackmarble | box | CLEAN | 8 corner snap points — full box |
| blackmarble_basecorner | Black Marble Plinth Corner | blackmarble | box | CLEAN | 8 corner snap points — full box |
| blackmarble_column_1 | Black Marble Column Small | blackmarble | cylinder | CLEAN | 18-point pattern is a center point + an 8-point ring (axis + 45°-diagonal offsets at radius 0.5, i.e. an octagon approximating a circle) at each of 2 heights — a round column; bounds.x/z are nearly equal (1.06 vs 1.09) |
| blackmarble_column_2 | Black Marble Column Wide | blackmarble | cylinder | CLEAN | same ring pattern as blackmarble_column_1, wider radius (1.0 vs 0.5) — round column; bounds.x/z nearly equal (2.12 vs 2.15) |
| blackmarble_floor | Black Marble Floor | blackmarble | box | CLEAN | 8 corner snap points — full box |
| blackmarble_floor_triangle | Black Marble Floor Triangle | blackmarble | box | CLEAN | 6 points are a true triangular-footprint PRISM — a full box's 8 corners minus both corners at one XZ position (x=-1,z=-1 entirely absent) — a genuine triangular floor with real thickness, not a thin gable panel. The flat 'triangle' shape can't be forced here (needs geom the override schema doesn't pass through for this case, and would misrepresent the solid triangular-prism volume as a flat panel anyway); box approximates the bounding volume, the same 'good enough for now' tradeoff used elsewhere for an imperfect fit |
| blackmarble_out_1 | Black Marble Cornice | blackmarble | box | CLEAN | 8 corner snap points — full box |
| blackmarble_outcorner | Black Marble Cornice Corner | blackmarble | box | CLEAN | 8 corner snap points — full box |
| blackmarble_stair | Black Marble Stair | blackmarble | stairs | CLEAN | functional piece (stair) — using the existing stairs shape |
| blackmarble_tip | Black Marble Quarter Spire | blackmarble | box | CLEAN | 5 points = a full 4-corner base (y=-1) plus a single apex point offset to ONE corner (x=-0.5,z=0.5, not centered — so not a cross X-truss). An asymmetric quarter-spire taper with no matching parametric shape (hip/valley would need a guessed default odd-corner that likely doesn't match this piece's real off-center apex); box used as a safe placeholder, consistent with the tall/narrow 'spire' bounds (1.11 x 2.08 x 1.14) |
| flametal_gate | Flametal Gate | flametal | door | CLEAN | 4m functional opening (matches darkwood_gate's 4m gate height) plus ~1.4m of bounds above it, consistent with a portcullis-style raised mechanism; 0.6m thickness rules out the thin (0.075m) iron_grate lattice treatment. Named Gate, so leaves:2 like darkwood_gate |
| Piece_flametal_beam | Flametal Beam | flametal | box | CLEAN | 2 snap points on one axis |
| Piece_flametal_pillar | Flametal Pillar | flametal | cylinder | CLEAN | 2 vertical snap points, round cross-section |
| Piece_grausten_floor_1x1 | Grausten Floor 1x1 | grausten | box | CLEAN | 8 corner snap points — full box |
| Piece_grausten_floor_2x2 | Grausten Floor 2x2 | grausten | box | CLEAN | 8 corner snap points — full box |
| Piece_grausten_floor_4x4 | Grausten Floor 4x4 | grausten | box | CLEAN | 8 corner snap points — full box |
| Piece_grausten_pillar_arch | Grausten Medium Arch | grausten | arch | CLEAN | 1.28m-thick freestanding structure named 'Arch' with no roof/window/wall qualifier — a genuine walkable archway. Its 10-point pattern (two 5-point plus-clusters, one on a wall face, one on the ground) doesn't match any snap-derived shape, but archGeometry only needs bounds, so it still renders as a real doorway opening |
| Piece_grausten_pillar_arch_small | Grausten Small Arch | grausten | arch | CLEAN | small (1.38x1.40x0.58m) freestanding piece named 'Arch'. Only 2 snap points (diagonal), which classify() would normally read as a 'beam', but beam's geometry needs a-b-t-ext geom data that the override schema doesn't pass through for a functional-name piece (classify() never reaches the beam dispatch once the name matches /arch/); forcing beam would throw at render time. Arch needs only bounds, is mechanically safe, and matches the name and stone-archway-class thickness |
| Piece_grausten_pillarbase_medium | Grausten Medium Pillar | grausten | box | CLEAN | 10-point pattern is two axis-aligned plus-clusters (center + 4 offsets at ±0.5 in x or z only, no 45°-diagonal ring points like the blackmarble columns) — a square-cross-section pillar base, not round; box fallback |
| Piece_grausten_pillarbase_small | Grausten Small Pillar | grausten | cylinder | CLEAN | 2 vertical snap points, round cross-section |
| Piece_grausten_pillarbase_tapered | Grausten Tapered Pillar | grausten | box | CLEAN | narrows from a 5-point plus-cluster base (y=0) through a 4-point mid-band (y=0.75) to a single top point (y=2) — a genuine taper, but the cross-section is square throughout (axis-aligned, no diagonal ring), not round. No tapered-column shape exists in the toolkit; box approximates the footprint at its widest, same fallback as the other pillar/beam REVIEW pieces |
| Piece_grausten_pillarbase_tapered_inverted | Grausten Tapered Pillar (Inverted) | grausten | box | CLEAN | mirror of Piece_grausten_pillarbase_tapered — single point at the bottom (y=0) widening through a 4-point mid-band (y=1.25) to a full 5-point plus at the top (y=2); same square-cross-section, same box fallback |
| Piece_grausten_pillarbeam_medium | Grausten Medium Beam | grausten | box | CLEAN | 10-point pattern is two axis-aligned plus-clusters at x=+0.5/-0.5 (square cross-section in the y-z plane, no diagonal ring points) — a short square beam; bounds are nearly cubic (1.14 x 1.04 x 1.13), box fallback |
| Piece_grausten_pillarbeam_small | Grausten Small Beam | grausten | box | CLEAN | 2 snap points on one axis |
| piece_grausten_roof_45 | Grausten Roof | grausten | wedge | CLEAN | 4 corners, height split 2/2, depth-correlated — sloped panel |
| piece_grausten_roof_45_arch | Grausten Arched Roof | grausten | wedge | CLEAN | NOT a doorway — 'Arched Roof' describes a roof silhouette, not a walkthrough. Its 4 snap points are a textbook depth-correlated 2-low/2-high split (both low points at z=1, both high points at z=-1), the exact pattern classify() elsewhere reads as a genuine sloped wedge panel; bounds (2.44x2.18x2.53) match the scale of the plain piece_grausten_roof_45 wedge |
| piece_grausten_roof_45_arch_corner | Grausten Arched Roof Corner | grausten | triangle | CLEAN | snap-derived: 3 snap points (gable triangle) |
| piece_grausten_roof_45_arch_corner2 | Grausten Arched Roof Corner | grausten | triangle | CLEAN | snap-derived: 3 snap points (gable triangle) |
| piece_grausten_roof_45_corner | Grausten Roof Corner | grausten | triangle | CLEAN | snap-derived: 3 snap points (gable triangle) |
| piece_grausten_roof_45_corner2 | Grausten Roof Corner | grausten | triangle | CLEAN | snap-derived: 3 snap points (gable triangle) |
| Piece_grausten_stone_ladder | Grausten Steep Stairs | grausten | ladder | CLEAN | functional piece (ladder) — using the existing ladder shape |
| piece_grausten_stonestair | Grausten Stairs | grausten | stairs | CLEAN | functional piece (stair) — using the existing stairs shape |
| Piece_grausten_wall_1x2 | Grausten Wall 1x2 | grausten | box | CLEAN | 4 corners, height split 2/2 but no depth correlation — plain wall, not a slope |
| Piece_grausten_wall_2x2 | Grausten Wall 2x2 | grausten | box | CLEAN | 4 corners, height split 2/2 but no depth correlation — plain wall, not a slope |
| Piece_grausten_wall_4x2 | Grausten Wall 4x2 | grausten | box | CLEAN | 4 corners, height split 2/2 but no depth correlation — plain wall, not a slope |
| Piece_grausten_wall_arch | Grausten Wall Arch | grausten | arch | CLEAN | one snap-point column (x=1) is fully solid across all 3 heights (y=0,1,2), the other (x=-1) has only a top point — same 'open on one side' archway motif as blackmarble_arch/stone_arch |
| Piece_grausten_wall_arch_inverted | Grausten Wall Arch (Inverted) | grausten | arch | CLEAN | mirror of Piece_grausten_wall_arch — solid column on the left (x=-1, y=0,1,2), open at the top on the right (x=1, only y=0 present); same archway motif, flipped, matching the '_inverted' name |
| Piece_grausten_window_2x2 | Grausten Window 2x2 | grausten | lattice | CLEAN | plain 4-corner box pattern (2/2 height split, no depth correlation) that would otherwise auto-classify as a solid box; grid bars approximate window panes, same treatment as iron_floor_1x1_v2 |
| Piece_grausten_window_4x2 | Grausten Window 4x2 | grausten | lattice | CLEAN | see Piece_grausten_window_2x2, wider (4m) variant, same box-corner pattern |
| piece_stakewall_blackwood | Ashwood Stakewall | ashwood | box | CLEAN | 8 corner snap points — full box |

## Batch 3 (shipped)

| Prefab | Label | Family | Shape | Verdict | Reason |
|---|---|---|---|---|---|
| crystal_wall_1x1 | Crystal Wall 1x1 | misc | box | CLEAN | 4 corners, height split 2/2 but no depth correlation — plain wall, not a slope |
| hearth | Hearth | misc | box | CLEAN | 8 corner snap points — full box |
| piece_drawbridge | Timberwood Drawbridge | misc | box | CLEAN | Timberwood Drawbridge; genuinely large (6.5x11.7x4.6, tower+deck mechanism), not a data bug. Its 6 snap points are 3 distinct Y levels x 2 Z positions at a fixed X (a hinge/mount rig), which doesn't match any recognized flat-shape pattern (not a box corner set, not a ridge). A drawbridge is a complex hinged mechanism with no dedicated shape; box is a crude but reasonable first-pass footprint, same 'ship an approximation, flag for later' approach as other functional pieces without a bespoke shape. |
| piece_drawbridge_log | Rustic Drawbridge | misc | box | CLEAN | Rustic Drawbridge; see piece_drawbridge — same 3-Y-level/2-Z hinge-rig snap pattern (scaled down, 4.3x6.9x2.7), same box-approximation reasoning. |
| piece_dvergr_metal_wall_2x2 | Dvergr Metal Wall | dvergr | box | CLEAN | 4 corners, height split 2/2 but no depth correlation — plain wall, not a slope |
| piece_dvergr_spiralstair | Dvergr Spiral Staircase Left | dvergr | stairs | CLEAN | functional piece (stair) — using the existing stairs shape |
| piece_dvergr_spiralstair_right | Dvergr Spiral Staircase Right | dvergr | stairs | CLEAN | functional piece (stair) — using the existing stairs shape |
| piece_dvergr_stake_wall | Dvergr Stakewall | dvergr | box | CLEAN | 4 corners, height split 2/2 but no depth correlation — plain wall, not a slope |
| piece_hexagonal_door | Hexagonal Gate | dvergr | door | CLEAN | Hexagonal Gate; only 2 snap points (top/bottom centerline) so classify() can't tell it's a gate from pattern alone — matches the functional-name rule. Real hexagonal frame isn't modeled (no hexagon shape exists), plain rectangular door frame is an approximation. Width (3.94m) is close to double darkwood_gate's, so leaves:2 like darkwood_gate/stave_gate rather than a single wide leaf. |
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
| stave_gate | Timberwood Gate | timberwood | door | CLEAN | Timberwood Gate; 5 snap points at x=(1,0)/(-1,0)/(1,6)/(-1,6)/(1,3) are the exact same topology as darkwood_gate's (1,0)/(-1,0)/(1,4)/(-1,4)/(1,2) — a gate frame, just taller (6.44m, over the 6m oversized cutoff, which is real: this is a tall stave-church-style gate). Treated like darkwood_gate: shape door, leaves 2, sized from its own bounds. |
| stave_pole_2m | Timber Pole 2m | timberwood | cylinder | CLEAN | 2 vertical snap points, round cross-section |
| stave_pole_4m | Timber Pole 4m | timberwood | cylinder | CLEAN | 2 vertical snap points, round cross-section |
| stave_wall_2x2 | Timber Wall | timberwood | box | CLEAN | Timber Wall; 6 snap points are x=(1,0,-1) at y=1 and x=(1,0,-1) at y=-1 — i.e. the standard 4-corner wall pattern (x=+-1, y=+-1, z=0 for all, no depth correlation) PLUS an extra mid-span point at x=0 on each row (likely a sub-snap target for narrower pieces to dock at the wall's middle). All 6 points share z=0, so this is unambiguously a plain flat wall, not a roof/ridge piece — classify()'s 6-point branch only recognizes the eave(4)/ridge(2) roof pattern, so this 3/3 wall split falls through to REVIEW. Forced to box, consistent with every other 4-corner flat wall in the catalog. |
| stave_wall_cross_26 | Timber Roof Cross 26° | timberwood | cross | CLEAN | snap-derived: 5 snap points (4 corners + center) — X truss |
| stave_wall_cross_45 | Timber Roof Cross 45° | timberwood | cross | CLEAN | snap-derived: 5 snap points (4 corners + center) — X truss |
| stave_wall_cross_67 | Timber Roof Cross 67° | timberwood | cross | CLEAN | snap-derived: 5 snap points (4 corners + center) — X truss |
| stone_fence | Stone Fence | misc | box | CLEAN | 4 corners, height split 2/2 but no depth correlation — plain wall, not a slope |

import type { GeneratorDef, GeneratorId, IngredientDef, IngredientId, LocationDef, LocationId, RecipeDef } from '../core/types';

// Механика мира. Тексты (названия, описания) лежат в texts.ts.
// Цифры подобраны симуляцией: scripts/simulate.ts.

export const GENERATORS: GeneratorDef[] = [
  { id: 'mortar', baseCost: 15, baseProd: 0.15 },
  { id: 'apprentice', baseCost: 100, baseProd: 1 },
  { id: 'alembic', baseCost: 1_100, baseProd: 8 },
  { id: 'greenhouse', baseCost: 12_000, baseProd: 47 },
  { id: 'crystal_furnace', baseCost: 130_000, baseProd: 260 },
  { id: 'homunculus', baseCost: 1.4e6, baseProd: 1_400 },
  { id: 'dragon_forge', baseCost: 2e7, baseProd: 7_800 },
  { id: 'moon_observatory', baseCost: 3.3e8, baseProd: 44_000 },
  { id: 'golem_workshop', baseCost: 5.1e9, baseProd: 260_000 },
  { id: 'ether_resonator', baseCost: 7.5e10, baseProd: 1.6e6 },
  { id: 'astral_portal', baseCost: 1e12, baseProd: 1e7 },
  { id: 'world_heart', baseCost: 1.4e13, baseProd: 6.5e7 },
];

export const GEN_BY_ID = Object.fromEntries(GENERATORS.map((g) => [g.id, g])) as Record<GeneratorId, GeneratorDef>;

export const INGREDIENTS: IngredientDef[] = [
  { id: 'moonpetal', rarity: 'common', color: '#c9b8ff' },
  { id: 'mandrake', rarity: 'common', color: '#8fcf6a' },
  { id: 'glowcap', rarity: 'common', color: '#6fe0d0' },
  { id: 'salamander_ash', rarity: 'rare', color: '#ff8a4c' },
  { id: 'kraken_ink', rarity: 'rare', color: '#5b7cff' },
  { id: 'star_dust', rarity: 'rare', color: '#ffe27a' },
  { id: 'dragon_scale', rarity: 'epic', color: '#3fcf8e' },
  { id: 'phoenix_feather', rarity: 'epic', color: '#ff5d73' },
  { id: 'void_pearl', rarity: 'legendary', color: '#9d6bff' },
  { id: 'time_sand', rarity: 'legendary', color: '#f4c05a' },
];

export const ING_BY_ID = Object.fromEntries(INGREDIENTS.map((i) => [i.id, i])) as Record<IngredientId, IngredientDef>;

export const LOCATIONS: LocationDef[] = [
  { id: 'whispering_woods', chapter: 2, drops: ['moonpetal', 'mandrake'], favoredRole: 'herbalist', power: 10 },
  { id: 'mushroom_caves', chapter: 2, drops: ['glowcap', 'mandrake'], favoredRole: 'herbalist', power: 16 },
  { id: 'volcano', chapter: 3, drops: ['salamander_ash', 'dragon_scale'], favoredRole: 'warrior', power: 30 },
  { id: 'sunken_coast', chapter: 4, drops: ['kraken_ink', 'void_pearl'], favoredRole: 'merchant', power: 50 },
  { id: 'sky_ruins', chapter: 5, drops: ['star_dust', 'phoenix_feather'], favoredRole: 'sage', power: 80 },
  { id: 'dragon_peaks', chapter: 6, drops: ['dragon_scale', 'phoenix_feather'], favoredRole: 'warrior', power: 120 },
  { id: 'abyss', chapter: 7, drops: ['void_pearl', 'time_sand'], favoredRole: 'sage', power: 170 },
  { id: 'clockwork_citadel', chapter: 8, drops: ['time_sand', 'star_dust'], favoredRole: 'merchant', power: 230 },
];

export const LOC_BY_ID = Object.fromEntries(LOCATIONS.map((l) => [l.id, l])) as Record<LocationId, LocationDef>;

/** Варианты длительности экспедиций: секунды и множитель добычи. */
export const EXPEDITION_DURATIONS = [
  { id: 'short', seconds: 5 * 60, loot: 1, essence: 2 },
  { id: 'medium', seconds: 60 * 60, loot: 6, essence: 15 },
  { id: 'long', seconds: 6 * 60 * 60, loot: 24, essence: 70 },
] as const;

export const RECIPES: RecipeDef[] = [
  { id: 'calm_draught', ingredients: ['moonpetal', 'moonpetal', 'mandrake'], discovery: { type: 'prodMult', value: 0.05 }, brew: { kind: 'prodBoost', mult: 2, seconds: 300 }, color: '#b9a7ff' },
  { id: 'swift_tonic', ingredients: ['mandrake', 'glowcap', 'moonpetal'], discovery: { type: 'expeditionSpeed', value: 0.05 }, brew: { kind: 'haste', mult: 1, seconds: 1800 }, color: '#7de3a8' },
  { id: 'glow_elixir', ingredients: ['glowcap', 'glowcap', 'glowcap'], discovery: { type: 'wispBonus', value: 0.1 }, brew: { kind: 'wispRain', mult: 1, seconds: 60 }, color: '#6fe0d0' },
  { id: 'strength_brew', ingredients: ['mandrake', 'mandrake', 'glowcap'], discovery: { type: 'tapMult', value: 0.1 }, brew: { kind: 'tapBoost', mult: 5, seconds: 60 }, color: '#a3d65c' },
  { id: 'fire_oil', ingredients: ['salamander_ash', 'glowcap', 'mandrake'], discovery: { type: 'genMult', target: 'crystal_furnace', value: 0.25 }, brew: { kind: 'critBoost', mult: 3, seconds: 90 }, color: '#ff9a4c' },
  { id: 'ink_of_insight', ingredients: ['kraken_ink', 'moonpetal', 'glowcap'], discovery: { type: 'essenceMult', value: 0.1 }, brew: { kind: 'goldRush', mult: 30, seconds: 0 }, color: '#5b7cff' },
  { id: 'star_tea', ingredients: ['star_dust', 'moonpetal', 'moonpetal'], discovery: { type: 'offlineMult', value: 0.15 }, brew: { kind: 'prodBoost', mult: 2, seconds: 600 }, color: '#ffe27a' },
  { id: 'salamander_heart', ingredients: ['salamander_ash', 'salamander_ash', 'dragon_scale'], discovery: { type: 'critMult', value: 0.25 }, brew: { kind: 'critBoost', mult: 4, seconds: 120 }, color: '#ff6a3d' },
  { id: 'deep_draught', ingredients: ['kraken_ink', 'kraken_ink', 'void_pearl'], discovery: { type: 'expeditionLoot', value: 0.1 }, brew: { kind: 'haste', mult: 1, seconds: 3600 }, color: '#3d5bd9' },
  { id: 'comet_tonic', ingredients: ['star_dust', 'star_dust', 'salamander_ash'], discovery: { type: 'prodMult', value: 0.08 }, brew: { kind: 'prodBoost', mult: 3, seconds: 300 }, color: '#ffd05a' },
  { id: 'dragon_blood', ingredients: ['dragon_scale', 'dragon_scale', 'salamander_ash'], discovery: { type: 'genMult', target: 'dragon_forge', value: 0.5 }, brew: { kind: 'tapBoost', mult: 10, seconds: 60 }, color: '#2fbf7a' },
  { id: 'phoenix_tears', ingredients: ['phoenix_feather', 'star_dust', 'moonpetal'], discovery: { type: 'prodMult', value: 0.1 }, brew: { kind: 'goldRush', mult: 60, seconds: 0 }, color: '#ff5d73' },
  { id: 'golem_clay', ingredients: ['dragon_scale', 'kraken_ink', 'mandrake'], discovery: { type: 'genMult', target: 'golem_workshop', value: 0.5 }, brew: { kind: 'prodBoost', mult: 2, seconds: 900 }, color: '#b08d6a' },
  { id: 'lunar_essence', ingredients: ['star_dust', 'moonpetal', 'glowcap'], discovery: { type: 'genMult', target: 'moon_observatory', value: 0.5 }, brew: { kind: 'wispRain', mult: 1, seconds: 90 }, color: '#d7d9ff' },
  { id: 'rebirth_elixir', ingredients: ['phoenix_feather', 'phoenix_feather', 'dragon_scale'], discovery: { type: 'tapMult', value: 0.25 }, brew: { kind: 'tapBoost', mult: 15, seconds: 60 }, color: '#ff7a3d' },
  { id: 'void_ink', ingredients: ['void_pearl', 'kraken_ink', 'star_dust'], discovery: { type: 'costReduction', value: 0.03 }, brew: { kind: 'goldRush', mult: 120, seconds: 0 }, color: '#7b4dff' },
  { id: 'hourglass_draught', ingredients: ['time_sand', 'star_dust', 'glowcap'], discovery: { type: 'expeditionSpeed', value: 0.1 }, brew: { kind: 'haste', mult: 1, seconds: 7200 }, color: '#f4c05a' },
  { id: 'ether_essence', ingredients: ['void_pearl', 'phoenix_feather', 'star_dust'], discovery: { type: 'genMult', target: 'ether_resonator', value: 0.5 }, brew: { kind: 'prodBoost', mult: 4, seconds: 300 }, color: '#7fe7ff' },
  { id: 'chronos_elixir', ingredients: ['time_sand', 'time_sand', 'phoenix_feather'], discovery: { type: 'offlineMult', value: 0.25 }, brew: { kind: 'goldRush', mult: 240, seconds: 0 }, color: '#e8b04a' },
  { id: 'astral_nectar', ingredients: ['void_pearl', 'time_sand', 'star_dust'], discovery: { type: 'genMult', target: 'astral_portal', value: 0.5 }, brew: { kind: 'prodBoost', mult: 5, seconds: 300 }, color: '#c77dff' },
  { id: 'alkahest', ingredients: ['time_sand', 'void_pearl', 'dragon_scale'], discovery: { type: 'prodMult', value: 0.15 }, brew: { kind: 'critBoost', mult: 5, seconds: 120 }, color: '#e0e0e0' },
  { id: 'philosophers_stone', ingredients: ['void_pearl', 'time_sand', 'phoenix_feather'], discovery: { type: 'prodMult', value: 1 }, brew: { kind: 'prodBoost', mult: 10, seconds: 600 }, color: '#ff3355' },
];

export const RECIPE_BY_ID = Object.fromEntries(RECIPES.map((r) => [r.id, r])) as Record<string, RecipeDef>;

export const FINAL_RECIPE = 'philosophers_stone';

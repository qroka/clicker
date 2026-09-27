import type { SpriteDef } from './sprite';
import { PORTRAITS_ART } from './portraits';
import { WORLD_ART } from './world';
import { UI_ART } from './ui';
import { SCENE_ART } from './scene';

export const SPRITES: Record<string, SpriteDef> = { ...SCENE_ART, ...UI_ART, ...WORLD_ART, ...PORTRAITS_ART };

// Заливка пола: строки 5–15 тайла bg_floor (без плинтуса) повторяются по вертикали.
SPRITES.bg_floor_fill = { ...SCENE_ART.bg_floor, h: 11, px: SCENE_ART.bg_floor.px.slice(5) };

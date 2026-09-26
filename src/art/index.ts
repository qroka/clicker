import type { SpriteDef } from './sprite';
import { PORTRAITS_ART } from './portraits';
import { WORLD_ART } from './world';
import { UI_ART } from './ui';

export const SPRITES: Record<string, SpriteDef> = { ...UI_ART, ...WORLD_ART, ...PORTRAITS_ART };

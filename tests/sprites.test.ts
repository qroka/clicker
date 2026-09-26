import { describe, expect, it } from 'vitest';
import { SPRITES } from '../src/art';
import { validateSprite } from '../src/art/sprite';
import { PORTRAIT_EXTRA, UI_SPRITES, WORLD_SPRITES } from '../src/art/ids';
import { HEROES } from '../src/data/heroes';
import { TEXTS } from '../src/data/texts';
import { TALENTS, CHALLENGES, UPGRADES, LOGIN_REWARDS, QUEST_TEMPLATES } from '../src/data/progression';
import { ACHIEVEMENTS } from '../src/data/achievements';
import { GENERATORS, INGREDIENTS, LOCATIONS } from '../src/data/world';

describe('пиксельные спрайты', () => {
  it('все спрайты корректны (размеры, цвета палитры)', () => {
    const errs = Object.entries(SPRITES).flatMap(([id, d]) => validateSprite(id, d));
    expect(errs).toEqual([]);
  });

  it('нарисован каждый спрайт из каталога', () => {
    const need = [...Object.keys(UI_SPRITES), ...Object.keys(WORLD_SPRITES), ...Object.keys(PORTRAIT_EXTRA), ...HEROES.map((h) => h.id)];
    expect(need.filter((id) => !SPRITES[id])).toEqual([]);
  });

  it('портреты 24×24, иконки мира и интерфейса 16×16', () => {
    for (const id of [...HEROES.map((h) => h.id), ...Object.keys(PORTRAIT_EXTRA)]) expect([SPRITES[id]?.w, SPRITES[id]?.h], id).toEqual([24, 24]);
    for (const id of [...GENERATORS.map((g) => g.id), ...INGREDIENTS.map((i) => i.id), ...LOCATIONS.map((l) => l.id), ...Object.keys(UI_SPRITES)])
      expect([SPRITES[id]?.w, SPRITES[id]?.h], id).toEqual([16, 16]);
  });

  it('все иконки, на которые ссылаются данные, существуют', () => {
    const refs = [
      ...Object.values(TEXTS.speakers).map((s) => s.icon),
      ...TEXTS.weeklyEvents.map((e) => e.icon),
      ...TALENTS.map((t) => t.icon),
      ...CHALLENGES.map((c) => c.icon),
      ...UPGRADES.map((u) => u.icon),
      ...LOGIN_REWARDS.map((r) => r.icon),
      ...QUEST_TEMPLATES.map((q) => q.icon),
      ...ACHIEVEMENTS.map((a) => a.icon),
    ];
    expect([...new Set(refs)].filter((id) => !SPRITES[id])).toEqual([]);
  });
});

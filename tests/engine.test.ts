import { describe, expect, it } from 'vitest';
import { newGame } from '../src/core/state';
import * as E from '../src/core/engine';
import { GENERATORS, INGREDIENTS, LOCATIONS, RECIPES } from '../src/data/world';
import { HEROES } from '../src/data/heroes';
import { TEXTS } from '../src/data/texts';
import { CHAPTER_THRESHOLDS, TALENTS, UPGRADES } from '../src/data/progression';
import { ACHIEVEMENTS } from '../src/data/achievements';

const T0 = new Date(2026, 8, 28, 12, 0, 0).getTime(); // понедельник
const seq = (...xs: number[]) => {
  let i = 0;
  return () => xs[i++ % xs.length];
};

describe('контент', () => {
  it('рецепты уникальны по набору ингредиентов', () => {
    const keys = RECIPES.map((r) => [...r.ingredients].sort().join('+'));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('тексты покрывают все id механики', () => {
    for (const g of GENERATORS) expect(TEXTS.generators[g.id]?.upgrades).toHaveLength(6);
    for (const i of INGREDIENTS) expect(TEXTS.ingredients[i.id]).toBeTruthy();
    for (const l of LOCATIONS) expect(TEXTS.locations[l.id]).toBeTruthy();
    for (const r of RECIPES) expect(TEXTS.recipes[r.id]).toBeTruthy();
    expect(TEXTS.chapters).toHaveLength(CHAPTER_THRESHOLDS.length);
    expect(TEXTS.weeklyEvents).toHaveLength(7);
  });

  it('все спикеры диалогов определены', () => {
    const lines = [...TEXTS.prologue, ...TEXTS.epilogue, ...TEXTS.transmutation.lines, ...TEXTS.chapters.flatMap((c) => c.intro)];
    for (const l of lines) expect(TEXTS.speakers[l.speaker], l.speaker).toBeTruthy();
  });

  it('30 героев с уникальными id и корректным наймом', () => {
    expect(HEROES).toHaveLength(30);
    expect(new Set(HEROES.map((h) => h.id)).size).toBe(30);
    for (const h of HEROES) {
      expect(h.recruit).toBe(h.rarity === 'common' || h.rarity === 'rare' ? 'gold' : 'shards');
      if (h.bonus.type === 'genMult') expect(h.bonus.target).toBeTruthy();
    }
  });

  it('id улучшений, талантов и достижений уникальны', () => {
    for (const list of [UPGRADES, TALENTS, ACHIEVEMENTS]) expect(new Set(list.map((x) => x.id)).size).toBe(list.length);
  });
});

describe('экономика', () => {
  it('стоимость пачки — сумма геометрической прогрессии', () => {
    const s = newGame(T0);
    const m = E.computeMods(s, T0);
    const one = E.genCost(s, m, 'mortar', 1);
    const ten = E.genCost(s, m, 'mortar', 10);
    let manual = 0;
    for (let i = 0; i < 10; i++) manual += 15 * Math.pow(E.BAL.costGrowth, i) * m.costMult;
    expect(one).toBeCloseTo(15 * m.costMult);
    expect(ten).toBeCloseTo(manual, 6);
  });

  it('maxAffordable никогда не превышает бюджет', () => {
    const s = newGame(T0);
    const m = E.computeMods(s, T0);
    for (const gold of [15, 100, 1234, 1e6, 3.3e9]) {
      s.gold = gold;
      const n = E.maxAffordable(s, m, 'mortar');
      expect(E.genCost(s, m, 'mortar', n)).toBeLessThanOrEqual(gold * (1 + 1e-9));
      expect(E.genCost(s, m, 'mortar', n + 1)).toBeGreaterThan(gold);
    }
  });

  it('вехи удваивают доход постройки', () => {
    const s = newGame(T0);
    s.generators.mortar = 24;
    const a = E.computeMods(s, T0).gen.mortar;
    s.generators.mortar = 25;
    const b = E.computeMods(s, T0).gen.mortar;
    expect(b / a).toBeCloseTo(2);
  });

  it('тап приносит золото, кипение включается после серии тапов', () => {
    const s = newGame(T0);
    const m = E.computeMods(s, T0);
    let boiled = false;
    for (let i = 0; i < 30 && !boiled; i++) boiled = E.tap(s, m, T0, () => 0.99).boiled;
    expect(s.gold).toBeGreaterThan(0);
    expect(boiled).toBe(true);
    const before = E.tapValue(s, m, T0 + 1000);
    expect(before).toBeCloseTo(E.BAL.boilMult * E.BAL.baseTap * m.tapMult);
  });

  it('оффлайн-доход ограничен лимитом', () => {
    const s = newGame(T0);
    s.generators.apprentice = 10;
    const m = E.computeMods(s, T0);
    const gps = E.baseGps(s, m);
    s.lastTick = T0 - 48 * 3600e3;
    const r = E.applyOffline(s, T0)!;
    expect(r.cappedSeconds).toBe(m.offlineCapSec);
    expect(r.gold).toBeCloseTo(gps * m.offlineCapSec * m.offlineRate);
  });

  it('главы открываются по порогам и не откатываются после трансмутации', () => {
    const s = newGame(T0);
    E.earn(s, CHAPTER_THRESHOLDS[4]);
    E.checkChapter(s);
    expect(s.chapter).toBe(5);
    expect(E.canTransmute(s)).toBe(true);
    const gained = E.transmute(s, T0);
    expect(gained).toBe(E.stonesFor(CHAPTER_THRESHOLDS[4]));
    expect(s.chapter).toBe(5);
    expect(s.gold).toBe(0);
    expect(s.generators.mortar).toBe(0);
    expect(E.pendingStones(s)).toBe(0);
  });

  it('goldForNextStone согласован с stonesFor', () => {
    const s = newGame(T0);
    s.allTimeEarned = 5e14;
    const need = E.goldForNextStone(s);
    expect(E.stonesFor(need * 1.0001)).toBe(E.stonesFor(s.allTimeEarned) + 1);
  });

  it('сброс талантов возвращает все камни', () => {
    const s = newGame(T0);
    s.stones = 100;
    E.buyTalent(s, 't_prod1');
    E.buyTalent(s, 't_prod1');
    E.buyTalent(s, 't_cost1');
    expect(s.stones).toBeLessThan(100);
    E.respecTalents(s);
    expect(s.stones).toBe(100);
  });
});

describe('гильдия и лаборатория', () => {
  it('экспедиция: старт, ожидание, сбор добычи', () => {
    const s = newGame(T0);
    s.chapter = 2;
    const h = HEROES.find((x) => x.chapter === 2 && x.recruit === 'gold')!;
    s.gold = E.heroGoldCost(h);
    expect(E.recruitHero(s, h.id)).toBe(true);
    const m = E.computeMods(s, T0);
    expect(E.startExpedition(s, m, 'whispering_woods', 'medium', [h.id], T0, () => 0)).toBe(true);
    expect(E.startExpedition(s, m, 'whispering_woods', 'short', [h.id], T0, () => 0)).toBe(false); // слот и герой заняты
    const uid = s.expeditions[0].uid;
    expect(E.collectExpedition(s, m, uid, T0 + 1000, () => 0.5)).toBeNull();
    const loot = E.collectExpedition(s, m, uid, T0 + 3600e3, () => 0.5)!;
    expect(loot.success).toBe(true);
    expect(Object.values(loot.ingredients).reduce((a, b) => a + (b ?? 0), 0)).toBeGreaterThan(0);
    expect(s.essence).toBeGreaterThan(0);
  });

  it('открытие рецепта даёт постоянный бонус, неудача — подсказку', () => {
    const s = newGame(T0);
    s.chapter = 3;
    s.ingredients.moonpetal = 5;
    s.ingredients.mandrake = 5;
    s.ingredients.glowcap = 5;
    const m = E.computeMods(s, T0);
    const r = E.brew(s, m, ['moonpetal', 'moonpetal', 'mandrake'], T0);
    expect(r).toEqual({ kind: 'discovered', recipe: 'calm_draught' });
    expect(E.computeMods(s, T0).prod).toBeGreaterThan(m.prod);
    const fail = E.brew(s, m, ['glowcap', 'moonpetal', 'moonpetal'], T0);
    expect(fail.kind).toBe('failed');
    if (fail.kind === 'failed') expect(fail.closest).toBeGreaterThanOrEqual(2);
  });

  it('Философский камень заблокирован до главы 8 и без казны', () => {
    const s = newGame(T0);
    s.chapter = 7;
    s.ingredients.void_pearl = 1;
    s.ingredients.time_sand = 1;
    s.ingredients.phoenix_feather = 1;
    const m = E.computeMods(s, T0);
    expect(E.brew(s, m, ['void_pearl', 'time_sand', 'phoenix_feather'], T0).kind).toBe('locked');
    s.chapter = 8;
    expect(E.brew(s, m, ['void_pearl', 'time_sand', 'phoenix_feather'], T0).kind).toBe('locked');
    s.gold = E.BAL.finalCost;
    expect(E.brew(s, m, ['void_pearl', 'time_sand', 'phoenix_feather'], T0).kind).toBe('discovered');
    expect(s.finalDone).toBe(true);
  });
});

describe('ежедневное', () => {
  it('серия растёт по дням подряд и сбрасывается при пропуске', () => {
    const s = newGame(T0);
    const m = E.computeMods(s, T0);
    const r = seq(0.1, 0.5, 0.9);
    E.rollDaily(s, m, T0, r);
    expect(s.daily.streak).toBe(1);
    expect(s.daily.quests).toHaveLength(3);
    expect(E.rollDaily(s, m, T0 + 3600e3, r)).toBe(false);
    E.rollDaily(s, m, T0 + 86400e3, r);
    expect(s.daily.streak).toBe(2);
    E.rollDaily(s, m, T0 + 3 * 86400e3, r);
    expect(s.daily.streak).toBe(1);
    expect(s.daily.bestStreak).toBe(2);
  });

  it('награда за вход — один раз в день', () => {
    const s = newGame(T0);
    const m = E.computeMods(s, T0);
    E.rollDaily(s, m, T0, Math.random);
    expect(E.claimLogin(s, m, T0, Math.random)).toBe(true);
    expect(E.claimLogin(s, m, T0 + 1000, Math.random)).toBe(false);
    expect(s.gold).toBeGreaterThan(0);
  });

  it('задание засчитывается и забирается', () => {
    const s = newGame(T0);
    const m = E.computeMods(s, T0);
    E.rollDaily(s, m, T0, Math.random);
    s.daily.quests = [{ kind: 'taps', target: 3, progress: 0, claimed: false }];
    for (let i = 0; i < 3; i++) E.tap(s, m, T0, () => 0.99);
    expect(E.claimQuest(s, 0, Math.random)).toBe(true);
    expect(s.essence).toBeGreaterThan(0);
    expect(E.claimQuest(s, 0, Math.random)).toBe(false);
  });
});

describe('защита от эксплойтов', () => {
  it('зелье ускорения действует на экспедицию только один раз', () => {
    const s = newGame(T0);
    s.chapter = 4;
    const h = HEROES.find((x) => x.chapter === 2 && x.recruit === 'gold')!;
    s.heroes[h.id] = { recruited: true, level: 1, shards: 0 };
    s.ingredients.kraken_ink = 10;
    s.ingredients.void_pearl = 5;
    const m = E.computeMods(s, T0);
    E.startExpedition(s, m, 'whispering_woods', 'long', [h.id], T0, () => 0);
    const end0 = s.expeditions[0].end;
    E.brew(s, m, ['kraken_ink', 'kraken_ink', 'void_pearl'], T0);
    const end1 = s.expeditions[0].end;
    expect(end1).toBeLessThan(end0);
    E.brew(s, m, ['kraken_ink', 'kraken_ink', 'void_pearl'], T0);
    expect(s.expeditions[0].end).toBe(end1);
  });

  it('зелья мгновенного дохода имеют перезарядку', () => {
    const s = newGame(T0);
    s.chapter = 5;
    s.generators.apprentice = 10;
    s.ingredients.kraken_ink = 5;
    s.ingredients.moonpetal = 5;
    s.ingredients.glowcap = 5;
    const m = E.computeMods(s, T0);
    E.brew(s, m, ['kraken_ink', 'moonpetal', 'glowcap'], T0);
    const g1 = s.gold;
    expect(g1).toBeGreaterThan(0);
    E.brew(s, m, ['kraken_ink', 'moonpetal', 'glowcap'], T0 + 1000);
    expect(s.gold).toBe(g1);
    E.brew(s, m, ['kraken_ink', 'moonpetal', 'glowcap'], T0 + (E.BAL.goldRushCooldownSec + 1) * 1000);
    expect(s.gold).toBeGreaterThan(g1);
  });

  it('перевод часов назад не даёт новый день', () => {
    const s = newGame(T0);
    const m = E.computeMods(s, T0);
    E.rollDaily(s, m, T0 + 86400e3, Math.random);
    expect(E.rollDaily(s, m, T0, Math.random)).toBe(false);
    expect(s.daily.streak).toBe(1);
  });

  it('перегонка превращает ингредиенты в эссенцию', () => {
    const s = newGame(T0);
    s.ingredients.void_pearl = 3;
    expect(E.distill(s, 'void_pearl', 10)).toBe(3 * E.BAL.distillEssence.legendary);
    expect(s.ingredients.void_pearl).toBe(0);
  });

  it('бонус камней не пропадает при покупке талантов', () => {
    const s = newGame(T0);
    s.stones = 50;
    s.stonesEarned = 50;
    const before = E.computeMods(s, T0).prod;
    E.buyTalent(s, 't_tap1');
    expect(E.computeMods(s, T0).prod).toBeCloseTo(before);
  });
});


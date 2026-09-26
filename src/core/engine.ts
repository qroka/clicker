// Игровой движок: чистые функции над GameState. Никакого DOM — используется и в UI, и в симуляции баланса.

import type { BonusType, GeneratorId, HeroDef, IngredientId, LocationId, Rarity } from './types';
import type { BuffKind, Expedition, GameState, Quest } from './state';
import { newGame } from './state';
import { EXPEDITION_DURATIONS, FINAL_RECIPE, GENERATORS, GEN_BY_ID, ING_BY_ID, LOCATIONS, LOC_BY_ID, RECIPES } from '../data/world';
import {
  CHALLENGE_BY_ID,
  CHALLENGE_MAX,
  CHALLENGES,
  CHAPTER_THRESHOLDS,
  FEATURE_CHAPTER,
  LOGIN_REWARDS,
  MILESTONES,
  QUEST_REWARD,
  QUEST_TEMPLATES,
  QUESTS_ALL_BONUS,
  TALENT_BY_ID,
  TALENTS,
  UPGRADE_BY_ID,
  UPGRADES,
  WEEKDAY_EFFECTS,
  challengeGoal,
  type QuestKind,
  type UpgradeDef,
} from '../data/progression';
import { ACHIEVEMENTS, ACHIEVEMENT_BONUS } from '../data/achievements';
import { HEROES } from '../data/heroes';

export type Rng = () => number;

// ─── Константы баланса ───────────────────────────────────────────────────────

export const BAL = {
  costGrowth: 1.15,
  baseTap: 1,
  baseCritChance: 0.05,
  baseCritMult: 5,
  heatPerTap: 4.5,
  heatDecayPerSec: 10,
  boilSeconds: 8,
  boilMult: 3,
  wispMinSec: 70,
  wispMaxSec: 160,
  wispLifeSec: 13,
  offlineBaseHours: 4,
  offlineRate: 0.5,
  stoneBase: 1e11,
  stoneExp: 1 / 3,
  finalCost: 3e25,
  goldRushCooldownSec: 600,
  wispGoldSeconds: 240,
  distillEssence: { common: 1, rare: 3, epic: 8, legendary: 20 } as Record<Rarity, number>,
  stoneBonus: 0.01,
  heroBonusPerRecruit: 0.03,
  maxHeroLevel: 50,
  heroShardsNeeded: { common: 10, rare: 15, epic: 25, legendary: 30 } as Record<Rarity, number>,
  heroGoldCostBase: 5e3,
  heroEssenceBase: { common: 8, rare: 14, epic: 24, legendary: 40 } as Record<Rarity, number>,
  heroEssenceGrowth: 1.28,
  heroPower: { common: 5, rare: 8, epic: 12, legendary: 18 } as Record<Rarity, number>,
  rarityMult: { common: 1, rare: 1.6, epic: 2.5, legendary: 4 } as Record<Rarity, number>,
};

/** Величина бонуса героя за 1 уровень при редкости common. */
const HERO_BONUS_PER_LEVEL: Record<BonusType, number> = {
  tapMult: 0.1,
  prodMult: 0.03,
  genMult: 0.15,
  critChance: 0.003,
  critMult: 0.05,
  expeditionSpeed: 0.008,
  expeditionLoot: 0.03,
  wispBonus: 0.05,
  offlineMult: 0.04,
  costReduction: 0.002,
  essenceMult: 0.03,
};

export const HERO_BY_ID = Object.fromEntries(HEROES.map((h) => [h.id, h])) as Record<string, HeroDef>;

// ─── Модификаторы ────────────────────────────────────────────────────────────

export interface Mods {
  prod: number; // общий множитель пассивного дохода (без временных баффов)
  gen: Record<GeneratorId, number>; // множитель по постройкам (вехи, улучшения, бонусы)
  tapUp: number; // множитель улучшений тапа (к базовой части)
  tapMult: number; // общий множитель тапа (герои, таланты, рецепты, день недели)
  tapPct: number;
  critChance: number;
  critMult: number;
  costMult: number;
  expSpeed: number; // множитель длительности (<1 — быстрее)
  expLoot: number;
  wisp: number;
  offlineRate: number;
  offlineCapSec: number;
  essence: number;
  heroCost: number;
  rareLoot: number;
  wispFreq: number;
}

type Pool = Record<BonusType, number>;
const emptyPool = (): Pool => ({
  tapMult: 0,
  prodMult: 0,
  genMult: 0,
  critChance: 0,
  critMult: 0,
  expeditionSpeed: 0,
  expeditionLoot: 0,
  wispBonus: 0,
  offlineMult: 0,
  costReduction: 0,
  essenceMult: 0,
});

export function heroBonusValue(h: HeroDef, level: number): number {
  return HERO_BONUS_PER_LEVEL[h.bonus.type] * BAL.rarityMult[h.rarity] * level;
}

export function weekdayEffects(now: number) {
  return WEEKDAY_EFFECTS[new Date(now).getDay()] ?? {};
}

export function isRule(s: GameState, rule: string): boolean {
  return !!s.challenge && CHALLENGE_BY_ID[s.challenge]?.rule === rule;
}

export function computeMods(s: GameState, now: number): Mods {
  const genExtra: Partial<Record<GeneratorId, number>>[] = [];
  const sources: Pool[] = [];

  // Герои
  const heroes = emptyPool();
  const heroGen: Partial<Record<GeneratorId, number>> = {};
  let recruited = 0;
  if (!isRule(s, 'noHeroes')) {
    for (const h of HEROES) {
      const st = s.heroes[h.id];
      if (!st?.recruited) continue;
      recruited++;
      const v = heroBonusValue(h, st.level);
      if (h.bonus.type === 'genMult' && h.bonus.target) heroGen[h.bonus.target] = (heroGen[h.bonus.target] ?? 0) + v;
      else heroes[h.bonus.type] += v;
    }
  }
  sources.push(heroes);
  genExtra.push(heroGen);

  // Рецепты
  const rec = emptyPool();
  const recGen: Partial<Record<GeneratorId, number>> = {};
  for (const id of s.recipesKnown) {
    const r = RECIPES.find((x) => x.id === id);
    if (!r) continue;
    if (r.discovery.type === 'genMult' && r.discovery.target) recGen[r.discovery.target] = (recGen[r.discovery.target] ?? 0) + r.discovery.value;
    else rec[r.discovery.type] += r.discovery.value;
  }
  sources.push(rec);
  genExtra.push(recGen);

  // Таланты
  const weak = isRule(s, 'weakStart');
  const tal = emptyPool();
  const talGen: Partial<Record<GeneratorId, number>> = {};
  let offlineTalentLv = 0;
  if (!weak) {
    for (const t of TALENTS) {
      const lv = s.talents[t.id] ?? 0;
      if (!lv) continue;
      if (t.bonus.type === 'offlineMult') offlineTalentLv += lv;
      if (t.bonus.type === 'genMult' && t.bonus.target) talGen[t.bonus.target] = (talGen[t.bonus.target] ?? 0) + t.bonus.value * lv;
      else tal[t.bonus.type] += t.bonus.value * lv;
    }
  }
  sources.push(tal);
  genExtra.push(talGen);

  // Испытания
  const ch = emptyPool();
  for (const c of CHALLENGES) {
    const n = s.challengeDone[c.id] ?? 0;
    if (n) ch[c.reward.type] += c.reward.value * n;
  }
  sources.push(ch);

  const mulOf = (type: BonusType) => sources.reduce((m, p) => m * (1 + p[type]), 1);
  // Второстепенные бонусы складываются, а не перемножаются — иначе к концу игры они разгоняются в десятки раз.
  const addOf = (type: BonusType) => 1 + sources.reduce((m, p) => m + p[type], 0);
  const sumOf = (type: BonusType) => sources.reduce((m, p) => m + p[type], 0);

  // Постройки: вехи и улучшения
  const gen = {} as Record<GeneratorId, number>;
  const bought = new Set(s.upgrades);
  for (const g of GENERATORS) {
    const owned = s.generators[g.id];
    let m = 1;
    for (const ms of MILESTONES) if (owned >= ms) m *= 2;
    for (const e of genExtra) if (e[g.id]) m *= 1 + e[g.id]!;
    gen[g.id] = m;
  }

  let prodUp = 1;
  let tapUp = 1;
  let tapPct = 0;
  let critUp = 0;
  for (const id of bought) {
    const u = UPGRADE_BY_ID[id];
    if (!u) continue;
    const e = u.effect;
    if (e.kind === 'gen') gen[e.gen] *= e.mult;
    else if (e.kind === 'prod') prodUp *= e.mult;
    else if (e.kind === 'tap') tapUp *= e.mult;
    else if (e.kind === 'tapPct') tapPct += e.pct;
    else if (e.kind === 'crit') critUp += e.chance;
  }

  // Бонус считается от всех заработанных камней: тратить их на таланты не наказывается.
  const stones = weak ? 0 : s.stonesEarned;
  const achievements = 1 + s.achievements.length * ACHIEVEMENT_BONUS;
  const guild = 1 + recruited * BAL.heroBonusPerRecruit;
  const final = s.finalDone ? 2 : 1;
  const prod = mulOf('prodMult') * prodUp * (1 + stones * BAL.stoneBonus) * achievements * guild * final;

  const wd = weekdayEffects(now);
  const costRed = Math.min(0.5, sumOf('costReduction'));
  let costMult = (1 - costRed) * (wd.costMult ?? 1);
  if (isRule(s, 'expensive')) costMult *= 10;

  return {
    prod,
    gen,
    tapUp,
    tapMult: addOf('tapMult') * (wd.tapMult ?? 1),
    tapPct,
    critChance: Math.min(0.6, BAL.baseCritChance + critUp + sumOf('critChance')),
    critMult: BAL.baseCritMult * addOf('critMult'),
    costMult,
    expSpeed: Math.max(0.3, 1 - sumOf('expeditionSpeed')) * (wd.expSpeed ?? 1),
    expLoot: addOf('expeditionLoot'),
    wisp: addOf('wispBonus'),
    offlineRate: Math.min(1, BAL.offlineRate * addOf('offlineMult')) * (wd.offlineMult ?? 1),
    offlineCapSec: (BAL.offlineBaseHours + offlineTalentLv) * 3600,
    essence: addOf('essenceMult'),
    heroCost: wd.heroCost ?? 1,
    rareLoot: wd.rareLoot ?? 1,
    wispFreq: wd.wispFreq ?? 1,
  };
}

// ─── Доход ───────────────────────────────────────────────────────────────────

export function genAvailable(s: GameState, id: GeneratorId): boolean {
  if (isRule(s, 'fewGens')) return GENERATORS.findIndex((g) => g.id === id) < 6;
  return true;
}

export function genProd(s: GameState, m: Mods, id: GeneratorId): number {
  return s.generators[id] * GEN_BY_ID[id].baseProd * m.gen[id] * m.prod;
}

function buffMult(s: GameState, kind: BuffKind, now: number): number {
  const b = s.buffs[kind];
  return b && b.until > now ? b.mult : 1;
}

/** Доход в секунду без временных баффов. */
export function baseGps(s: GameState, m: Mods): number {
  let total = 0;
  for (const g of GENERATORS) total += genProd(s, m, g.id);
  return total;
}

export function prodBuffMult(s: GameState, now: number): number {
  return buffMult(s, 'prodBoost', now) * buffMult(s, 'frenzy', now);
}

export function gps(s: GameState, m: Mods, now: number): number {
  return baseGps(s, m) * prodBuffMult(s, now);
}

export function tapValue(s: GameState, m: Mods, now: number): number {
  const base = (BAL.baseTap * m.tapUp + gps(s, m, now) * m.tapPct) * m.tapMult;
  return base * buffMult(s, 'tapBoost', now) * buffMult(s, 'tapStorm', now) * buffMult(s, 'boil', now);
}

// ─── Покупки ─────────────────────────────────────────────────────────────────

export function genCost(s: GameState, m: Mods, id: GeneratorId, count = 1): number {
  const g = GEN_BY_ID[id];
  const owned = s.generators[id];
  const r = BAL.costGrowth;
  const first = g.baseCost * Math.pow(r, owned);
  return (first * (Math.pow(r, count) - 1)) / (r - 1) * m.costMult;
}

export function maxAffordable(s: GameState, m: Mods, id: GeneratorId): number {
  const g = GEN_BY_ID[id];
  const r = BAL.costGrowth;
  const first = g.baseCost * Math.pow(r, s.generators[id]) * m.costMult;
  if (s.gold < first) return 0;
  return Math.floor(Math.log((s.gold * (r - 1)) / first + 1) / Math.log(r));
}

export function buyGenerator(s: GameState, m: Mods, id: GeneratorId, count: number): number {
  if (!genAvailable(s, id)) return 0;
  let n = Math.min(count, maxAffordable(s, m, id));
  if (n <= 0) return 0;
  let cost = genCost(s, m, id, n);
  if (cost > s.gold && n > 1) cost = genCost(s, m, id, --n); // погрешность округления
  if (cost > s.gold) return 0;
  s.gold -= cost;
  s.generators[id] += n;
  s.stats.gensBought += n;
  questProgress(s, 'buyGens', n);
  return n;
}

export function upgradeVisible(s: GameState, u: UpgradeDef): boolean {
  if (s.upgrades.includes(u.id)) return false;
  const r = u.req;
  if ('gen' in r) return s.generators[r.gen] >= r.owned && genAvailable(s, r.gen);
  if ('taps' in r) return s.stats.runTaps >= r.taps || s.runEarned >= u.cost / 2;
  return s.runEarned >= r.earned;
}

export function availableUpgrades(s: GameState): UpgradeDef[] {
  return UPGRADES.filter((u) => upgradeVisible(s, u)).sort((a, b) => a.cost - b.cost);
}

export function buyUpgrade(s: GameState, id: string): boolean {
  const u = UPGRADE_BY_ID[id];
  if (!u || !upgradeVisible(s, u) || s.gold < u.cost) return false;
  s.gold -= u.cost;
  s.upgrades.push(id);
  s.stats.upgradesBought++;
  questProgress(s, 'upgrades', 1);
  return true;
}

// ─── Тап ─────────────────────────────────────────────────────────────────────

export interface TapResult {
  gold: number;
  crit: boolean;
  boiled: boolean;
}

export function tap(s: GameState, m: Mods, now: number, rng: Rng): TapResult {
  if (isRule(s, 'noTap')) return { gold: 0, crit: false, boiled: false };
  const crit = rng() < m.critChance * buffMult(s, 'critBoost', now);
  let value = tapValue(s, m, now);
  if (crit) {
    value *= m.critMult;
    s.stats.crits++;
  }
  earn(s, value);
  s.stats.taps++;
  s.stats.runTaps++;
  questProgress(s, 'taps', 1);

  let boiled = false;
  const boiling = (s.buffs.boil?.until ?? 0) > now;
  if (!boiling && !isRule(s, 'noBuffs')) {
    s.heat = Math.min(100, s.heat + BAL.heatPerTap);
    if (s.heat >= 100) {
      s.heat = 0;
      s.buffs.boil = { mult: BAL.boilMult, until: now + BAL.boilSeconds * 1000 };
      s.stats.boils++;
      boiled = true;
    }
  }
  return { gold: value, crit, boiled };
}

export function earn(s: GameState, amount: number): void {
  s.gold += amount;
  s.runEarned += amount;
  s.allTimeEarned += amount;
  questProgress(s, 'earn', amount);
}

// ─── Тик ─────────────────────────────────────────────────────────────────────

export interface TickEvents {
  chapterUp?: number;
  achievements: string[];
  expeditionsDone: number;
  challengeDone?: string;
}

export function tick(s: GameState, now: number, rng: Rng): TickEvents {
  const dt = Math.max(0, Math.min(10, (now - s.lastTick) / 1000));
  s.lastTick = now;
  const m = computeMods(s, now);
  const g = gps(s, m, now);
  if (dt > 0) {
    earn(s, g * dt);
    s.stats.playSeconds += dt;
    s.heat = Math.max(0, s.heat - BAL.heatDecayPerSec * dt);
  }
  const base = baseGps(s, m);
  if (base > s.stats.bestGps) s.stats.bestGps = base;

  // Искры
  if (s.wisp && s.wisp.expires <= now) s.wisp = null;
  const noBuffs = isRule(s, 'noBuffs');
  if (!s.wisp && !noBuffs && now >= s.nextWispAt) {
    s.wisp = { x: 0.12 + rng() * 0.76, y: 0.18 + rng() * 0.5, born: now, expires: now + BAL.wispLifeSec * 1000 };
    scheduleWisp(s, m, now, rng);
  }

  // Истёкшие баффы
  for (const k of Object.keys(s.buffs) as BuffKind[]) if ((s.buffs[k]?.until ?? 0) <= now) delete s.buffs[k];

  const ev: TickEvents = { achievements: [], expeditionsDone: 0 };
  const ch = checkChapter(s);
  if (ch) ev.chapterUp = ch;
  ev.achievements = checkAchievements(s);
  if (s.challenge) {
    const c = CHALLENGE_BY_ID[s.challenge];
    if (c && s.runEarned >= challengeGoal(c, s.challengeDone[c.id] ?? 0)) {
      s.challengeDone[c.id] = (s.challengeDone[c.id] ?? 0) + 1;
      ev.challengeDone = c.id;
      s.challenge = null;
    }
  }
  return ev;
}

export function scheduleWisp(s: GameState, m: Mods, now: number, rng: Rng): void {
  const rain = (s.buffs.wispRain?.until ?? 0) > now;
  const sec = rain ? 3 + rng() * 3 : (BAL.wispMinSec + rng() * (BAL.wispMaxSec - BAL.wispMinSec)) / m.wispFreq;
  s.nextWispAt = now + sec * 1000;
}

export function checkChapter(s: GameState): number | undefined {
  let up: number | undefined;
  while (s.chapter < CHAPTER_THRESHOLDS.length && s.runEarned >= CHAPTER_THRESHOLDS[s.chapter]) {
    s.chapter++;
    up = s.chapter;
  }
  return up;
}

export function checkAchievements(s: GameState): string[] {
  const have = new Set(s.achievements);
  const got: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (!have.has(a.id) && a.check(s)) {
      s.achievements.push(a.id);
      got.push(a.id);
    }
  }
  return got;
}

// ─── Искры ───────────────────────────────────────────────────────────────────

export type WispReward =
  | { kind: 'gold'; amount: number }
  | { kind: 'frenzy'; mult: number; seconds: number }
  | { kind: 'tapStorm'; mult: number; seconds: number }
  | { kind: 'essence'; amount: number };

export function catchWisp(s: GameState, m: Mods, now: number, rng: Rng): WispReward | null {
  if (!s.wisp) return null;
  s.wisp = null;
  s.stats.wisps++;
  questProgress(s, 'wisps', 1);
  const r = rng();
  const guild = s.chapter >= FEATURE_CHAPTER.guild;
  if (r < 0.5) {
    const amount = Math.max(baseGps(s, m) * BAL.wispGoldSeconds, tapValue(s, m, now) * 60, 25) * m.wisp;
    earn(s, amount);
    return { kind: 'gold', amount };
  }
  if (r < 0.75) {
    const seconds = Math.round(45 * Math.sqrt(m.wisp));
    s.buffs.frenzy = { mult: 7, until: now + seconds * 1000 };
    return { kind: 'frenzy', mult: 7, seconds };
  }
  if (r < 0.9 || !guild) {
    const seconds = Math.round(20 * Math.sqrt(m.wisp));
    s.buffs.tapStorm = { mult: 10, until: now + seconds * 1000 };
    return { kind: 'tapStorm', mult: 10, seconds };
  }
  const amount = Math.round((8 + s.chapter * 3) * m.essence * m.wisp);
  s.essence += amount;
  return { kind: 'essence', amount };
}

// ─── Оффлайн ─────────────────────────────────────────────────────────────────

export interface OfflineReport {
  seconds: number;
  cappedSeconds: number;
  gold: number;
  expeditionsReady: number;
}

export function applyOffline(s: GameState, now: number): OfflineReport | null {
  const away = (now - s.lastTick) / 1000;
  if (away <= 0) return null;
  const m = computeMods(s, now);
  if (away < 60) {
    // Короткое переключение приложений: считаем, будто игрок никуда не уходил.
    earn(s, baseGps(s, m) * away);
    s.lastTick = now;
    return null;
  }
  const capped = Math.min(away, m.offlineCapSec);
  const gold = baseGps(s, m) * capped * m.offlineRate;
  earn(s, gold);
  s.lastTick = now;
  s.heat = 0;
  s.wisp = null;
  s.nextWispAt = now + 20_000;
  checkChapter(s);
  return { seconds: away, cappedSeconds: capped, gold, expeditionsReady: s.expeditions.filter((e) => e.end <= now).length };
}

// ─── Герои ───────────────────────────────────────────────────────────────────

export function heroUnlocked(s: GameState, h: HeroDef): boolean {
  return s.chapter >= FEATURE_CHAPTER.guild && s.chapter >= h.chapter;
}

export function heroGoldCost(h: HeroDef): number {
  return BAL.heroGoldCostBase * Math.pow(1000, h.chapter - 2) * BAL.rarityMult[h.rarity];
}

export function heroState(s: GameState, id: string) {
  return (s.heroes[id] ??= { recruited: false, level: 0, shards: 0 });
}

export function canRecruit(s: GameState, h: HeroDef): boolean {
  const st = s.heroes[h.id];
  if (st?.recruited || !heroUnlocked(s, h)) return false;
  if (h.recruit === 'gold') return s.gold >= heroGoldCost(h);
  return (st?.shards ?? 0) >= BAL.heroShardsNeeded[h.rarity];
}

export function recruitHero(s: GameState, id: string): boolean {
  const h = HERO_BY_ID[id];
  if (!h || !canRecruit(s, h)) return false;
  const st = heroState(s, id);
  if (h.recruit === 'gold') s.gold -= heroGoldCost(h);
  else st.shards -= BAL.heroShardsNeeded[h.rarity];
  st.recruited = true;
  st.level = 1;
  return true;
}

export function heroLevelCost(s: GameState, m: Mods, h: HeroDef): number {
  const lv = s.heroes[h.id]?.level ?? 1;
  return Math.ceil(BAL.heroEssenceBase[h.rarity] * Math.pow(BAL.heroEssenceGrowth, lv - 1) * m.heroCost);
}

export function levelUpHero(s: GameState, m: Mods, id: string): boolean {
  const h = HERO_BY_ID[id];
  const st = s.heroes[id];
  if (!h || !st?.recruited || st.level >= BAL.maxHeroLevel) return false;
  const cost = heroLevelCost(s, m, h);
  if (s.essence < cost) return false;
  s.essence -= cost;
  st.level++;
  s.stats.heroLevels++;
  questProgress(s, 'heroLevels', 1);
  return true;
}

export function heroPower(s: GameState, id: string, loc?: LocationId): number {
  const h = HERO_BY_ID[id];
  const st = s.heroes[id];
  if (!h || !st?.recruited) return 0;
  const favored = loc && LOC_BY_ID[loc].favoredRole === h.role ? 1.5 : 1;
  return BAL.heroPower[h.rarity] * (1 + 0.15 * (st.level - 1)) * favored;
}

// ─── Экспедиции ──────────────────────────────────────────────────────────────

export function expeditionSlots(s: GameState): number {
  if (s.chapter < FEATURE_CHAPTER.expeditions) return 0;
  return 1 + (s.chapter >= 4 ? 1 : 0) + (s.chapter >= 6 ? 1 : 0);
}

export function busyHeroes(s: GameState): Set<string> {
  return new Set(s.expeditions.flatMap((e) => e.heroes));
}

export function successChance(s: GameState, loc: LocationId, heroes: string[]): number {
  const power = heroes.reduce((a, id) => a + heroPower(s, id, loc), 0);
  return Math.min(1, 0.3 + (0.7 * power) / LOC_BY_ID[loc].power);
}

export function expeditionSeconds(m: Mods, dur: Expedition['duration']): number {
  const d = EXPEDITION_DURATIONS.find((x) => x.id === dur)!;
  return Math.round(d.seconds * m.expSpeed);
}

export function startExpedition(s: GameState, m: Mods, loc: LocationId, dur: Expedition['duration'], heroes: string[], now: number, rng: Rng): boolean {
  if (s.expeditions.length >= expeditionSlots(s)) return false;
  if (LOC_BY_ID[loc].chapter > s.chapter) return false;
  if (!heroes.length || heroes.length > 3) return false;
  const busy = busyHeroes(s);
  if (heroes.some((h) => busy.has(h) || !s.heroes[h]?.recruited)) return false;
  const success = rng() < successChance(s, loc, heroes);
  s.expeditions.push({ uid: s.nextExpUid++, location: loc, duration: dur, heroes: [...heroes], start: now, end: now + expeditionSeconds(m, dur) * 1000, success });
  questProgress(s, 'expeditions', 1);
  return true;
}

export interface ExpeditionLoot {
  success: boolean;
  ingredients: Partial<Record<IngredientId, number>>;
  essence: number;
  shards: { hero: string; n: number }[];
}

export function collectExpedition(s: GameState, m: Mods, uid: number, now: number, rng: Rng): ExpeditionLoot | null {
  const idx = s.expeditions.findIndex((e) => e.uid === uid);
  if (idx < 0) return null;
  const e = s.expeditions[idx];
  if (e.end > now) return null;
  s.expeditions.splice(idx, 1);
  s.stats.expeditions++;
  const d = EXPEDITION_DURATIONS.find((x) => x.id === e.duration)!;
  const loc = LOC_BY_ID[e.location];
  const loot: ExpeditionLoot = { success: e.success, ingredients: {}, essence: 0, shards: [] };

  const essence = Math.round(d.essence * (1 + loc.chapter * 0.25) * m.essence * (e.success ? 1 : 0.35));
  loot.essence = essence;
  s.essence += essence;
  if (!e.success) return loot;

  const count = Math.max(1, Math.round(d.loot * 1.5 * m.expLoot * (0.8 + rng() * 0.4)));
  const rareChance = { short: 0.1, medium: 0.16, long: 0.22 }[e.duration] * m.rareLoot;
  for (let i = 0; i < count; i++) {
    const ing = rng() < rareChance ? loc.drops[1] : loc.drops[0];
    loot.ingredients[ing] = (loot.ingredients[ing] ?? 0) + 1;
    s.ingredients[ing] = (s.ingredients[ing] ?? 0) + 1;
  }

  // Осколки контрактов
  const shardRolls = { short: 0, medium: 1, long: 3 }[e.duration];
  for (let i = 0; i < shardRolls; i++) {
    if (e.duration === 'medium' && rng() > 0.5) continue;
    const got = grantShards(s, 1 + Math.floor(rng() * 2), rng);
    if (got) loot.shards.push(got);
  }
  return loot;
}

export function grantShards(s: GameState, n: number, rng: Rng): { hero: string; n: number } | null {
  const pool = HEROES.filter((h) => h.recruit === 'shards' && heroUnlocked(s, h) && !s.heroes[h.id]?.recruited);
  if (!pool.length) {
    // Все собраны — осколки превращаются в эссенцию.
    s.essence += n * 10;
    return null;
  }
  // Половина осколков идёт герою, который ближе всех к найму, — чтобы контракты закрывались, а не размазывались.
  const top = pool.reduce((a, b) => ((s.heroes[b.id]?.shards ?? 0) > (s.heroes[a.id]?.shards ?? 0) ? b : a));
  const h = rng() < 0.5 ? top : pool[Math.floor(rng() * pool.length)];
  heroState(s, h.id).shards += n;
  return { hero: h.id, n };
}

// ─── Рецепты ─────────────────────────────────────────────────────────────────

const key = (ings: string[]) => [...ings].sort().join('+');

export type BrewResult =
  | { kind: 'discovered' | 'brewed'; recipe: string }
  | { kind: 'failed'; closest: number }
  | { kind: 'locked' }
  | { kind: 'missing' };

export function brew(s: GameState, m: Mods, ings: IngredientId[], now: number): BrewResult {
  if (ings.length !== 3) return { kind: 'missing' };
  const need: Partial<Record<IngredientId, number>> = {};
  for (const i of ings) need[i] = (need[i] ?? 0) + 1;
  for (const [i, n] of Object.entries(need)) if ((s.ingredients[i as IngredientId] ?? 0) < n!) return { kind: 'missing' };

  const k = key(ings);
  const recipe = RECIPES.find((r) => key(r.ingredients) === k);
  if (recipe?.id === FINAL_RECIPE && (s.chapter < 8 || s.gold < BAL.finalCost)) return { kind: 'locked' };
  if (recipe?.id === FINAL_RECIPE) s.gold -= BAL.finalCost;

  for (const [i, n] of Object.entries(need)) s.ingredients[i as IngredientId] -= n!;

  if (!recipe) {
    // Подсказка в духе «быков и коров»: сколько ингредиентов совпало с лучшим неоткрытым рецептом.
    let closest = 0;
    for (const r of RECIPES) {
      if (s.recipesKnown.includes(r.id)) continue;
      const pool = [...r.ingredients] as string[];
      let hit = 0;
      for (const i of ings) {
        const j = pool.indexOf(i);
        if (j >= 0) {
          hit++;
          pool.splice(j, 1);
        }
      }
      closest = Math.max(closest, hit);
    }
    s.essence += 3;
    return { kind: 'failed', closest };
  }

  s.stats.brews++;
  questProgress(s, 'brew', 1);
  const discovered = !s.recipesKnown.includes(recipe.id);
  if (discovered) s.recipesKnown.push(recipe.id);
  if (recipe.id === FINAL_RECIPE) s.finalDone = true;
  applyBrew(s, m, recipe.brew, now);
  return { kind: discovered ? 'discovered' : 'brewed', recipe: recipe.id };
}

function applyBrew(s: GameState, m: Mods, b: (typeof RECIPES)[number]['brew'], now: number) {
  const noBuffs = isRule(s, 'noBuffs');
  const setBuff = (k: BuffKind) => {
    if (noBuffs) return;
    const cur = s.buffs[k];
    const until = Math.max(cur?.until ?? now, now) + b.seconds * 1000;
    s.buffs[k] = { mult: Math.max(cur && cur.until > now ? cur.mult : 1, b.mult), until };
  };
  switch (b.kind) {
    case 'prodBoost':
    case 'tapBoost':
    case 'critBoost':
    case 'wispRain':
      setBuff(b.kind);
      if (b.kind === 'wispRain') s.nextWispAt = now + 1000;
      break;
    case 'haste':
      for (const e of s.expeditions) {
        if (e.hasted) continue;
        e.hasted = true;
        e.end = Math.max(now, e.end - b.seconds * 1000);
      }
      break;
    case 'goldRush':
      if (now >= (s.goldRushReadyAt ?? 0)) {
        earn(s, baseGps(s, m) * b.mult * 60);
        s.goldRushReadyAt = now + BAL.goldRushCooldownSec * 1000;
      }
      break;
  }
}

export function canBrewKnown(s: GameState, id: string): boolean {
  const r = RECIPES.find((x) => x.id === id);
  if (!r) return false;
  const need: Record<string, number> = {};
  for (const i of r.ingredients) need[i] = (need[i] ?? 0) + 1;
  return Object.entries(need).every(([i, n]) => (s.ingredients[i as IngredientId] ?? 0) >= n);
}

export const ingredientRarity = (id: IngredientId) => ING_BY_ID[id].rarity;

/** Перегонка лишних ингредиентов в эссенцию — сток для накоплений. */
export function distill(s: GameState, id: IngredientId, n: number): number {
  const have = s.ingredients[id] ?? 0;
  const k = Math.min(have, Math.max(0, Math.floor(n)));
  if (!k) return 0;
  s.ingredients[id] -= k;
  const got = k * BAL.distillEssence[ING_BY_ID[id].rarity];
  s.essence += got;
  return got;
}

// ─── Трансмутация (престиж) ──────────────────────────────────────────────────

export function stonesFor(allTime: number): number {
  return Math.floor(Math.pow(allTime / BAL.stoneBase, BAL.stoneExp) * 2);
}

export function pendingStones(s: GameState): number {
  return Math.max(0, stonesFor(s.allTimeEarned) - s.stonesEarned);
}

/** Сколько всего золота нужно для следующего камня. */
export function goldForNextStone(s: GameState): number {
  const next = stonesFor(s.allTimeEarned) + 1;
  return Math.pow(next / 2, 1 / BAL.stoneExp) * BAL.stoneBase;
}

export function canTransmute(s: GameState): boolean {
  return s.chapter >= FEATURE_CHAPTER.transmutation && pendingStones(s) >= 1;
}

export function transmute(s: GameState, now: number, force = false): number {
  if (!force && !canTransmute(s)) return 0;
  const gain = pendingStones(s);
  s.stones += gain;
  s.stonesEarned += gain;
  s.transmutations++;
  resetRun(s, now);
  return gain;
}

function resetRun(s: GameState, now: number) {
  const fresh = newGame(now);
  s.gold = 0;
  s.runEarned = 0;
  s.generators = fresh.generators;
  s.upgrades = [];
  s.buffs = {};
  s.heat = 0;
  s.runStart = now;
  s.stats.runTaps = 0;
  s.challenge = null;
}

export function startChallenge(s: GameState, id: string, now: number): boolean {
  const c = CHALLENGE_BY_ID[id];
  if (!c || s.transmutations < 1 || (s.challengeDone[id] ?? 0) >= CHALLENGE_MAX) return false;
  transmute(s, now, true);
  s.challenge = id;
  return true;
}

export function abandonChallenge(s: GameState): void {
  s.challenge = null;
}

// ─── Древо знаний ────────────────────────────────────────────────────────────

export function talentCost(id: string, level: number): number {
  const t = TALENT_BY_ID[id];
  return Math.ceil(t.baseCost * Math.pow(t.growth, level));
}

export function talentAvailable(s: GameState, id: string): boolean {
  const t = TALENT_BY_ID[id];
  if (!t) return false;
  if (t.tier === 0) return true;
  return TALENTS.some((o) => o.branch === t.branch && o.tier === t.tier - 1 && (s.talents[o.id] ?? 0) > 0);
}

export function buyTalent(s: GameState, id: string): boolean {
  const t = TALENT_BY_ID[id];
  const lv = s.talents[id] ?? 0;
  if (!t || lv >= t.maxLevel || !talentAvailable(s, id)) return false;
  const cost = talentCost(id, lv);
  if (s.stones < cost) return false;
  s.stones -= cost;
  s.talents[id] = lv + 1;
  return true;
}

/** Сброс талантов: камни возвращаются. Бесплатно — чтобы поощрять эксперименты с билдами. */
export function respecTalents(s: GameState): number {
  let refund = 0;
  for (const [id, lv] of Object.entries(s.talents)) for (let i = 0; i < lv; i++) refund += talentCost(id, i);
  s.stones += refund;
  s.talents = {};
  return refund;
}

// ─── Ежедневное ──────────────────────────────────────────────────────────────

export function dayKey(now: number): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function prevDayKey(now: number): string {
  const d = new Date(now);
  d.setDate(d.getDate() - 1);
  return dayKey(d.getTime());
}

/** Вызывается при запуске и в тике. Возвращает true, если начался новый день. */
export function rollDaily(s: GameState, m: Mods, now: number, rng: Rng): boolean {
  const today = dayKey(now);
  if (today <= s.daily.day) return false; // тот же день или часы переведены назад
  s.daily.streak = s.daily.day === prevDayKey(now) ? s.daily.streak + 1 : 1;
  s.daily.bestStreak = Math.max(s.daily.bestStreak, s.daily.streak);
  s.daily.day = today;
  s.daily.rerollUsed = false;
  s.daily.allBonusClaimed = false;
  s.daily.quests = pickQuests(s, m, now, rng, 3);
  return true;
}

function pickQuests(s: GameState, m: Mods, now: number, rng: Rng, n: number, exclude: QuestKind[] = []): Quest[] {
  const g = baseGps(s, m) || 1;
  const pool = QUEST_TEMPLATES.filter((q) => q.chapter <= s.chapter && !exclude.includes(q.kind));
  const out: Quest[] = [];
  while (out.length < n && pool.length) {
    const t = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    out.push({ kind: t.kind, target: Math.round(t.target({ chapter: s.chapter, gps: g })), progress: 0, claimed: false });
  }
  void now;
  return out;
}

export function rerollQuest(s: GameState, m: Mods, index: number, now: number, rng: Rng): boolean {
  const q = s.daily.quests[index];
  if (!q || q.claimed || s.daily.rerollUsed) return false;
  const [nq] = pickQuests(s, m, now, rng, 1, s.daily.quests.map((x) => x.kind));
  if (!nq) return false;
  s.daily.quests[index] = nq;
  s.daily.rerollUsed = true;
  return true;
}

export function questProgress(s: GameState, kind: QuestKind, n: number): void {
  for (const q of s.daily.quests) if (q.kind === kind && !q.claimed) q.progress = Math.min(q.target, q.progress + n);
}

export function claimQuest(s: GameState, index: number, rng: Rng): boolean {
  const q = s.daily.quests[index];
  if (!q || q.claimed || q.progress < q.target) return false;
  q.claimed = true;
  s.essence += Math.round(QUEST_REWARD.essence * dailyEssenceScale(s));
  if (s.chapter >= FEATURE_CHAPTER.guild) grantShards(s, QUEST_REWARD.shards, rng);
  return true;
}

export function canClaimAllBonus(s: GameState): boolean {
  return !s.daily.allBonusClaimed && s.daily.quests.length > 0 && s.daily.quests.every((q) => q.claimed);
}

export function claimAllBonus(s: GameState, rng: Rng): Partial<Record<IngredientId, number>> | null {
  if (!canClaimAllBonus(s)) return null;
  s.daily.allBonusClaimed = true;
  s.essence += Math.round(QUESTS_ALL_BONUS.essence * dailyEssenceScale(s));
  return grantIngredients(s, QUESTS_ALL_BONUS.ingredients, rng);
}

export function grantIngredients(s: GameState, n: number, rng: Rng): Partial<Record<IngredientId, number>> {
  const open = LOCATIONS.filter((l) => l.chapter <= Math.max(2, s.chapter));
  const got: Partial<Record<IngredientId, number>> = {};
  for (let i = 0; i < n; i++) {
    const l = open[Math.floor(rng() * open.length)];
    const ing = rng() < 0.25 ? l.drops[1] : l.drops[0];
    s.ingredients[ing]++;
    got[ing] = (got[ing] ?? 0) + 1;
  }
  return got;
}

/** Ежедневные награды эссенцией растут вместе с игроком, как и экспедиции. */
export function dailyEssenceScale(s: GameState): number {
  return computeMods(s, Date.now()).essence * (1 + 0.25 * s.chapter);
}

export function loginRewardIndex(s: GameState): number {
  return (Math.max(1, s.daily.streak) - 1) % LOGIN_REWARDS.length;
}

export function canClaimLogin(s: GameState, now: number): boolean {
  return s.daily.loginClaimedDay !== dayKey(now);
}

export function claimLogin(s: GameState, m: Mods, now: number, rng: Rng): boolean {
  if (!canClaimLogin(s, now)) return false;
  const r = LOGIN_REWARDS[loginRewardIndex(s)];
  s.daily.loginClaimedDay = dayKey(now);
  if (r.goldMinutes) earn(s, Math.max(baseGps(s, m) * r.goldMinutes * 60, 100));
  if (r.essence) s.essence += Math.round(r.essence * dailyEssenceScale(s));
  if (r.ingredients) grantIngredients(s, r.ingredients, rng);
  if (r.shards) {
    if (s.chapter >= FEATURE_CHAPTER.guild) {
      for (let i = 0; i < r.shards; i++) grantShards(s, 1, rng);
    } else s.essence += r.shards * 10;
  }
  if (r.stonesPct && s.stonesEarned > 0) {
    const g = Math.max(1, Math.round(s.stonesEarned * r.stonesPct));
    s.stones += g;
    s.stonesEarned += g;
  }
  return true;
}

export { challengeGoal, CHALLENGES, CHALLENGE_BY_ID, LOCATIONS };

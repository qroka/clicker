import type { GeneratorId, IngredientId, LocationId } from './types';
import { GENERATORS, INGREDIENTS } from '../data/world';
import type { QuestKind } from '../data/progression';

export type BuffKind = 'prodBoost' | 'tapBoost' | 'critBoost' | 'frenzy' | 'tapStorm' | 'boil' | 'wispRain';

export interface Buff {
  mult: number;
  until: number;
}

export interface HeroState {
  recruited: boolean;
  level: number;
  shards: number;
}

export interface Expedition {
  uid: number;
  location: LocationId;
  duration: 'short' | 'medium' | 'long';
  heroes: string[];
  start: number;
  end: number;
  /** Успех рассчитывается при отправке, чтобы исход не зависел от момента сбора. */
  success: boolean;
  /** Зелье ускорения уже применено к этой экспедиции. */
  hasted?: boolean;
}

/** Вид сделки, которую предлагает гость (зависит от роли героя). */
export type VisitKind = 'tap' | 'crit' | 'prod' | 'trade' | 'train' | 'haste';

/** Герой гильдии зашёл в лавку. */
export interface Visit {
  hero: string;
  kind: VisitKind;
  arrived: number;
  /** Когда уйдёт, если его не заметить. */
  leaves: number;
  /** Разговор уже начат — гость ждёт ответа на предложение и не уходит. */
  talked?: boolean;
}

export interface Quest {
  kind: QuestKind;
  target: number;
  progress: number;
  claimed: boolean;
}

export interface Wisp {
  x: number; // 0..1 доля ширины
  y: number; // 0..1 доля высоты
  born: number;
  expires: number;
}

export interface GameState {
  version: number;
  created: number;
  lastTick: number;
  runStart: number;

  gold: number;
  runEarned: number;
  allTimeEarned: number;
  generators: Record<GeneratorId, number>;
  upgrades: string[];

  chapter: number; // максимум достигнутой главы (1..8)
  seenChapter: number; // до какой главы показан сюжетный диалог
  prologueSeen: boolean;

  stones: number;
  stonesEarned: number;
  transmutations: number;
  talents: Record<string, number>;

  heroes: Record<string, HeroState>;
  essence: number;
  ingredients: Record<IngredientId, number>;
  recipesKnown: string[];
  expeditions: Expedition[];
  nextExpUid: number;

  buffs: Partial<Record<BuffKind, Buff>>;
  heat: number;
  wisp: Wisp | null;
  nextWispAt: number;

  challenge: string | null;
  challengeDone: Record<string, number>;

  visit: Visit | null;
  nextVisitAt: number;
  /** Сколько разговоров из личной истории героя уже прочитано (0..3). */
  heroTalks: Record<string, number>;
  goldRushReadyAt?: number;

  daily: {
    day: string; // YYYY-MM-DD последнего входа
    streak: number;
    bestStreak: number;
    loginClaimedDay: string;
    quests: Quest[];
    rerollUsed: boolean;
    allBonusClaimed: boolean;
  };

  achievements: string[];
  finalDone: boolean;

  stats: {
    taps: number;
    runTaps: number;
    wisps: number;
    brews: number;
    expeditions: number;
    boils: number;
    crits: number;
    gensBought: number;
    heroLevels: number;
    upgradesBought: number;
    visits: number;
    playSeconds: number;
    bestGps: number;
  };

  settings: {
    sound: boolean;
    haptics: boolean;
    notation: 'short' | 'sci';
  };
}

export const SAVE_VERSION = 1;

export function emptyGenerators(): Record<GeneratorId, number> {
  return Object.fromEntries(GENERATORS.map((g) => [g.id, 0])) as Record<GeneratorId, number>;
}

export function emptyIngredients(): Record<IngredientId, number> {
  return Object.fromEntries(INGREDIENTS.map((i) => [i.id, 0])) as Record<IngredientId, number>;
}

export function newGame(now: number): GameState {
  return {
    version: SAVE_VERSION,
    created: now,
    lastTick: now,
    runStart: now,
    gold: 0,
    runEarned: 0,
    allTimeEarned: 0,
    generators: emptyGenerators(),
    upgrades: [],
    chapter: 1,
    seenChapter: 0,
    prologueSeen: false,
    stones: 0,
    stonesEarned: 0,
    transmutations: 0,
    talents: {},
    heroes: {},
    essence: 0,
    ingredients: emptyIngredients(),
    recipesKnown: [],
    expeditions: [],
    nextExpUid: 1,
    buffs: {},
    heat: 0,
    wisp: null,
    nextWispAt: now + 45_000,
    challenge: null,
    challengeDone: {},
    visit: null,
    nextVisitAt: now + 3 * 60_000,
    heroTalks: {},
    daily: {
      day: '',
      streak: 0,
      bestStreak: 0,
      loginClaimedDay: '',
      quests: [],
      rerollUsed: false,
      allBonusClaimed: false,
    },
    achievements: [],
    finalDone: false,
    stats: {
      taps: 0,
      runTaps: 0,
      wisps: 0,
      brews: 0,
      expeditions: 0,
      boils: 0,
      crits: 0,
      gensBought: 0,
      heroLevels: 0,
      upgradesBought: 0,
      visits: 0,
      playSeconds: 0,
      bestGps: 0,
    },
    settings: { sound: true, haptics: true, notation: 'short' },
  };
}

/** Мягкая миграция: дополняет старое сохранение недостающими полями. */
export function migrate(raw: unknown, now: number): GameState {
  const base = newGame(now);
  if (!raw || typeof raw !== 'object') return base;
  const s = raw as Partial<GameState>;
  return {
    ...base,
    ...s,
    generators: { ...base.generators, ...(s.generators ?? {}) },
    ingredients: { ...base.ingredients, ...(s.ingredients ?? {}) },
    daily: { ...base.daily, ...(s.daily ?? {}) },
    stats: { ...base.stats, ...(s.stats ?? {}) },
    heroTalks: { ...(s.heroTalks ?? {}) },
    settings: { ...base.settings, ...(s.settings ?? {}) },
    version: SAVE_VERSION,
  };
}

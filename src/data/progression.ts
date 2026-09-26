import type { Bonus, GeneratorId } from '../core/types';
import { GENERATORS } from './world';

/** Порог золота за текущий забег, открывающий главу (индекс = номер главы - 1). */
export const CHAPTER_THRESHOLDS = [0, 2.5e4, 3e6, 1e9, 1e13, 1e16, 1e19, 1e22];

/** Глава, с которой открывается каждая функция. */
export const FEATURE_CHAPTER = {
  guild: 2,
  expeditions: 2,
  recipes: 3,
  transmutation: 4,
} as const;

/** Пороги количества построек, удваивающие её доход (вехи). */
export const MILESTONES = [25, 50, 100, 150, 200, 250, 300, 400, 500];

// ─── Улучшения ────────────────────────────────────────────────────────────────

export type UpgradeEffect =
  | { kind: 'gen'; gen: GeneratorId; mult: number }
  | { kind: 'tap'; mult: number }
  | { kind: 'tapPct'; pct: number } // тап добавляет pct от дохода в секунду
  | { kind: 'prod'; mult: number }
  | { kind: 'crit'; chance: number };

export interface UpgradeDef {
  id: string;
  cost: number;
  /** Условие появления в магазине. */
  req: { gen: GeneratorId; owned: number } | { taps: number } | { earned: number };
  effect: UpgradeEffect;
  emoji: string;
  name: string;
  desc: string;
}

const GEN_UPGRADE_OWNED = [1, 5, 25, 50, 100, 150];
const GEN_UPGRADE_COST_MULT = [10, 50, 500, 5e4, 5e6, 5e8];

function buildUpgrades(): UpgradeDef[] {
  const list: UpgradeDef[] = [];
  GENERATORS.forEach((g) => {
    GEN_UPGRADE_OWNED.forEach((owned, i) => {
      list.push({
        id: `${g.id}_u${i}`,
        cost: g.baseCost * GEN_UPGRADE_COST_MULT[i],
        req: { gen: g.id, owned },
        effect: { kind: 'gen', gen: g.id, mult: 2 },
        emoji: g.emoji,
        name: '', // заполняется из текстов
        desc: 'Доход постройки ×2',
      });
    });
  });

  const tapUps: [number, number, string, string][] = [
    [100, 50, 'Крепкая ложка', 'Сила тапа ×2'],
    [2_000, 500, 'Медный черпак', 'Сила тапа ×2'],
    [5e4, 2_000, 'Серебряный половник', 'Сила тапа ×2'],
    [1e6, 5_000, 'Зачарованная мешалка', 'Сила тапа ×2'],
    [5e7, 10_000, 'Посох кипения', 'Сила тапа ×2'],
    [5e9, 20_000, 'Рука Мастера', 'Сила тапа ×2'],
  ];
  tapUps.forEach(([cost, taps, name, desc], i) => {
    list.push({ id: `tap_u${i}`, cost, req: { taps }, effect: { kind: 'tap', mult: 2 }, emoji: '🥄', name, desc });
  });

  const tapPct: [number, number, string][] = [
    [5e4, 0.01, 'Искра вдохновения'],
    [5e6, 0.01, 'Поток мысли'],
    [5e8, 0.01, 'Алхимическая интуиция'],
    [5e11, 0.01, 'Единство с котлом'],
    [5e14, 0.01, 'Руки золотые'],
  ];
  tapPct.forEach(([cost, pct, name], i) => {
    list.push({ id: `tappct_u${i}`, cost, req: { earned: cost / 5 }, effect: { kind: 'tapPct', pct }, emoji: '✋', name, desc: `Тап даёт +${pct * 100}% дохода в секунду` });
  });

  const crit: [number, string][] = [
    [1e5, 'Счастливая монетка'],
    [1e8, 'Кошачья удача'],
    [1e11, 'Звезда над лавкой'],
  ];
  crit.forEach(([cost, name], i) => {
    list.push({ id: `crit_u${i}`, cost, req: { earned: cost / 5 }, effect: { kind: 'crit', chance: 0.03 }, emoji: '🍀', name, desc: 'Шанс крита +3%' });
  });

  const prod: [number, string][] = [
    [1e6, 'Вывеска с котом'],
    [1e9, 'Гильдейская печать'],
    [1e12, 'Королевский патент'],
    [1e15, 'Торговля между мирами'],
    [1e18, 'Легенда Перекрёстка'],
    [1e21, 'Золотой век'],
    [1e24, 'Эпоха Алхимии'],
  ];
  prod.forEach(([cost, name], i) => {
    list.push({ id: `prod_u${i}`, cost, req: { earned: cost / 5 }, effect: { kind: 'prod', mult: 1.5 }, emoji: '📜', name, desc: 'Весь доход +50%' });
  });

  return list;
}

export const UPGRADES = buildUpgrades();
export const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u])) as Record<string, UpgradeDef>;

// ─── Древо знаний (таланты за философские камни) ──────────────────────────────

export interface TalentDef {
  id: string;
  branch: 'tap' | 'idle' | 'guild';
  tier: number; // 0..4, чтобы взять тир N, нужен хотя бы 1 талант тира N-1 в ветке
  maxLevel: number;
  /** Стоимость уровня L (с 0): baseCost * growth^L. */
  baseCost: number;
  growth: number;
  bonus: Bonus; // значение за уровень
  emoji: string;
  name: string;
  desc: string;
}

export const TALENTS: TalentDef[] = [
  // Ветка «Руки мастера» — активная игра
  { id: 't_tap1', branch: 'tap', tier: 0, maxLevel: 10, baseCost: 1, growth: 1.6, bonus: { type: 'tapMult', value: 0.25 }, emoji: '🥄', name: 'Твёрдая рука', desc: '+25% к силе тапа за уровень' },
  { id: 't_crit1', branch: 'tap', tier: 1, maxLevel: 5, baseCost: 3, growth: 1.8, bonus: { type: 'critChance', value: 0.02 }, emoji: '🎯', name: 'Меткий глаз', desc: '+2% шанс крита за уровень' },
  { id: 't_wisp1', branch: 'tap', tier: 1, maxLevel: 5, baseCost: 3, growth: 1.8, bonus: { type: 'wispBonus', value: 0.2 }, emoji: '✨', name: 'Ловец искр', desc: '+20% к наградам искр за уровень' },
  { id: 't_critm', branch: 'tap', tier: 2, maxLevel: 5, baseCost: 8, growth: 2, bonus: { type: 'critMult', value: 0.5 }, emoji: '💥', name: 'Взрывная реакция', desc: '+50% к множителю крита за уровень' },
  { id: 't_tap2', branch: 'tap', tier: 3, maxLevel: 10, baseCost: 20, growth: 1.7, bonus: { type: 'tapMult', value: 1 }, emoji: '🔥', name: 'Огненный черпак', desc: '+100% к силе тапа за уровень' },
  { id: 't_tap3', branch: 'tap', tier: 4, maxLevel: 5, baseCost: 150, growth: 2.2, bonus: { type: 'prodMult', value: 0.3 }, emoji: '👑', name: 'Мастер котла', desc: '+30% ко всему доходу за уровень' },

  // Ветка «Мастерская» — пассивный доход
  { id: 't_prod1', branch: 'idle', tier: 0, maxLevel: 10, baseCost: 1, growth: 1.6, bonus: { type: 'prodMult', value: 0.1 }, emoji: '⚙️', name: 'Порядок в лавке', desc: '+10% к доходу за уровень' },
  { id: 't_cost1', branch: 'idle', tier: 1, maxLevel: 5, baseCost: 4, growth: 2, bonus: { type: 'costReduction', value: 0.02 }, emoji: '🏷️', name: 'Торг уместен', desc: '−2% к цене построек за уровень' },
  { id: 't_off1', branch: 'idle', tier: 1, maxLevel: 5, baseCost: 3, growth: 1.8, bonus: { type: 'offlineMult', value: 0.25 }, emoji: '🌙', name: 'Ночная смена', desc: '+25% к оффлайн-доходу и +1 ч к лимиту за уровень' },
  { id: 't_prod2', branch: 'idle', tier: 2, maxLevel: 10, baseCost: 10, growth: 1.7, bonus: { type: 'prodMult', value: 0.25 }, emoji: '🏭', name: 'Поточное производство', desc: '+25% к доходу за уровень' },
  { id: 't_heart', branch: 'idle', tier: 3, maxLevel: 5, baseCost: 40, growth: 2, bonus: { type: 'genMult', target: 'world_heart', value: 1 }, emoji: '💖', name: 'Пульс Мироздания', desc: '+100% к Сердцу Мира за уровень' },
  { id: 't_prod3', branch: 'idle', tier: 4, maxLevel: 5, baseCost: 150, growth: 2.2, bonus: { type: 'prodMult', value: 0.5 }, emoji: '🌟', name: 'Золотая жила', desc: '+50% ко всему доходу за уровень' },

  // Ветка «Гильдия» — герои и экспедиции
  { id: 't_ess1', branch: 'guild', tier: 0, maxLevel: 10, baseCost: 1, growth: 1.6, bonus: { type: 'essenceMult', value: 0.15 }, emoji: '💧', name: 'Сбор эссенции', desc: '+15% к эссенции за уровень' },
  { id: 't_exs1', branch: 'guild', tier: 1, maxLevel: 5, baseCost: 3, growth: 1.8, bonus: { type: 'expeditionSpeed', value: 0.06 }, emoji: '🧭', name: 'Короткие тропы', desc: '−6% к длительности экспедиций за уровень' },
  { id: 't_exl1', branch: 'guild', tier: 1, maxLevel: 5, baseCost: 4, growth: 1.8, bonus: { type: 'expeditionLoot', value: 0.15 }, emoji: '🎒', name: 'Глубокие карманы', desc: '+15% к добыче экспедиций за уровень' },
  { id: 't_ess2', branch: 'guild', tier: 2, maxLevel: 10, baseCost: 10, growth: 1.7, bonus: { type: 'essenceMult', value: 0.3 }, emoji: '🫧', name: 'Кристаллизация', desc: '+30% к эссенции за уровень' },
  { id: 't_exl2', branch: 'guild', tier: 3, maxLevel: 5, baseCost: 40, growth: 2, bonus: { type: 'expeditionLoot', value: 0.3 }, emoji: '🗺️', name: 'Карта сокровищ', desc: '+30% к добыче экспедиций за уровень' },
  { id: 't_guild', branch: 'guild', tier: 4, maxLevel: 5, baseCost: 150, growth: 2.2, bonus: { type: 'prodMult', value: 0.4 }, emoji: '🏰', name: 'Слава гильдии', desc: '+40% ко всему доходу за уровень' },
];

export const TALENT_BY_ID = Object.fromEntries(TALENTS.map((t) => [t.id, t])) as Record<string, TalentDef>;

// ─── Испытания ────────────────────────────────────────────────────────────────

export type ChallengeRule = 'noTap' | 'expensive' | 'fewGens' | 'noBuffs' | 'noHeroes' | 'weakStart';

export interface ChallengeDef {
  id: string;
  rule: ChallengeRule;
  /** Цель: заработать столько золота за забег (множитель от 1e9 × 10^(3*уровень)). */
  goalBase: number;
  reward: Bonus; // за каждое прохождение (до 5 раз)
  emoji: string;
  name: string;
  desc: string;
  rewardText: string;
}

export const CHALLENGE_MAX = 5;

export const CHALLENGES: ChallengeDef[] = [
  { id: 'c_notap', rule: 'noTap', goalBase: 1e9, reward: { type: 'prodMult', value: 0.1 }, emoji: '🙌', name: 'Без рук', desc: 'Котёл не отвечает на тапы. Только постройки.', rewardText: '+10% к доходу' },
  { id: 'c_expensive', rule: 'expensive', goalBase: 1e9, reward: { type: 'costReduction', value: 0.02 }, emoji: '💸', name: 'Скупой рынок', desc: 'Все постройки стоят в 10 раз дороже.', rewardText: '−2% к цене построек' },
  { id: 'c_fewgens', rule: 'fewGens', goalBase: 1e9, reward: { type: 'tapMult', value: 0.5 }, emoji: '🏚️', name: 'Тесная лавка', desc: 'Доступны только первые 6 построек.', rewardText: '+50% к силе тапа' },
  { id: 'c_nobuffs', rule: 'noBuffs', goalBase: 1e9, reward: { type: 'wispBonus', value: 0.25 }, emoji: '🌑', name: 'Тёмная луна', desc: 'Нет искр, зелий-усилений и кипения котла.', rewardText: '+25% к наградам искр' },
  { id: 'c_noheroes', rule: 'noHeroes', goalBase: 1e9, reward: { type: 'expeditionLoot', value: 0.15 }, emoji: '💤', name: 'Гильдия спит', desc: 'Бонусы героев отключены.', rewardText: '+15% к добыче экспедиций' },
  { id: 'c_weak', rule: 'weakStart', goalBase: 1e9, reward: { type: 'prodMult', value: 0.15 }, emoji: '🪨', name: 'Свинцовое проклятие', desc: 'Философские камни и таланты не действуют.', rewardText: '+15% к доходу' },
];

export const CHALLENGE_BY_ID = Object.fromEntries(CHALLENGES.map((c) => [c.id, c])) as Record<string, ChallengeDef>;

export function challengeGoal(c: ChallengeDef, completions: number): number {
  return c.goalBase * Math.pow(1000, completions);
}

// ─── Ежедневное ──────────────────────────────────────────────────────────────

/** Награды календаря входа (цикл 7 дней). gold — в минутах текущего дохода. */
export const LOGIN_REWARDS: { goldMinutes?: number; essence?: number; ingredients?: number; shards?: number; stones?: number; label: string; emoji: string }[] = [
  { goldMinutes: 30, label: '30 мин дохода', emoji: '🪙' },
  { essence: 40, label: '40 эссенции', emoji: '💧' },
  { ingredients: 6, label: '6 ингредиентов', emoji: '🌿' },
  { goldMinutes: 90, label: '1,5 ч дохода', emoji: '💰' },
  { essence: 100, label: '100 эссенции', emoji: '🫧' },
  { shards: 5, label: '5 осколков контракта', emoji: '📜' },
  { shards: 10, essence: 150, ingredients: 10, label: 'Сундук гильдии', emoji: '🎁' },
];

export type QuestKind = 'taps' | 'earn' | 'buyGens' | 'expeditions' | 'brew' | 'wisps' | 'heroLevels' | 'upgrades';

export interface QuestTemplate {
  kind: QuestKind;
  /** Минимальная глава, с которой задание может выпасть. */
  chapter: number;
  target: (ctx: { chapter: number; gps: number }) => number;
  text: (n: string) => string;
  emoji: string;
}

export const QUEST_TEMPLATES: QuestTemplate[] = [
  { kind: 'taps', chapter: 1, target: () => 500, text: (n) => `Сделай ${n} тапов по котлу`, emoji: '🫳' },
  { kind: 'earn', chapter: 1, target: ({ gps }) => Math.max(1000, gps * 1800), text: (n) => `Заработай ${n} золота`, emoji: '🪙' },
  { kind: 'buyGens', chapter: 1, target: () => 25, text: (n) => `Купи ${n} построек`, emoji: '🏗️' },
  { kind: 'upgrades', chapter: 1, target: () => 3, text: (n) => `Купи ${n} улучшения`, emoji: '📜' },
  { kind: 'wisps', chapter: 1, target: () => 5, text: (n) => `Поймай ${n} блуждающих искр`, emoji: '✨' },
  { kind: 'expeditions', chapter: 2, target: () => 3, text: (n) => `Отправь ${n} экспедиции`, emoji: '🧭' },
  { kind: 'heroLevels', chapter: 2, target: () => 3, text: (n) => `Повысь уровень героев ${n} раза`, emoji: '⬆️' },
  { kind: 'brew', chapter: 3, target: () => 2, text: (n) => `Свари ${n} зелья`, emoji: '🧪' },
];

export const QUEST_REWARD = { essence: 25, shards: 1 };
export const QUESTS_ALL_BONUS = { essence: 50, ingredients: 4 };

/** Бонусы дня недели (индекс = Date.getDay()). */
export const WEEKDAY_EFFECTS: Partial<Record<'offlineMult' | 'costMult' | 'wispFreq' | 'expSpeed' | 'tapMult' | 'heroCost' | 'rareLoot', number>>[] = [
  { offlineMult: 2 },
  { costMult: 0.9 },
  { wispFreq: 2 },
  { expSpeed: 0.75 },
  { tapMult: 2 },
  { heroCost: 0.75 },
  { rareLoot: 1.5 },
];

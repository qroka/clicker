// Общие типы игры «Гильдия Алхимиков».
// Контентные файлы в src/data/* описываются этими типами; движок в src/core/* их читает.

export type GeneratorId =
  | 'mortar'
  | 'apprentice'
  | 'alembic'
  | 'greenhouse'
  | 'crystal_furnace'
  | 'homunculus'
  | 'dragon_forge'
  | 'moon_observatory'
  | 'golem_workshop'
  | 'ether_resonator'
  | 'astral_portal'
  | 'world_heart';

export type IngredientId =
  | 'moonpetal'
  | 'mandrake'
  | 'glowcap'
  | 'salamander_ash'
  | 'kraken_ink'
  | 'star_dust'
  | 'dragon_scale'
  | 'phoenix_feather'
  | 'void_pearl'
  | 'time_sand';

export type LocationId =
  | 'whispering_woods'
  | 'mushroom_caves'
  | 'volcano'
  | 'sunken_coast'
  | 'sky_ruins'
  | 'dragon_peaks'
  | 'abyss'
  | 'clockwork_citadel';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

/** Роль героя влияет на экспедиции: какие ингредиенты чаще приносит и где сильнее. */
export type HeroRole = 'herbalist' | 'warrior' | 'sage' | 'merchant';

/** Типы пассивных бонусов (герои, рецепты, таланты, испытания). */
export type BonusType =
  | 'tapMult' // +% к силе тапа
  | 'prodMult' // +% ко всему пассивному доходу
  | 'genMult' // +% к доходу одной постройки (нужен target)
  | 'critChance' // +доля к шансу крита (0.01 = +1 п.п.)
  | 'critMult' // +% к множителю крита
  | 'expeditionSpeed' // -% длительности экспедиций
  | 'expeditionLoot' // +% добычи экспедиций
  | 'wispBonus' // +% к наградам блуждающих искр
  | 'offlineMult' // +% к оффлайн-доходу
  | 'costReduction' // -% стоимости построек
  | 'essenceMult'; // +% к получаемой эссенции

export interface Bonus {
  type: BonusType;
  /** Для genMult — какая постройка усиливается. */
  target?: GeneratorId;
  /** Значение в долях: 0.1 = +10%. */
  value: number;
}

export interface HeroDef {
  id: string;
  /** Имя-оммаж (НЕ оригинальное имя персонажа, без торговых марок). */
  name: string;
  /** Короткий титул, по которому узнаётся архетип. */
  title: string;
  /** Подсказка, какой мир напоминает (для игрока — «Гость из мира ...»). Без торговых марок. */
  realm: string;
  /** Основной цвет рамки портрета, hex. */
  color: string;
  rarity: Rarity;
  role: HeroRole;
  /** Тип бонуса; величину считает движок по редкости и уровню. */
  bonus: { type: BonusType; target?: GeneratorId };
  /** С какой главы герой может прийти в гильдию (2..8). */
  chapter: number;
  /** Как нанимается: за золото или собирая осколки контракта в экспедициях. */
  recruit: 'gold' | 'shards';
  bio: string;
  /** Фраза при найме / в карточке. Своя, не цитата из оригинала. */
  quote: string;
}

export interface GeneratorDef {
  id: GeneratorId;
  baseCost: number;
  baseProd: number;
}

export interface LocationDef {
  id: LocationId;
  chapter: number;
  /** Ингредиенты: [обычный, редкий]. */
  drops: [IngredientId, IngredientId];
  /** Какая роль героя здесь эффективнее. */
  favoredRole: HeroRole;
  /** Рекомендуемая сила отряда для 100% успеха. */
  power: number;
}

export interface IngredientDef {
  id: IngredientId;
  rarity: Rarity;
  color: string;
}

export interface RecipeDef {
  id: string;
  ingredients: [IngredientId, IngredientId, IngredientId];
  /** Постоянный бонус за открытие рецепта. */
  discovery: Bonus;
  /** Временный эффект при варке. */
  brew: { kind: 'prodBoost' | 'tapBoost' | 'wispRain' | 'haste' | 'goldRush' | 'critBoost'; mult: number; seconds: number };
  color: string;
}

export type SpeakerId = 'mentor' | 'cat' | 'player' | 'narrator' | string;

export interface DialogueLine {
  speaker: SpeakerId;
  text: string;
}

export interface ChapterText {
  title: string;
  subtitle: string;
  /** Короткая цель главы, которая видна игроку. */
  goal: string;
  intro: DialogueLine[];
}

/** Все тексты, которые пишет нарративный дизайнер. Ключи — id из механики. */
export interface GameTexts {
  speakers: Record<string, { name: string; icon: string }>;
  prologue: DialogueLine[];
  chapters: ChapterText[]; // ровно 8
  epilogue: DialogueLine[];
  generators: Record<GeneratorId, { name: string; desc: string; upgrades: [string, string, string, string, string, string] }>;
  ingredients: Record<IngredientId, { name: string; desc: string }>;
  locations: Record<LocationId, { name: string; desc: string }>;
  recipes: Record<string, { name: string; desc: string }>;
  catTips: string[];
  weeklyEvents: [EventText, EventText, EventText, EventText, EventText, EventText, EventText];
  expeditionStories: { success: string[]; fail: string[] };
  transmutation: { title: string; lines: DialogueLine[] };
}

export interface EventText {
  name: string;
  desc: string;
  icon: string;
}

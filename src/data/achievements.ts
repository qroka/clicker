import type { GameState } from '../core/state';
import { GENERATORS } from './world';

export interface AchievementDef {
  id: string;
  emoji: string;
  name: string;
  desc: string;
  check: (s: GameState) => boolean;
}

/** Каждое достижение даёт +1% ко всему доходу. */
export const ACHIEVEMENT_BONUS = 0.01;

const GEN_TIERS: [number, string][] = [
  [1, 'Первый шаг'],
  [50, 'Своё дело'],
  [100, 'Мастер'],
  [200, 'Магнат'],
  [300, 'Легенда'],
];

const GEN_NAMES: Record<string, string> = {
  mortar: 'ступок',
  apprentice: 'учеников',
  alembic: 'перегонных кубов',
  greenhouse: 'теплиц',
  crystal_furnace: 'кристальных печей',
  homunculus: 'гомункулов',
  dragon_forge: 'драконьих горнов',
  moon_observatory: 'обсерваторий',
  golem_workshop: 'мастерских големов',
  ether_resonator: 'резонаторов',
  astral_portal: 'порталов',
  world_heart: 'Сердец Мира',
};

function fmtShort(n: number): string {
  const units = ['', ' тыс.', ' млн', ' млрд', ' трлн', ' квдр.', ' квнт.', ' скст.', ' сптл.', ' октл.', ' нонл.'];
  let i = 0;
  while (n >= 1000 && i < units.length - 1) {
    n /= 1000;
    i++;
  }
  return `${Math.round(n)}${units[i]}`;
}

function build(): AchievementDef[] {
  const list: AchievementDef[] = [];

  GENERATORS.forEach((g) => {
    GEN_TIERS.forEach(([n, title]) => {
      list.push({
        id: `gen_${g.id}_${n}`,
        emoji: g.emoji,
        name: `${title}: ${GEN_NAMES[g.id]}`,
        desc: `Собрать ${GEN_NAMES[g.id]}: ${n}`,
        check: (s) => s.generators[g.id] >= n,
      });
    });
  });

  const earned: [number, string][] = [
    [1e3, 'Первая выручка'],
    [1e6, 'Миллионер'],
    [1e9, 'Золотой котёл'],
    [1e12, 'Казна королевства'],
    [1e15, 'Сокровищница драконов'],
    [1e18, 'Богатство миров'],
    [1e21, 'Звёздный капитал'],
    [1e24, 'Алхимик-олигарх'],
    [1e27, 'За гранью золота'],
    [1e30, 'Абсолютное злато'],
  ];
  earned.forEach(([n, name]) =>
    list.push({ id: `earn_${n}`, emoji: '🪙', name, desc: `Заработать ${fmtShort(n)} золота за всё время`, check: (s) => s.allTimeEarned >= n }),
  );

  const simple: [string, string, string, (s: GameState) => number, number[]][] = [
    ['taps', '🫳', 'Неутомимые руки', (s) => s.stats.taps, [100, 1_000, 10_000, 50_000, 150_000]],
    ['wisps', '✨', 'Ловец искр', (s) => s.stats.wisps, [1, 25, 100, 300, 777]],
    ['boils', '♨️', 'Котёл кипит', (s) => s.stats.boils, [1, 50, 250, 1000]],
    ['crits', '💥', 'Критическая масса', (s) => s.stats.crits, [10, 500, 5000]],
    ['heroes', '🛡️', 'Гильдия растёт', (s) => Object.values(s.heroes).filter((h) => h.recruited).length, [1, 5, 10, 20, 30]],
    ['recipes', '📖', 'Книга рецептов', (s) => s.recipesKnown.length, [1, 5, 10, 16, 22]],
    ['brews', '🧪', 'Зельевар', (s) => s.stats.brews, [5, 50, 200]],
    ['trans', '♻️', 'Трансмутация', (s) => s.transmutations, [1, 3, 10, 25, 50]],
    ['exps', '🧭', 'Первооткрыватель', (s) => s.stats.expeditions, [1, 25, 100, 300, 700]],
    ['streak', '📅', 'Постоянный клиент', (s) => s.daily.bestStreak, [3, 7, 14, 30, 60]],
    ['herolv', '⬆️', 'Наставник героев', (s) => s.stats.heroLevels, [10, 100, 400]],
    ['chal', '🏆', 'Испытатель', (s) => Object.values(s.challengeDone).reduce((a, b) => a + b, 0), [1, 6, 15, 30]],
  ];
  simple.forEach(([id, emoji, name, get, tiers]) => {
    tiers.forEach((n, i) =>
      list.push({ id: `${id}_${n}`, emoji, name: `${name} ${['I', 'II', 'III', 'IV', 'V'][i]}`, desc: `Достичь ${n}`, check: (s) => get(s) >= n }),
    );
  });

  list.push({ id: 'final', emoji: '💎', name: 'Великое Делание', desc: 'Сварить Философский камень', check: (s) => s.finalDone });
  return list;
}

export const ACHIEVEMENTS = build();

// Более понятные описания для «простых» достижений.
const DESC_PREFIX: Record<string, string> = {
  taps: 'Сделать тапов:',
  wisps: 'Поймать искр:',
  boils: 'Довести котёл до кипения раз:',
  crits: 'Критических тапов:',
  heroes: 'Героев в гильдии:',
  recipes: 'Открыть рецептов:',
  brews: 'Сварить зелий:',
  trans: 'Провести трансмутаций:',
  exps: 'Завершить экспедиций:',
  streak: 'Дней подряд в игре:',
  herolv: 'Повышений уровня героев:',
  chal: 'Пройти испытаний:',
};
ACHIEVEMENTS.forEach((a) => {
  const [prefix, n] = a.id.split('_');
  if (DESC_PREFIX[prefix] && !a.id.startsWith('gen_')) a.desc = `${DESC_PREFIX[prefix]} ${n}`;
});

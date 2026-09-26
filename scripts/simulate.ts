// Симуляция баланса: модель игрока, который заходит несколько раз в день.
// Запуск: npm run sim [-- --days 21 --sessions 5 --minutes 12 --tps 3]

import { newGame, type GameState } from '../src/core/state';
import * as E from '../src/core/engine';
import { GENERATORS, LOCATIONS, RECIPES, FINAL_RECIPE } from '../src/data/world';
import { HEROES } from '../src/data/heroes';
import { TALENTS } from '../src/data/progression';
import type { IngredientId } from '../src/core/types';

const args = Object.fromEntries(
  process.argv.slice(2).reduce<[string, string][]>((acc, a, i, arr) => {
    if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1]]);
    return acc;
  }, []),
);
const DAYS = Number(args.days ?? 21);
const SESSIONS = Number(args.sessions ?? 5);
const MINUTES = Number(args.minutes ?? 12);
const TPS = Number(args.tps ?? 3);
const QUIET = !!args.quiet;
if (args.stoneExp) E.BAL.stoneExp = Number(args.stoneExp);
if (args.stoneBonus) E.BAL.stoneBonus = Number(args.stoneBonus);

let seed = Number(args.seed ?? 42);
const rng: E.Rng = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

const start = new Date(2026, 8, 28, 8, 0, 0).getTime(); // понедельник, 8:00
const s: GameState = newGame(start);
s.prologueSeen = true;

const log: string[] = [];
const milestones: Record<string, number> = {};
const mark = (k: string, now: number) => {
  if (!(k in milestones)) milestones[k] = now;
};
const fmtT = (ms: number) => {
  const h = (ms - start) / 3600e3;
  const d = Math.floor(h / 24);
  return `д${d + 1} ${String(Math.floor(h % 24)).padStart(2, '0')}:${String(Math.floor((h * 60) % 60)).padStart(2, '0')}`;
};
const fmt = (n: number) => (n < 1e4 ? n.toFixed(0) : n.toExponential(2));

// ─── Решения игрока ──────────────────────────────────────────────────────────

function spend(now: number) {
  const m = E.computeMods(s, now);
  // Копит казну на Великое Делание, когда всё остальное для него готово
  if (E.canBrewKnown(s, FINAL_RECIPE)) mark('final-ings', now);
  const saving = s.chapter >= 8 && !s.finalDone && E.canBrewKnown(s, FINAL_RECIPE) && E.gps(s, m, now) * 3 * 3600 > E.BAL.finalCost;
  // Улучшения — самые дешёвые, если стоят < 3 мин дохода или просто доступны
  for (const u of E.availableUpgrades(s)) {
    if (u.cost <= s.gold) E.buyUpgrade(s, u.id);
  }
  // Постройки: лучшая окупаемость (с учётом ближайшей вехи)
  for (let guard = 0; guard < 200 && !saving; guard++) {
    const mm = E.computeMods(s, now);
    let best: { id: (typeof GENERATORS)[number]['id']; score: number } | null = null;
    for (const g of GENERATORS) {
      if (!E.genAvailable(s, g.id)) continue;
      const cost = E.genCost(s, mm, g.id, 1);
      const per = g.baseProd * mm.gen[g.id] * mm.prod;
      const score = per / cost;
      if (!best || score > best.score) best = { id: g.id, score };
    }
    if (!best) break;
    if (E.buyGenerator(s, mm, best.id, 1) === 0) break;
  }
  // Герои
  for (const h of HEROES) if (E.canRecruit(s, h)) E.recruitHero(s, h.id);
  const recruited = HEROES.filter((h) => s.heroes[h.id]?.recruited).sort((a, b) => (s.heroes[a.id].level - s.heroes[b.id].level));
  for (let i = 0; i < 100; i++) {
    const h = recruited.sort((a, b) => E.heroLevelCost(s, m, a) - E.heroLevelCost(s, m, b))[0];
    if (!h || !E.levelUpHero(s, m, h.id)) break;
  }
  // Таланты
  for (let i = 0; i < 50; i++) {
    const opts = TALENTS.filter((t) => (s.talents[t.id] ?? 0) < t.maxLevel && E.talentAvailable(s, t.id)).sort(
      (a, b) => E.talentCost(a.id, s.talents[a.id] ?? 0) - E.talentCost(b.id, s.talents[b.id] ?? 0),
    );
    // Оставляем часть камней «в банке», т.к. они дают +% дохода
    const t = opts[0];
    if (!t || E.talentCost(t.id, s.talents[t.id] ?? 0) > s.stones * 0.6) break;
    E.buyTalent(s, t.id);
  }
}

function manageExpeditions(now: number, longGap: boolean) {
  const m = E.computeMods(s, now);
  for (const e of [...s.expeditions]) if (e.end <= now) E.collectExpedition(s, m, e.uid, now, rng);
  const open = LOCATIONS.filter((l) => l.chapter <= s.chapter);
  while (s.expeditions.length < E.expeditionSlots(s)) {
    const busy = E.busyHeroes(s);
    const free = HEROES.filter((h) => s.heroes[h.id]?.recruited && !busy.has(h.id));
    if (!free.length) break;
    // Самая «дорогая» доступная локация, где шанс ≥ 85%
    let pick: { loc: (typeof LOCATIONS)[number]['id']; team: string[] } | null = null;
    for (const l of [...open].reverse()) {
      const team = [...free].sort((a, b) => E.heroPower(s, b.id, l.id) - E.heroPower(s, a.id, l.id)).slice(0, 3).map((h) => h.id);
      if (E.successChance(s, l.id, team) >= 0.85 || l === open[0]) {
        pick = { loc: l.id, team };
        break;
      }
    }
    if (!pick) break;
    E.startExpedition(s, m, pick.loc, longGap ? 'long' : 'medium', pick.team, now, rng);
  }
}

function brewStuff(now: number) {
  if (s.chapter < 3) return;
  const m = E.computeMods(s, now);
  // Идеализированно: игрок открывает рецепт, как только есть ингредиенты (с небольшой ценой экспериментов).
  for (const r of RECIPES) {
    if (s.recipesKnown.includes(r.id)) continue;
    if (r.id === FINAL_RECIPE && (s.chapter < 8 || s.gold < E.BAL.finalCost)) continue;
    if (E.canBrewKnown(s, r.id)) {
      E.brew(s, m, [...r.ingredients] as IngredientId[], now);
      mark(`recipe:${r.id}`, now);
    }
  }
  // Варит бустеры дохода, если есть лишние обычные ингредиенты
  for (const id of ['calm_draught', 'comet_tonic', 'star_tea']) {
    if (s.recipesKnown.includes(id) && E.canBrewKnown(s, id) && !(s.buffs.prodBoost && s.buffs.prodBoost.until > now)) {
      const r = RECIPES.find((x) => x.id === id)!;
      E.brew(s, m, [...r.ingredients] as IngredientId[], now);
    }
  }
}

function distillExcess() {
  for (const [id, n] of Object.entries(s.ingredients)) if (n > 40) E.distill(s, id as IngredientId, n - 40);
}

function daily(now: number) {
  const m = E.computeMods(s, now);
  E.rollDaily(s, m, now, rng);
  if (E.canClaimLogin(s, now)) E.claimLogin(s, m, now, rng);
  s.daily.quests.forEach((_, i) => E.claimQuest(s, i, rng));
  E.claimAllBonus(s, rng);
}

function maybeTransmute(now: number) {
  if (!E.canTransmute(s)) return;
  const pend = E.pendingStones(s);
  const runHours = (now - s.runStart) / 3600e3;
  // Эвристика игрока: трансмутировать, когда прирост камней ≥ 50% от текущих (или первый раз ≥ 5)
  const threshold = s.stonesEarned === 0 ? 5 : Math.max(3, s.stonesEarned * 0.5);
  if (pend >= threshold && runHours > 0.3) {
    const g = E.transmute(s, now);
    log.push(`${fmtT(now)}  ♻️ трансмутация #${s.transmutations}: +${g} камней (всего ${s.stonesEarned})`);
  }
}

// ─── Основной цикл ───────────────────────────────────────────────────────────

const sessionStarts = Array.from({ length: SESSIONS }, (_, i) => 8 + (i * 14) / Math.max(1, SESSIONS - 1)); // 8:00…22:00
let lastChapter = s.chapter;

for (let day = 0; day < DAYS; day++) {
  for (let si = 0; si < SESSIONS; si++) {
    const t0 = start + day * 86400e3 + sessionStarts[si] * 3600e3;
    E.applyOffline(s, t0);
    s.lastTick = t0;
    daily(t0);
    let now = t0;
    const end = t0 + MINUTES * 60e3;
    let step = 0;
    while (now < end) {
      now += 1000;
      step++;
      const ev = E.tick(s, now, rng);
      const m = E.computeMods(s, now);
      for (let i = 0; i < TPS; i++) E.tap(s, m, now, rng);
      if (s.wisp && rng() < 0.12) E.catchWisp(s, m, now, rng);
      if (step % 5 === 0) spend(now);
      if (step % 60 === 0) {
        manageExpeditions(now, false);
        brewStuff(now);
        distillExcess();
        daily(now);
        maybeTransmute(now);
      }
      if (ev.chapterUp || s.chapter !== lastChapter) {
        lastChapter = s.chapter;
        mark(`chapter ${s.chapter}`, now);
        log.push(`${fmtT(now)}  📖 глава ${s.chapter}  (gps ${fmt(E.baseGps(s, m))})`);
      }
    }
    const lastSession = si === SESSIONS - 1;
    manageExpeditions(now, lastSession || true);
    maybeTransmute(now);
    spend(now);
    if (s.finalDone) mark('FINAL', now);
  }
  const now = start + (day + 1) * 86400e3 - 1;
  const m = E.computeMods(s, now);
  const heroes = HEROES.filter((h) => s.heroes[h.id]?.recruited).length;
  log.push(
    `═ день ${day + 1}: глава ${s.chapter}, gps ${fmt(E.baseGps(s, m))}, забег ${fmt(s.runEarned)}, всего ${fmt(s.allTimeEarned)}, камни ${s.stones}/${s.stonesEarned} (+${E.pendingStones(s)}), трансм. ${s.transmutations}, герои ${heroes}/30, рецепты ${s.recipesKnown.length}/22, эссенция ${fmt(s.essence)}, достиж. ${s.achievements.length}`,
  );
}

if (args.dump) (await import('node:fs')).writeFileSync(args.dump, JSON.stringify(s));
if (!QUIET) console.log(log.join('\n'));
console.log('\nВехи:');
for (const [k, v] of Object.entries(milestones).filter(([k]) => !k.startsWith('recipe:'))) console.log(`  ${k.padEnd(12)} ${fmtT(v)}`);
console.log(`  рецептов открыто: ${s.recipesKnown.length}/22, финал: ${s.finalDone ? fmtT(milestones.FINAL) : 'нет'}`);

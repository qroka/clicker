import { useEffect, useReducer } from 'preact/hooks';
import { migrate, newGame, type GameState } from '../core/state';
import * as E from '../core/engine';
import type { DialogueLine, IngredientId } from '../core/types';
import { TEXTS } from '../data/texts';
import { ACHIEVEMENTS } from '../data/achievements';
import { CHALLENGE_BY_ID } from '../data/progression';
import { setNotation } from './format';
import { haptic, setFxSettings, sfx } from './fx';
import type { CloudStatus } from '../cloud/sync';

const SAVE_KEY = 'alchemist-guild-save-v1';

export type Modal =
  | { type: 'dialogue'; title?: string; lines: DialogueLine[]; onDone?: () => void }
  | { type: 'offline'; report: E.OfflineReport }
  | { type: 'loot'; loot: E.ExpeditionLoot; location: string; heroes: string[] }
  | { type: 'discover'; recipe: string }
  | { type: 'transmuted'; stones: number }
  | { type: 'challengeDone'; id: string }
  | { type: 'cloudConflict'; progress: number; updatedAt: number; useCloud: () => void; keepLocal: () => void };

export interface Toast {
  id: number;
  icon: string;
  title: string;
  text?: string;
  kind?: 'gold' | 'info' | 'ach' | 'warn';
}

export type Tab = 'shop' | 'workshop' | 'guild' | 'lab' | 'knowledge';
export type Sheet = null | 'daily' | 'settings' | 'achievements' | { hero: string } | { expedition: true };

const rng: E.Rng = Math.random;

/** Защита от перевода часов: таймеры не могут уходить в будущее дальше разумного. */
function sanitize(s: GameState, now: number): GameState {
  for (const k of Object.keys(s.buffs) as (keyof GameState['buffs'])[]) if ((s.buffs[k]?.until ?? 0) > now + 3 * 3600e3) delete s.buffs[k];
  if (s.nextWispAt > now + 10 * 60e3) s.nextWispAt = now + 30e3;
  for (const e of s.expeditions) if (e.end > now + 7 * 3600e3) e.end = now + 3600e3;
  if (s.lastTick > now) s.lastTick = now;
  return s;
}

class Store {
  s: GameState;
  modals: Modal[] = [];
  toasts: Toast[] = [];
  tab: Tab = 'shop';
  sheet: Sheet = null;
  cloudStatus: CloudStatus = 'off';
  cloudAt = 0;
  private cloudStarted = false;
  buyAmount: 1 | 10 | 100 | 'max' = 1;
  private listeners = new Set<() => void>();
  private toastId = 1;
  private maxToasts = 2;
  private modsCache: { at: number; ver: number; m: E.Mods } | null = null;
  private ver = 0;
  private hiddenAt = 0;

  constructor() {
    this.s = this.load();
    this.applySettings();
  }

  // ─── Подписка ──
  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  bump() {
    this.ver++;
    this.listeners.forEach((l) => l());
  }

  mods(): E.Mods {
    const now = Date.now();
    if (this.modsCache && this.modsCache.ver === this.ver && now - this.modsCache.at < 1000) return this.modsCache.m;
    const m = E.computeMods(this.s, now);
    this.modsCache = { at: now, ver: this.ver, m };
    return m;
  }

  // ─── Сохранение ──
  load(): GameState {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) return sanitize(migrate(JSON.parse(raw), Date.now()), Date.now());
    } catch {
      /* повреждённое сохранение — начинаем заново */
    }
    return newGame(Date.now());
  }
  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.s));
    } catch {
      /* хранилище недоступно (приватный режим) */
    }
  }
  exportSave(): string {
    return btoa(unescape(encodeURIComponent(JSON.stringify(this.s))));
  }
  importSave(code: string): boolean {
    try {
      const data = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
      if (!data || typeof data.gold !== 'number') return false;
      this.s = sanitize(migrate(data, Date.now()), Date.now());
      this.save();
      this.applySettings();
      this.bump();
      return true;
    } catch {
      return false;
    }
  }
  hardReset() {
    this.s = newGame(Date.now());
    this.modals = [];
    this.save();
    this.start();
    this.bump();
  }

  applySettings() {
    setNotation(this.s.settings.notation);
    setFxSettings(this.s.settings.sound, this.s.settings.haptics);
  }

  // ─── Жизненный цикл ──
  private timer: number | undefined;

  start() {
    const now = Date.now();
    const report = E.applyOffline(this.s, now);
    this.dailyCheck(now);
    if (!this.s.prologueSeen) {
      this.modals.push({ type: 'dialogue', title: 'Пролог', lines: TEXTS.prologue, onDone: () => (this.s.prologueSeen = true) });
    }
    this.queueChapterStories();
    if (report && report.gold > 0) this.modals.push({ type: 'offline', report });

    if (this.timer) clearInterval(this.timer);
    let n = 0;
    this.timer = window.setInterval(() => {
      this.step();
      if (++n % 50 === 0) this.save();
    }, 100);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.hiddenAt = Date.now();
        this.save();
      } else if (this.hiddenAt) {
        const t = Date.now();
        const rep = E.applyOffline(this.s, t);
        if (rep && rep.gold > 0) this.modals.push({ type: 'offline', report: rep });
        this.dailyCheck(t);
        this.bump();
      }
    });
    window.addEventListener('pagehide', () => this.save());
    this.startCloud();
  }

  /** Облачная синхронизация (Supabase грузится отдельным чанком, не тормозит старт). */
  private startCloud() {
    if (this.cloudStarted) return;
    this.cloudStarted = true;
    void import('../cloud/sync').then((cloud) => {
      this.cloud = cloud;
      void cloud.startCloud({
        getLocal: () => ({ data: this.s, progress: this.s.allTimeEarned, updatedAt: this.s.lastTick }),
        applyCloud: (data) => {
          this.s = sanitize(migrate(data, Date.now()), Date.now());
          E.applyOffline(this.s, Date.now());
          this.applySettings();
          this.save();
          this.toast({ icon: 'save', title: 'Прогресс из облака', text: 'Загружен последний сейв', kind: 'info' });
          this.bump();
        },
        askConflict: (cloud, useCloud, keepLocal) => {
          this.modals.push({ type: 'cloudConflict', progress: cloud.progress, updatedAt: cloud.updatedAt, useCloud, keepLocal });
          this.bump();
        },
        onStatus: (status, at) => {
          this.cloudStatus = status;
          if (at) this.cloudAt = at;
          this.bump();
        },
      });
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) void this.cloud?.pushNow(true);
    });
  }
  cloud: typeof import('../cloud/sync') | null = null;

  private dailyCheck(now: number) {
    const returning = this.s.daily.day !== '';
    if (E.rollDaily(this.s, this.mods(), now, rng) && returning) {
      this.toast({ icon: 'calendar', title: 'Новый день!', text: 'Награда за вход и свежие задания ждут', kind: 'info' });
    }
  }

  private step() {
    const now = Date.now();
    const ev = E.tick(this.s, now, rng);
    if (ev.chapterUp) {
      sfx.fanfare();
      haptic('heavy');
      this.queueChapterStories();
    }
    for (const id of ev.achievements) {
      const a = ACHIEVEMENTS.find((x) => x.id === id);
      if (a) this.toast({ icon: a.icon, title: a.name, text: 'Достижение! +1% к доходу', kind: 'ach' });
    }
    if (ev.challengeDone) {
      sfx.fanfare();
      this.modals.push({ type: 'challengeDone', id: ev.challengeDone });
    }
    if (now % 5000 < 100) this.dailyCheck(now);
    this.bump();
  }

  queueChapterStories() {
    while (this.s.seenChapter < this.s.chapter) {
      const idx = this.s.seenChapter; // 0-based индекс главы
      const ch = TEXTS.chapters[idx];
      this.s.seenChapter++;
      if (!ch) continue;
      this.modals.push({ type: 'dialogue', title: `Глава ${idx + 1}. ${ch.title}`, lines: ch.intro });
    }
  }

  // ─── Модалки и тосты ──
  closeModal() {
    const m = this.modals.shift();
    if (m?.type === 'dialogue') m.onDone?.();
    this.save();
    this.bump();
  }

  toast(t: Omit<Toast, 'id'>) {
    const toast = { ...t, id: this.toastId++ };
    this.toasts.push(toast);
    if (this.toasts.length > this.maxToasts) this.toasts.shift();
    setTimeout(() => {
      this.toasts = this.toasts.filter((x) => x.id !== toast.id);
      this.bump();
    }, 3200);
    this.bump();
  }

  setTab(t: Tab) {
    this.tab = t;
    sfx.soft();
    haptic();
    this.bump();
  }
  openSheet(sh: Sheet) {
    this.sheet = sh;
    this.bump();
  }

  // ─── Действия ──
  tap() {
    return E.tap(this.s, this.mods(), Date.now(), rng);
  }
  catchWisp() {
    return E.catchWisp(this.s, this.mods(), Date.now(), rng);
  }
  buyGen(id: Parameters<typeof E.buyGenerator>[2]) {
    const m = this.mods();
    const n = this.buyAmount === 'max' ? E.maxAffordable(this.s, m, id) : this.buyAmount;
    const got = E.buyGenerator(this.s, m, id, n);
    if (got) {
      sfx.buy();
      haptic('medium');
    } else {
      sfx.error();
    }
    this.bump();
    return got;
  }
  buyUpgrade(id: string) {
    const ok = E.buyUpgrade(this.s, id);
    ok ? (sfx.buy(), haptic('medium')) : sfx.error();
    this.bump();
    return ok;
  }
  recruit(id: string) {
    const ok = E.recruitHero(this.s, id);
    if (ok) {
      sfx.fanfare();
      haptic('heavy');
    } else sfx.error();
    this.bump();
    return ok;
  }
  levelHero(id: string) {
    const ok = E.levelUpHero(this.s, this.mods(), id);
    ok ? (sfx.buy(), haptic('medium')) : sfx.error();
    this.bump();
    return ok;
  }
  startExpedition(loc: Parameters<typeof E.startExpedition>[2], dur: Parameters<typeof E.startExpedition>[3], heroes: string[]) {
    const ok = E.startExpedition(this.s, this.mods(), loc, dur, heroes, Date.now(), rng);
    ok ? (sfx.soft(), haptic('medium')) : sfx.error();
    this.bump();
    return ok;
  }
  collectExpedition(uid: number) {
    const e = this.s.expeditions.find((x) => x.uid === uid);
    const loot = E.collectExpedition(this.s, this.mods(), uid, Date.now(), rng);
    if (loot && e) {
      loot.success ? sfx.fanfare() : sfx.soft();
      haptic('medium');
      this.modals.push({ type: 'loot', loot, location: e.location, heroes: e.heroes });
    }
    this.bump();
  }
  brew(ings: IngredientId[]) {
    const r = E.brew(this.s, this.mods(), ings, Date.now());
    if (r.kind === 'discovered') {
      sfx.discover();
      haptic('heavy');
      this.modals.push({ type: 'discover', recipe: r.recipe });
      if (this.s.finalDone && r.recipe === 'philosophers_stone') {
        this.modals.push({ type: 'dialogue', title: 'Эпилог', lines: TEXTS.epilogue });
      }
    } else if (r.kind === 'brewed') {
      sfx.discover();
      haptic('medium');
    } else if (r.kind === 'failed') {
      sfx.error();
      haptic('light');
    }
    this.bump();
    return r;
  }
  transmute() {
    const g = E.transmute(this.s, Date.now());
    if (g) {
      sfx.discover();
      haptic('heavy');
      this.modals.push({ type: 'dialogue', title: TEXTS.transmutation.title, lines: TEXTS.transmutation.lines });
      this.modals.push({ type: 'transmuted', stones: g });
      this.save();
    }
    this.bump();
    return g;
  }
  startChallenge(id: string) {
    const ok = E.startChallenge(this.s, id, Date.now());
    if (ok) {
      sfx.fanfare();
      this.toast({ icon: CHALLENGE_BY_ID[id].icon, title: `Испытание: ${CHALLENGE_BY_ID[id].name}`, text: 'Удачи, алхимик!', kind: 'warn' });
      this.save();
    }
    this.bump();
  }
  do<T>(fn: (s: GameState, m: E.Mods, now: number, r: E.Rng) => T): T {
    const out = fn(this.s, this.mods(), Date.now(), rng);
    this.bump();
    return out;
  }
}

export const store = new Store();

export function useStore(): Store {
  const [, force] = useReducer<number, void>((x) => x + 1, 0);
  useEffect(() => store.subscribe(() => force()), []);
  return store;
}

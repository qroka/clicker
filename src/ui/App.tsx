import { useEffect, useRef } from 'preact/hooks';
import { store, useStore, type Tab } from './store';
import * as E from '../core/engine';
import { fmt } from './format';
import { attachCanvas, attachFloatLayer, unlockAudio } from './fx';
import { FEATURE_CHAPTER } from '../data/progression';
import { HEROES } from '../data/heroes';
import { ShopTab } from './tabs/Shop';
import { WorkshopTab } from './tabs/Workshop';
import { GuildTab } from './tabs/Guild';
import { LabTab } from './tabs/Lab';
import { KnowledgeTab } from './tabs/Knowledge';
import { Overlays } from './Overlays';
import { Sheets } from './Sheets';

/** Палитры по главам: цвет зелья и свечения фона. */
const PALETTES: [string, string][] = [
  ['#5ee6c4', '#7b5cff'],
  ['#7be38e', '#4f7bff'],
  ['#ffb347', '#ff5d73'],
  ['#ff6f91', '#7b5cff'],
  ['#7fd3ff', '#a98bff'],
  ['#3fcf8e', '#ff7a3d'],
  ['#b388ff', '#5a2fd0'],
  ['#ffd36b', '#ff3355'],
];

export function Coin() {
  return (
    <svg class="coin" viewBox="0 0 24 24">
      <defs>
        <radialGradient id="coinG" cx="35%" cy="30%" r="75%">
          <stop offset="0" stop-color="#fff4c2" />
          <stop offset="0.5" stop-color="#f9cf72" />
          <stop offset="1" stop-color="#c77a12" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r="11" fill="url(#coinG)" stroke="#8a4d05" stroke-width="1" />
      <circle cx="12" cy="12" r="7.5" fill="none" stroke="#b86d12" stroke-width="1" opacity="0.7" />
      <path d="M12 6.5 l1.6 3.4 3.7.4-2.8 2.5.8 3.6L12 14.6l-3.3 1.8.8-3.6-2.8-2.5 3.7-.4z" fill="#b86d12" opacity="0.85" />
    </svg>
  );
}

/** Плавный счётчик золота: обновляется каждый кадр без перерисовки Preact. */
function GoldCounter() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let raf = 0;
    let shown = store.s.gold;
    const loop = () => {
      const s = store.s;
      const now = Date.now();
      const target = s.gold + E.gps(s, store.mods(), now) * Math.min(0.2, (now - s.lastTick) / 1000);
      // Сглаживание: быстро догоняем, но без скачков
      shown = Math.abs(target - shown) / Math.max(1, target) > 0.5 ? target : shown + (target - shown) * 0.35;
      if (ref.current) ref.current.textContent = fmt(shown);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <span ref={ref} class="num" />;
}

function TopBar() {
  const st = useStore();
  const s = st.s;
  const now = Date.now();
  const m = st.mods();
  const g = E.gps(s, m, now);
  const boost = E.prodBuffMult(s, now);
  const dailyCount =
    (E.canClaimLogin(s, now) ? 1 : 0) + s.daily.quests.filter((q) => !q.claimed && q.progress >= q.target).length + (E.canClaimAllBonus(s) ? 1 : 0);
  return (
    <header class="topbar">
      <div class="gold-block">
        <div class="gold-amount">
          <Coin />
          <GoldCounter />
        </div>
        <div class="gps">
          <b class="num">{fmt(g, 1)}</b> в сек{boost > 1 && <span class="boost"> ×{fmt(boost)}</span>}
        </div>
      </div>
      <div class="chips">
        {s.chapter >= FEATURE_CHAPTER.guild && (
          <span class="chip" title="Эссенция">
            💧<span class="num">{fmt(s.essence)}</span>
          </span>
        )}
        {s.stonesEarned > 0 && (
          <span class="chip" title="Философские камни">
            💎<span class="num">{fmt(s.stones)}</span>
          </span>
        )}
      </div>
      <button class="icon-btn" onClick={() => st.openSheet('daily')} aria-label="Ежедневное">
        📅{dailyCount > 0 && <span class="badge">{dailyCount}</span>}
      </button>
      <button class="icon-btn" onClick={() => st.openSheet('settings')} aria-label="Меню">
        ☰
      </button>
    </header>
  );
}

const TABS: { id: Tab; icon: string; label: string; chapter: number }[] = [
  { id: 'shop', icon: '🧪', label: 'Лавка', chapter: 1 },
  { id: 'workshop', icon: '⚒️', label: 'Мастерская', chapter: 1 },
  { id: 'guild', icon: '🛡️', label: 'Гильдия', chapter: FEATURE_CHAPTER.guild },
  { id: 'lab', icon: '📖', label: 'Рецепты', chapter: FEATURE_CHAPTER.recipes },
  { id: 'knowledge', icon: '💎', label: 'Знания', chapter: FEATURE_CHAPTER.transmutation },
];

function TabBar() {
  const st = useStore();
  const s = st.s;
  const now = Date.now();
  const dots: Partial<Record<Tab, boolean>> = {
    workshop: E.availableUpgrades(s).some((u) => u.cost <= s.gold),
    guild: s.expeditions.some((e) => e.end <= now) || HEROES.some((h) => E.canRecruit(s, h)),
    knowledge: E.canTransmute(s) && E.pendingStones(s) >= Math.max(5, s.stonesEarned * 0.5),
  };
  return (
    <nav class="tabbar">
      {TABS.map((t) => {
        const locked = s.chapter < t.chapter;
        return (
          <button
            key={t.id}
            class={`tab ${st.tab === t.id ? 'active' : ''} ${locked ? 'locked' : ''}`}
            onClick={() => {
              if (locked) {
                st.toast({ emoji: '🔒', title: t.label, text: `Откроется в главе ${t.chapter}`, kind: 'info' });
                return;
              }
              st.setTab(t.id);
            }}
          >
            <span class="ti">{locked ? '🔒' : t.icon}</span>
            {t.label}
            {!locked && dots[t.id] && st.tab !== t.id && <span class="dot-badge" />}
          </button>
        );
      })}
    </nav>
  );
}

export function App() {
  const st = useStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const floatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (canvasRef.current) attachCanvas(canvasRef.current);
    if (floatRef.current) attachFloatLayer(floatRef.current);
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { passive: true });
    st.start();
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  const [potion, glow] = PALETTES[Math.min(PALETTES.length, st.s.chapter) - 1];
  useEffect(() => {
    document.documentElement.style.setProperty('--potion', potion);
    document.documentElement.style.setProperty('--glow', glow);
  }, [potion, glow]);

  return (
    <>
      <div class="backdrop" />
      <div id="app">
        <TopBar />
        <main class={`main ${st.tab === 'shop' ? 'no-scroll' : ''}`}>
          {st.tab === 'shop' && <ShopTab />}
          {st.tab === 'workshop' && <WorkshopTab />}
          {st.tab === 'guild' && <GuildTab />}
          {st.tab === 'lab' && <LabTab />}
          {st.tab === 'knowledge' && <KnowledgeTab />}
        </main>
        <TabBar />
      </div>
      <canvas ref={canvasRef} class="fx-canvas" />
      <div ref={floatRef} class="float-layer" />
      <Sheets />
      <Overlays />
    </>
  );
}

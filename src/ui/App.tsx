import { useEffect, useRef } from 'preact/hooks';
import { store, useStore, type Tab } from './store';
import * as E from '../core/engine';
import { fmt } from './format';
import { attachCanvas, attachFloatLayer, unlockAudio } from './fx';
import { FEATURE_CHAPTER } from '../data/progression';
import { HEROES } from '../data/heroes';
import { Ic, Px } from './Px';
import { chapterPalette } from './theme';
import { ShopTab } from './tabs/Shop';
import { WorkshopTab } from './tabs/Workshop';
import { GuildTab } from './tabs/Guild';
import { LabTab } from './tabs/Lab';
import { KnowledgeTab } from './tabs/Knowledge';
import { Overlays } from './Overlays';
import { Sheets } from './Sheets';



export function Coin() {
  return <Px id="coin" scale={2} class="coin" />;
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
          <span class="num">{fmt(g, 1)}</span> в сек{boost > 1 && <span class="boost"> ×{fmt(boost)}</span>}
        </div>
      </div>
      <div class="wallet">
        {s.chapter >= FEATURE_CHAPTER.guild && (
          <span class="pill essence" aria-label="Эссенция">
            <Ic id="essence" />
            {fmt(s.essence)}
          </span>
        )}
        {s.stonesEarned > 0 && (
          <span class="pill" aria-label="Философские камни">
            <Ic id="stone" />
            {fmt(s.stones)}
          </span>
        )}
      </div>
      <button class="icon-btn" onClick={() => st.openSheet('daily')} aria-label="Ежедневное">
        <Px id="calendar" scale={2} />
        {dailyCount > 0 && <span class="badge">{dailyCount}</span>}
      </button>
      <button class="icon-btn" onClick={() => st.openSheet('settings')} aria-label="Меню">
        <Px id="menu" scale={2} />
      </button>
    </header>
  );
}

const TABS: { id: Tab; icon: string; label: string; chapter: number }[] = [
  { id: 'shop', icon: 'flask', label: 'Лавка', chapter: 1 },
  { id: 'workshop', icon: 'hammer', label: 'Мастерская', chapter: 1 },
  { id: 'guild', icon: 'shield', label: 'Гильдия', chapter: FEATURE_CHAPTER.guild },
  { id: 'lab', icon: 'book', label: 'Рецепты', chapter: FEATURE_CHAPTER.recipes },
  { id: 'knowledge', icon: 'stone', label: 'Знания', chapter: FEATURE_CHAPTER.transmutation },
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
                st.toast({ icon: 'lock', title: t.label, text: `Откроется в главе ${t.chapter}`, kind: 'info' });
                return;
              }
              st.setTab(t.id);
            }}
          >
            <span class="ti">
              <Px id={locked ? 'lock' : t.icon} scale={2} />
            </span>
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

  const [potion, glow] = chapterPalette(st.s.chapter);
  useEffect(() => {
    document.documentElement.style.setProperty('--potion', potion);
    document.documentElement.style.setProperty('--glow', glow);
  }, [potion, glow]);

  return (
    <div class="stage">
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
    </div>
  );
}

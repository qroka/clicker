import { useEffect, useRef, useState } from 'preact/hooks';
import { useStore } from '../store';
import * as E from '../../core/engine';
import { Cauldron } from '../Cauldron';
import { burst, floatText, haptic, sfx } from '../fx';
import { fmt, fmtTime, pct } from '../format';
import { TEXTS } from '../../data/texts';
import { CHAPTER_THRESHOLDS, CHALLENGE_BY_ID, challengeGoal } from '../../data/progression';
import type { BuffKind } from '../../core/state';

const BUFF_VIEW: Record<BuffKind, { emoji: string; label: (m: number) => string; cls: string }> = {
  boil: { emoji: '♨️', label: (m) => `Кипение ×${m} тап`, cls: 'hot' },
  frenzy: { emoji: '✨', label: (m) => `Искра ×${m} доход`, cls: 'gold' },
  tapStorm: { emoji: '⚡', label: (m) => `Шторм ×${m} тап`, cls: 'gold' },
  prodBoost: { emoji: '🧪', label: (m) => `Зелье ×${m} доход`, cls: '' },
  tapBoost: { emoji: '💪', label: (m) => `Зелье ×${m} тап`, cls: '' },
  critBoost: { emoji: '🎯', label: (m) => `Криты ×${m}`, cls: '' },
  wispRain: { emoji: '🌠', label: () => 'Дождь искр', cls: '' },
};

function contextTip(st: ReturnType<typeof useStore>): string | null {
  const s = st.s;
  const now = Date.now();
  const m = st.mods();
  const owned = Object.values(s.generators).reduce((a, b) => a + b, 0);
  if (owned === 0 && s.gold >= 15) return 'Загляни в Мастерскую ⚒️ — купи первую ступку. Пусть работает, пока ты стучишь.';
  if (owned === 0) return 'Стучи по котлу! Быстро-быстро — и он закипит.';
  if (E.canClaimLogin(s, now)) return 'Кстати, награда за вход ждёт в календаре 📅. Не благодари.';
  if (s.expeditions.some((e) => e.end <= now)) return 'Экспедиция вернулась! Беги в Гильдию 🛡️ за добычей.';
  if (s.chapter >= 2 && s.expeditions.length < E.expeditionSlots(s) && Object.values(s.heroes).some((h) => h.recruited))
    return 'Герои скучают без дела. Отправь их в экспедицию — там ингредиенты!';
  if (E.canTransmute(s) && E.pendingStones(s) >= Math.max(5, s.stonesEarned)) return `Трансмутация даст ${fmt(E.pendingStones(s))} 💎. Пора переплавить лавку!`;
  if (E.availableUpgrades(s).some((u) => u.cost <= s.gold)) return 'В Мастерской есть улучшение тебе по карману. Удвоение — это красиво.';
  void m;
  return null;
}

export function ShopTab() {
  const st = useStore();
  const s = st.s;
  const now = Date.now();
  const m = st.mods();
  const zone = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<string | null>(null);
  const tipIdx = useRef(Math.floor(Math.random() * TEXTS.catTips.length));

  const showTip = (force = false) => {
    const ctx = contextTip(st);
    if (ctx && (!force || Math.random() < 0.5)) setTip(ctx);
    else {
      tipIdx.current = (tipIdx.current + 1) % TEXTS.catTips.length;
      setTip(TEXTS.catTips[tipIdx.current]);
    }
  };

  useEffect(() => {
    const first = setTimeout(() => showTip(), 1500);
    const iv = setInterval(() => showTip(), 30000);
    return () => {
      clearTimeout(first);
      clearInterval(iv);
    };
  }, []);
  useEffect(() => {
    if (!tip) return;
    const t = setTimeout(() => setTip(null), 9000);
    return () => clearTimeout(t);
  }, [tip]);

  const onTap = (x: number, y: number) => {
    const r = st.tap();
    if (r.gold <= 0) {
      floatText(x, y - 20, 'Не отвечает…', 'teal');
      return;
    }
    floatText(x, y - 20, `+${fmt(r.gold, 1)}`, r.crit ? 'crit' : '');
    burst(x, y, { n: r.crit ? 16 : 5, kind: r.crit ? 'star' : 'bubble', colors: r.crit ? ['#ffb36b', '#fff1b8', '#ff7a3d'] : [getComputedStyle(document.documentElement).getPropertyValue('--potion').trim() || '#5ee6c4', '#ffffff'], up: 2, speed: r.crit ? 6 : 3 });
    if (r.crit) {
      sfx.crit();
      haptic('medium');
    } else {
      sfx.tap();
      haptic('light');
    }
    if (r.boiled) {
      sfx.boil();
      haptic('heavy');
      const rect = zone.current?.getBoundingClientRect();
      if (rect) burst(rect.left + rect.width / 2, rect.top + rect.height * 0.45, { n: 40, kind: 'bubble', colors: ['#ff9a4c', '#ffd36b', '#fff'], speed: 8, up: 5, size: 5 });
      if (s.stats.boils <= 3) st.toast({ emoji: '♨️', title: 'Котёл закипел!', text: 'Тапы ×3 на 8 секунд', kind: 'gold' });
    }
    st.bump();
  };

  const onWisp = (e: PointerEvent) => {
    e.stopPropagation();
    const x = e.clientX;
    const y = e.clientY;
    const r = st.catchWisp();
    if (!r) return;
    sfx.wisp();
    haptic('heavy');
    burst(x, y, { n: 30, kind: 'star', colors: ['#fff1b8', '#ffd36b', '#ffffff'], speed: 7 });
    if (r.kind === 'gold') floatText(x, y, `+${fmt(r.amount)}`, 'crit');
    const text =
      r.kind === 'gold'
        ? `+${fmt(r.amount)} золота`
        : r.kind === 'frenzy'
          ? `Доход ×${r.mult} на ${r.seconds} с`
          : r.kind === 'tapStorm'
            ? `Тапы ×${r.mult} на ${r.seconds} с`
            : `+${r.amount} эссенции`;
    st.toast({ emoji: '✨', title: 'Искра поймана!', text, kind: 'gold' });
    st.bump();
  };

  const chIdx = s.chapter - 1;
  const chText = TEXTS.chapters[chIdx];
  const next = CHAPTER_THRESHOLDS[s.chapter];
  const prev = CHAPTER_THRESHOLDS[chIdx];
  const chProgress = next ? Math.min(1, Math.log10(Math.max(1, s.runEarned) / Math.max(1, prev) + 1) / Math.log10(next / Math.max(1, prev) + 1)) : 1;
  const boiling = (s.buffs.boil?.until ?? 0) > now;
  const buffs = (Object.keys(s.buffs) as BuffKind[]).filter((k) => (s.buffs[k]?.until ?? 0) > now);
  const wd = TEXTS.weeklyEvents[new Date(now).getDay()];
  const challenge = s.challenge ? CHALLENGE_BY_ID[s.challenge] : null;

  return (
    <div class="shop">
      <div class="chapter-strip">
        <div class="grow">
          <div class="ct">
            Глава {s.chapter}. {chText?.title}
          </div>
          <div class="small muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {next ? chText?.goal : s.finalDone ? 'Великое Делание свершилось ✨' : 'Свари Философский камень в Рецептах'}
          </div>
          {next && (
            <div class="bar" style={{ marginTop: 6 }}>
              <i style={{ width: pct(chProgress) }} />
            </div>
          )}
        </div>
        {next && <div class="small num" style={{ color: 'var(--gold)', fontWeight: 800 }}>{pct(chProgress)}</div>}
      </div>

      <div class="buffs">
        <span class="buff" style={{ background: 'rgba(169,139,255,0.12)', borderColor: 'rgba(169,139,255,0.4)', color: 'var(--violet)' }} onClick={() => st.toast({ emoji: wd.emoji, title: wd.name, text: wd.desc, kind: 'info' })}>
          {wd.emoji} {wd.name}
        </span>
        {challenge && (
          <span class="buff hot">
            {challenge.emoji} {fmt(s.runEarned)} / {fmt(challengeGoal(challenge, s.challengeDone[challenge.id] ?? 0))}
          </span>
        )}
        {buffs.map((k) => {
          const v = BUFF_VIEW[k];
          const b = s.buffs[k]!;
          return (
            <span key={k} class={`buff ${v.cls}`}>
              {v.emoji} {v.label(b.mult)} · {fmtTime((b.until - now) / 1000)}
            </span>
          );
        })}
      </div>

      <div class="cauldron-zone" ref={zone}>
        <Cauldron heat={s.heat} boiling={boiling} onTap={onTap} />
        {s.stats.taps < 15 && <div class="tap-hint">👆 Стучи по котлу!</div>}
        {s.wisp && (
          <button
            class={`wisp ${s.wisp.expires - now < 3000 ? 'fading' : ''}`}
            style={{ left: `${s.wisp.x * 100}%`, top: `${s.wisp.y * 100}%` }}
            onPointerDown={onWisp}
            aria-label="Искра"
          >
            ✨
          </button>
        )}
        <div class="cat" onClick={() => (tip ? setTip(null) : showTip(true))}>
          <div class="cat-body">🐈‍⬛</div>
          {tip && <div class="bubble">{tip}</div>}
        </div>
      </div>
      <div class="tap-value">
        Тап: <b class="num">{fmt(E.tapValue(s, m, now), 1)}</b> · крит {pct(m.critChance)} ×{fmt(m.critMult, 1)}
      </div>
    </div>
  );
}

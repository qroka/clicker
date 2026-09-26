import { useEffect, useRef, useState } from 'preact/hooks';
import { useStore } from '../store';
import * as E from '../../core/engine';
import { Cauldron } from '../Cauldron';
import { burst, floatText, haptic, sfx } from '../fx';
import { fmt, fmtTime, pct } from '../format';
import { TEXTS } from '../../data/texts';
import { CHAPTER_THRESHOLDS, CHALLENGE_BY_ID, challengeGoal } from '../../data/progression';
import type { BuffKind } from '../../core/state';
import { Ic, Px } from '../Px';
import { chapterPalette } from '../theme';

const BUFF_VIEW: Record<BuffKind, { icon: string; label: (m: number) => string; cls: string }> = {
  boil: { icon: 'boil', label: (m) => `Кипение ×${m} тап`, cls: 'hot' },
  frenzy: { icon: 'spark', label: (m) => `Искра ×${m} доход`, cls: 'gold' },
  tapStorm: { icon: 'bolt', label: (m) => `Шторм ×${m} тап`, cls: 'gold' },
  prodBoost: { icon: 'flask', label: (m) => `Зелье ×${m} доход`, cls: '' },
  tapBoost: { icon: 'fist', label: (m) => `Зелье ×${m} тап`, cls: '' },
  critBoost: { icon: 'target', label: (m) => `Криты ×${m}`, cls: '' },
  wispRain: { icon: 'starfall', label: () => 'Дождь искр', cls: '' },
};

function contextTip(st: ReturnType<typeof useStore>): string | null {
  const s = st.s;
  const now = Date.now();
  const m = st.mods();
  const owned = Object.values(s.generators).reduce((a, b) => a + b, 0);
  if (owned === 0 && s.gold >= 15) return 'Загляни в Мастерскую — купи первую ступку. Пусть работает, пока ты стучишь.';
  if (owned === 0) return 'Стучи по котлу! Быстро-быстро — и он закипит.';
  if (E.canClaimLogin(s, now)) return 'Кстати, награда за вход ждёт в календаре. Не благодари.';
  if (s.expeditions.some((e) => e.end <= now)) return 'Экспедиция вернулась! Беги в Гильдию за добычей.';
  if (s.chapter >= 2 && s.expeditions.length < E.expeditionSlots(s) && Object.values(s.heroes).some((h) => h.recruited))
    return 'Герои скучают без дела. Отправь их в экспедицию — там ингредиенты!';
  if (E.canTransmute(s) && E.pendingStones(s) >= Math.max(5, s.stonesEarned)) return `Трансмутация даст ${fmt(E.pendingStones(s))} камней. Пора переплавить лавку!`;
  if (E.availableUpgrades(s).some((u) => u.cost <= s.gold)) return 'В Мастерской есть улучшение тебе по карману. Удвоение — это красиво.';
  void m;
  const nav = navigator as Navigator & { standalone?: boolean };
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  if (ios && !nav.standalone && s.stats.playSeconds > 120 && Math.random() < 0.35)
    return 'Совет от кота: «Поделиться» → «На экран Домой». Лавка откроется как приложение, на весь экран.';
  return null;
}

export function ShopTab() {
  const st = useStore();
  const s = st.s;
  const now = Date.now();
  const zone = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<string | null>(null);
  const catRef = useRef<HTMLDivElement>(null);
  const catPets = useRef(0);
  const [catFace, setCatFace] = useState<'cat_idle' | 'cat_blink' | 'cat_happy'>('cat_idle');
  useEffect(() => {
    const iv = setInterval(() => {
      setCatFace((f) => (f === 'cat_idle' ? 'cat_blink' : f));
      setTimeout(() => setCatFace((f) => (f === 'cat_blink' ? 'cat_idle' : f)), 160);
    }, 3800);
    return () => clearInterval(iv);
  }, []);
  const potionColor = chapterPalette(s.chapter)[0];
  const replay = (el: Element | null | undefined, cls: string) => {
    if (!el) return;
    el.classList.remove(cls);
    void (el as HTMLElement).offsetWidth;
    el.classList.add(cls);
  };
  const petCat = () => {
    catPets.current++;
    if (catPets.current % 5 === 0) {
      setCatFace('cat_happy');
      setTip('Мррр… Ладно, так и быть. Продолжай.');
      [0, 80, 160].forEach((d) => setTimeout(() => haptic('light'), d));
      replay(catRef.current, 'puff');
      setTimeout(() => setCatFace('cat_idle'), 2500);
    } else if (tip) setTip(null);
    else showTip(true);
  };
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
    const iv = setInterval(() => showTip(), 60000);
    return () => {
      clearTimeout(first);
      clearInterval(iv);
    };
  }, []);
  useEffect(() => {
    if (!tip) return;
    const t = setTimeout(() => setTip(null), 7000);
    return () => clearTimeout(t);
  }, [tip]);

  const onTap = (x: number, y: number) => {
    const r = st.tap();
    if (r.gold <= 0) {
      floatText(x, y - 20, 'Не отвечает…', 'teal');
      return;
    }
    floatText(x, y - 20, `+${fmt(r.gold, 1)}`, r.crit ? 'crit' : '');
    burst(x, y, { n: r.crit ? 8 : 1, kind: r.crit ? 'star' : 'bubble', colors: r.crit ? ['#feae34', '#fee761', '#f77622'] : [potionColor, '#ffffff'], up: 2, speed: r.crit ? 6 : 3 });
    replay(document.querySelector('.gold-amount'), 'bump');
    if (r.crit) {
      replay(zone.current, 'crit');
      replay(catRef.current, 'jump');
      sfx.crit();
      haptic('medium');
    } else {
      sfx.tap();
      haptic('light');
    }
    if (r.boiled) {
      sfx.boil();
      haptic('heavy');
      replay(catRef.current, 'puff');
      const rect = zone.current?.getBoundingClientRect();
      if (rect) burst(rect.left + rect.width / 2, rect.top + rect.height * 0.45, { n: 18, kind: 'bubble', colors: ['#ff9a4c', '#ffd36b', '#fff'], speed: 7, up: 5, size: 5 });
      if (s.stats.boils <= 3) st.toast({ icon: 'boil', title: 'Котёл закипел!', text: 'Тапы ×3 на 8 секунд', kind: 'gold' });
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
    st.toast({ icon: 'spark', title: 'Искра поймана!', text, kind: 'gold' });
    st.bump();
  };

  const chIdx = s.chapter - 1;
  const chText = TEXTS.chapters[chIdx];
  const next = CHAPTER_THRESHOLDS[s.chapter];
  const prev = CHAPTER_THRESHOLDS[chIdx];
  const chProgress = next ? Math.min(1, Math.log10(Math.max(1, s.runEarned) / Math.max(1, prev) + 1) / Math.log10(next / Math.max(1, prev) + 1)) : 1;
  const boiling = (s.buffs.boil?.until ?? 0) > now;
  const buffs = (Object.keys(s.buffs) as BuffKind[]).filter((k) => (s.buffs[k]?.until ?? 0) > now);
  const challenge = s.challenge ? CHALLENGE_BY_ID[s.challenge] : null;

  return (
    <div class="shop">
      <button
        class="shop-head"
        onClick={() => chText && st.toast({ icon: 'book', title: `Глава ${s.chapter}. ${chText.title}`, text: next ? chText.goal : 'Свари Философский камень', kind: 'info' })}
      >
        <div class="grow" style={{ textAlign: 'left' }}>
          <div class="row" style={{ gap: 8 }}>
            <span class="cn">Глава {s.chapter}</span>
            <span class="ct grow">{chText?.title}</span>
            {next && <span class="cn num">{pct(chProgress)}</span>}
          </div>
          {next && (
            <div class="bar">
              <i style={{ width: pct(chProgress) }} />
            </div>
          )}
        </div>
      </button>

      <div class="buffs">
        {challenge && (
          <span class="buff hot">
            <Ic id={challenge.icon} /> {fmt(s.runEarned)} / {fmt(challengeGoal(challenge, s.challengeDone[challenge.id] ?? 0))}
          </span>
        )}
        {buffs.map((k) => {
          const v = BUFF_VIEW[k];
          const b = s.buffs[k]!;
          return (
            <span key={k} class={`buff ${v.cls}`}>
              <Ic id={v.icon} /> {v.label(b.mult)} · {fmtTime((b.until - now) / 1000)}
            </span>
          );
        })}
      </div>

      <div class="cauldron-zone" ref={zone}>
        <Cauldron heat={s.heat} boiling={boiling} potion={potionColor} onTap={onTap} />
        {s.stats.taps < 15 && !tip && <div class="tap-hint">
            <Ic id="hand_tap" /> Стучи по котлу!
          </div>}
        {s.wisp && (
          <button
            class={`wisp ${s.wisp.expires - now < 3000 ? 'fading' : ''}`}
            style={{ left: `${s.wisp.x * 100}%`, top: `${s.wisp.y * 100}%` }}
            onPointerDown={onWisp}
            aria-label="Искра"
          >
            <Px id="spark" scale={3} />
          </button>
        )}
        <div class="cat">
          <div class="cat-body" ref={catRef} onClick={petCat}>
            <Px id={catFace} scale={3} />
          </div>
          {tip && !st.modals.length && !st.toasts.length && (
            <div class="bubble" onClick={() => setTip(null)}>
              {tip}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

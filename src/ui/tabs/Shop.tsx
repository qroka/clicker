import { useEffect, useRef, useState } from 'preact/hooks';
import { useStore } from '../store';
import * as E from '../../core/engine';
import { Cauldron } from '../Cauldron';
import { burst, floatText, haptic, sfx } from '../fx';
import { fmt, fmtTime } from '../format';
import { TEXTS } from '../../data/texts';
import { CHAPTER_THRESHOLDS, CHALLENGE_BY_ID, challengeGoal } from '../../data/progression';
import type { BuffKind } from '../../core/state';
import { Ic, Px } from '../Px';
import { worldPalette } from '../theme';
import { Bar } from '../kit';
import { HEROES } from '../../data/heroes';
import { LOC_BY_ID } from '../../data/world';
import { spriteUrl } from '../Px';
import { SPRITES } from '../../art';

/** Ночная лавка за котлом: стена из досок, окно с луной, полки со склянками, пол. */
function ShopScene() {
  const S = Math.max(2, Math.min(4, Math.floor(Math.min(window.innerWidth, 560) / 134)));
  const bg = (id: string) => {
    const d = SPRITES[id];
    return { backgroundImage: `url(${spriteUrl(id)})`, backgroundSize: `${d.w * S}px ${d.h * S}px` };
  };
  const img = (id: string, cls: string) => {
    const d = SPRITES[id];
    return <img class={`px ${cls}`} src={spriteUrl(id) ?? ''} width={d.w * S} height={d.h * S} alt="" draggable={false} />;
  };
  return (
    <div class="scene" aria-hidden="true" style={bg('bg_wall')}>
      {img('bg_window', 'sc-window')}
      {img('bg_shelf', 'sc-shelf')}
      {img('bg_shelf2', 'sc-shelf2')}
      <div class="sc-floor" style={{ ...bg('bg_floor'), '--fill': `url(${spriteUrl('bg_floor_fill')})`, '--fs': `${32 * S}px ${11 * S}px`, '--fh': `${16 * S}px` }} />
      <div class="sc-rift" />
      <div class="sc-shade" />
    </div>
  );
}

/** Заголовок в Изнанке: какое испытание, цель и выход домой. */
function RiftHeader() {
  const st = useStore();
  const s = st.s;
  const c = CHALLENGE_BY_ID[s.challenge!];
  const goal = challengeGoal(c, s.challengeDone[c.id] ?? 0);
  const progress = Math.min(1, Math.log10(Math.max(1, s.runEarned) + 1) / Math.log10(goal + 1));
  return (
    <div class="chapter rift-head">
      <div class="top">
        <span class="label">Изнанка</span>
        <span class="ttl">
          <Ic id={c.icon} /> {c.name}
        </span>
        <button class="btn2 home" onClick={() => st.leaveChallenge()}>
          Домой
        </button>
      </div>
      <Bar value={progress} />
      <div class="goal">
        <span>{c.desc}</span>
        <span class="num">
          <b>{fmt(Math.min(s.runEarned, goal))}</b> / {fmt(goal)}
        </span>
      </div>
    </div>
  );
}

/** Гость из гильдии стоит у котла; тап — разговор и предложение. */
function Visitor() {
  const st = useStore();
  const v = st.s.visit;
  if (!v) return null;
  const h = E.HERO_BY_ID[v.hero];
  const leaving = !v.talked && v.leaves - Date.now() < 15_000;
  return (
    <button
      key={v.arrived}
      class={`visitor ${leaving ? 'leaving' : ''}`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={() => st.openVisit()}
      aria-label={`${h.name} — поговорить`}
    >
      <span class="bang">!</span>
      <span class="plate">
        <Px id={h.id} scale={3} />
      </span>
      <span class="who">{h.name.split(' ')[0]}</span>
    </button>
  );
}

/** Экспедиции на главном экране: видно, кто в пути и кто уже вернулся. */
function ExpeditionStrip() {
  const st = useStore();
  const s = st.s;
  const now = Date.now();
  const slots = E.expeditionSlots(s);
  if (!slots) return null;
  const free = slots - s.expeditions.length;
  const anyIdle = HEROES.some((h) => s.heroes[h.id]?.recruited && !s.expeditions.some((e) => e.heroes.includes(h.id)));
  const toGuild = () => {
    st.guildView = 'exp';
    st.setTab('guild');
  };
  const showAdd = free > 0 && anyIdle;
  const n = s.expeditions.length + (showAdd ? 1 : 0);
  if (!n) return null;
  const ic = n >= 3 ? 1 : 2;
  return (
    <div class={`exp-strip n${n}`}>
      {s.expeditions.map((e) => {
        const left = (e.end - now) / 1000;
        const ready = left <= 0;
        return (
          <button key={e.uid} class={`exp-chip ${ready ? 'ready' : ''}`} onClick={() => (ready ? st.collectExpedition(e.uid) : toGuild())}>
            <span class="ico">
              <Px id={LOC_BY_ID[e.location].id} scale={ic} />
            </span>
            <span class="txt">
              <b>{ready ? (n >= 3 ? 'Забрать' : 'Вернулись!') : fmtTime(left)}</b>
              <small>{ready ? 'Забрать добычу' : TEXTS.locations[e.location].name}</small>
            </span>
            {!ready && <i class="prog" style={{ width: `${Math.min(100, ((now - e.start) / (e.end - e.start)) * 100)}%` }} />}
          </button>
        );
      })}
      {showAdd && (
        <button class="exp-chip add" onClick={() => st.openSheet({ expedition: true })}>
          <span class="ico">
            <Px id="compass" scale={ic} />
          </span>
          <span class="txt">
            <b>{n >= 3 ? 'В путь' : 'Отправить'}</b>
            <small>{free === 1 ? 'Свободный слот' : `Слотов: ${free}`}</small>
          </span>
        </button>
      )}
    </div>
  );
}

const BUFF_VIEW: Record<BuffKind, { icon: string; label: string }> = {
  boil: { icon: 'boil', label: 'тап' },
  frenzy: { icon: 'spark', label: 'доход' },
  tapStorm: { icon: 'bolt', label: 'тап' },
  prodBoost: { icon: 'flask', label: 'доход' },
  tapBoost: { icon: 'fist', label: 'тап' },
  critBoost: { icon: 'target', label: 'криты' },
  wispRain: { icon: 'starfall', label: 'искры' },
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
  const potionColor = worldPalette(s.chapter, !!s.challenge)[0];
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

  const noTapHint = useRef(0);
  const onTap = (x: number, y: number) => {
    const r = st.tap();
    if (r.gold <= 0) {
      if (Date.now() - noTapHint.current > 1200) {
        noTapHint.current = Date.now();
        floatText(x, y - 20, 'Не отвечает…', 'teal');
      }
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
      <ShopScene />
      {challenge ? (
        <RiftHeader />
      ) : (
        <button
          class="chapter"
          onClick={() =>
            chText &&
            st.toast({
              icon: 'book',
              title: `Глава ${s.chapter}. ${chText.title}`,
              text: next ? `${chText.goal}. Следующая глава — когда за забег заработаешь ${fmt(next)} золота` : chText.goal,
              kind: 'info',
            })
          }
        >
          <div class="top">
            <span class="label">Глава {s.chapter}</span>
            <span class="ttl">{chText?.title}</span>
          </div>
          {next ? (
            <>
              <Bar value={chProgress} />
              <div class="goal">
                <span>Заработай за забег</span>
                <span class="num">
                  <b>{fmt(Math.min(s.runEarned, next))}</b> / {fmt(next)}
                </span>
              </div>
            </>
          ) : (
            <div class="goal">
              <span>{chText?.goal ?? 'Свари Философский камень'}</span>
            </div>
          )}
        </button>
      )}

      <ExpeditionStrip />

      {buffs.length > 0 && (
        <div class="buffs">
          {buffs.map((k) => {
            const v = BUFF_VIEW[k];
            const b = s.buffs[k]!;
            return (
              <span key={k} class="buff">
                <Ic id={v.icon} />
                <span class="num">×{b.mult}</span> {v.label}
                <span class="tm">{fmtTime((b.until - now) / 1000)}</span>
              </span>
            );
          })}
        </div>
      )}

      <div class="cauldron-zone" ref={zone}>
        {/* Подсказка над котлом, в потоке: зона прижата к низу, котёл не сдвигается */}
        {s.stats.taps < 15 && !tip && <div class="tap-hint">Стучи по котлу</div>}
        <Cauldron heat={s.heat} boiling={boiling} potion={potionColor} onTap={onTap} />
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
        <Visitor />
        <div class="cat">
          <div class="cat-body" ref={catRef} onClick={petCat}>
            <Px id={catFace} scale={3} />
          </div>
          {/* Реплика рядом с котом; может лечь на котёл — тапы проходят сквозь неё */}
          {tip && !st.modals.length && !st.toasts.length && (
            <div class="bubble">
              <span class="who">Ртуть</span>
              {tip}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

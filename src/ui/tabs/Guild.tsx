import { useState } from 'preact/hooks';
import { useStore } from '../store';
import * as E from '../../core/engine';
import { HEROES } from '../../data/heroes';
import { LOC_BY_ID } from '../../data/world';
import { TEXTS } from '../../data/texts';
import { fmt, fmtTime } from '../format';
import type { HeroDef } from '../../core/types';

export function Portrait({ h, locked, busy, size }: { h: HeroDef; locked?: boolean; busy?: boolean; size?: 'lg' }) {
  return (
    <div class={`portrait ${size ?? ''} ${locked ? 'locked' : ''} ${busy ? 'busy' : ''}`} style={{ '--c': h.color }}>
      {locked ? '❔' : h.emoji}
    </div>
  );
}

function Heroes() {
  const st = useStore();
  const s = st.s;
  const m = st.mods();
  const busy = E.busyHeroes(s);
  const recruited = HEROES.filter((h) => s.heroes[h.id]?.recruited).length;
  const order = [...HEROES].sort((a, b) => {
    const ra = s.heroes[a.id]?.recruited ? 0 : E.heroUnlocked(s, a) ? 1 : 2;
    const rb = s.heroes[b.id]?.recruited ? 0 : E.heroUnlocked(s, b) ? 1 : 2;
    return ra - rb || a.chapter - b.chapter;
  });
  return (
    <>
      <div class="card row" style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 30 }}>🏰</div>
        <div class="grow">
          <b>Слава гильдии: +{Math.round(recruited * E.BAL.heroBonusPerRecruit * 100)}% к доходу</b>
          <div class="small muted">
            Героев: {recruited}/{HEROES.length} · каждый даёт +3% и свой бонус
          </div>
        </div>
      </div>
      <div class="hero-grid">
        {order.map((h) => {
          const hs = s.heroes[h.id];
          const unlocked = E.heroUnlocked(s, h);
          const rec = hs?.recruited;
          const canUp = rec && hs.level < E.BAL.maxHeroLevel && s.essence >= E.heroLevelCost(s, m, h);
          const canRec = E.canRecruit(s, h);
          return (
            <button key={h.id} class="hero-card" onClick={() => st.openSheet({ hero: h.id })}>
              {(canUp || canRec) && <span class="can-up">{canRec ? '!' : '↑'}</span>}
              <Portrait h={h} locked={!unlocked} busy={busy.has(h.id)} />
              <div class="hn">{unlocked ? h.name : '???'}</div>
              {rec ? (
                <span class="hl">Ур. {hs.level}</span>
              ) : unlocked ? (
                h.recruit === 'gold' ? (
                  <span class="hl" style={{ color: s.gold >= E.heroGoldCost(h) ? 'var(--green)' : 'var(--dim)' }}>
                    🪙 {fmt(E.heroGoldCost(h))}
                  </span>
                ) : (
                  <span class="hl" style={{ color: 'var(--violet)' }}>
                    📜 {hs?.shards ?? 0}/{E.BAL.heroShardsNeeded[h.rarity]}
                  </span>
                )
              ) : (
                <span class="hl dim">Глава {h.chapter}</span>
              )}
              <span class={`rarity ${h.rarity}`}>{h.rarity === 'legendary' ? 'Легенда' : h.rarity === 'epic' ? 'Эпик' : h.rarity === 'rare' ? 'Редкий' : 'Обычный'}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

function Expeditions() {
  const st = useStore();
  const s = st.s;
  const now = Date.now();
  const slots = E.expeditionSlots(s);
  const anyHero = HEROES.some((h) => s.heroes[h.id]?.recruited);
  return (
    <div class="stack">
      <div class="small muted" style={{ margin: '0 2px 4px' }}>
        Слотов: {s.expeditions.length}/{slots}
        {slots < 3 ? ` · ещё слот откроется в главе ${slots === 1 ? 4 : 6}` : ''}
      </div>
      {s.expeditions.map((e) => {
        const loc = LOC_BY_ID[e.location];
        const left = (e.end - now) / 1000;
        const ready = left <= 0;
        const prog = Math.min(1, (now - e.start) / (e.end - e.start));
        return (
          <div key={e.uid} class={`exp-slot ${ready ? 'ready' : ''}`}>
            <div class="loc-icon">{loc.emoji}</div>
            <div class="grow">
              <b>{TEXTS.locations[e.location].name}</b>
              <div class="mini-team">{e.heroes.map((id) => E.HERO_BY_ID[id]?.emoji)}</div>
              {!ready && (
                <div class="bar teal" style={{ marginTop: 5 }}>
                  <i style={{ width: `${prog * 100}%` }} />
                </div>
              )}
            </div>
            {ready ? (
              <button class="btn teal" onClick={() => st.collectExpedition(e.uid)}>
                Забрать
              </button>
            ) : (
              <span class="small num" style={{ fontWeight: 800 }}>
                ⏳ {fmtTime(left)}
              </span>
            )}
          </div>
        );
      })}
      {Array.from({ length: Math.max(0, slots - s.expeditions.length) }).map((_, i) => (
        <button key={i} class="exp-slot empty" onClick={() => (anyHero ? st.openSheet({ expedition: true }) : st.toast({ emoji: '🛡️', title: 'Нужен герой', text: 'Сначала найми героя в гильдию', kind: 'info' }))}>
          ＋ Отправить экспедицию
        </button>
      ))}
      <div class="card small muted" style={{ marginTop: 6 }}>
        🧭 Экспедиции приносят ингредиенты для рецептов, эссенцию для героев и осколки контрактов легендарных гостей. Длинные вылазки выгоднее — отправляй их перед сном.
      </div>
    </div>
  );
}

export function GuildTab() {
  const st = useStore();
  const [sub, setSub] = useState<'heroes' | 'exp'>('heroes');
  const ready = st.s.expeditions.filter((e) => e.end <= Date.now()).length;
  return (
    <div>
      <div class="section-title">
        <h2>Гильдия</h2>
        <div class="seg" style={{ width: 210 }}>
          <button class={sub === 'heroes' ? 'on' : ''} onClick={() => setSub('heroes')}>
            Герои
          </button>
          <button class={sub === 'exp' ? 'on' : ''} onClick={() => setSub('exp')}>
            Экспедиции{ready > 0 && <span class="cnt">{ready}</span>}
          </button>
        </div>
      </div>
      {sub === 'heroes' ? <Heroes /> : <Expeditions />}
    </div>
  );
}

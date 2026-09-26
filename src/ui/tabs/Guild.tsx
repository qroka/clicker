import { useState } from 'preact/hooks';
import { useStore } from '../store';
import * as E from '../../core/engine';
import { HEROES } from '../../data/heroes';
import { LOC_BY_ID } from '../../data/world';
import { TEXTS } from '../../data/texts';
import { fmt, fmtTime } from '../format';
import type { HeroDef } from '../../core/types';
import { Px } from '../Px';
import { Glyph, Row, ScreenTitle, Section, StateBox } from '../kit';

export function Portrait({ h, locked, busy, size }: { h: HeroDef; locked?: boolean; busy?: boolean; size?: 'lg' | 'sm' }) {
  const color = { common: 'var(--r-common)', rare: 'var(--r-rare)', epic: 'var(--r-epic)', legendary: 'var(--r-legendary)' }[h.rarity];
  return (
    <div class={`portrait ${size ?? ''} ${locked ? 'locked' : ''} ${busy ? 'busy' : ''}`} style={{ '--c': color }}>
      {locked ? <Glyph name="lock" cell={size === 'lg' ? 5 : 3} color="var(--text-4)" /> : <Px id={h.id} scale={size === 'lg' ? 4 : size === 'sm' ? 1 : 2} />}
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
      <Row
        icon={<Px id="castle" scale={2} />}
        name="Слава гильдии"
        count={<span class="plus">+{Math.round(recruited * E.BAL.heroBonusPerRecruit * 100)}%</span>}
        sub={`${recruited} из ${HEROES.length} героев · каждый +3% к доходу`}
      />
      <div class="hero-grid" style={{ marginTop: 12 }}>
        {order.map((h) => {
          const hs = s.heroes[h.id];
          const unlocked = E.heroUnlocked(s, h);
          const rec = hs?.recruited;
          const canUp = rec && hs.level < E.BAL.maxHeroLevel && s.essence >= E.heroLevelCost(s, m, h);
          const canRec = E.canRecruit(s, h);
          return (
            <button key={h.id} class={`tile ${canRec ? 'claim' : ''} ${unlocked ? '' : 'locked'}`} onClick={() => st.openSheet({ hero: h.id })} aria-label={unlocked ? h.name : 'Неизвестный гость'}>
              {canUp && <span class="dot" />}
              <Portrait h={h} locked={!unlocked} busy={busy.has(h.id)} />
              <div class="tn">{unlocked ? h.name : `Глава ${h.chapter}`}</div>
              {rec ? (
                <span class="tl">Ур. {hs.level}</span>
              ) : unlocked ? (
                h.recruit === 'gold' ? (
                  <span class="tl" style={{ color: canRec ? 'var(--gold)' : undefined }}>
                    {fmt(E.heroGoldCost(h))}
                  </span>
                ) : (
                  <span class="tl">
                    {hs?.shards ?? 0}/{E.BAL.heroShardsNeeded[h.rarity]}
                  </span>
                )
              ) : null}
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
      {s.expeditions.map((e) => {
        const left = (e.end - now) / 1000;
        const ready = left <= 0;
        return (
          <Row
            key={e.uid}
            icon={<Px id={LOC_BY_ID[e.location].id} scale={2} />}
            name={TEXTS.locations[e.location].name}
            count={ready ? <span class="plus">вернулись</span> : fmtTime(left)}
            progress={{ value: Math.min(1, (now - e.start) / (e.end - e.start)), full: ready }}
            claim={ready}
            right={<StateBox state={ready ? 'claim' : 'todo'} />}
            onClick={ready ? () => st.collectExpedition(e.uid) : undefined}
          />
        );
      })}
      {Array.from({ length: Math.max(0, slots - s.expeditions.length) }).map((_, i) => (
        <Row
          key={`free${i}`}
          icon={<Glyph name="plus" cell={3} color="var(--text-2)" />}
          name="Отправить экспедицию"
          sub="Свободный слот"
          onClick={() => (anyHero ? st.openSheet({ expedition: true }) : st.toast({ icon: 'shield', title: 'Нужен герой', text: 'Сначала найми героя', kind: 'info' }))}
        />
      ))}
      {slots < 3 && <p class="hint">Ещё слот откроется в главе {slots === 1 ? 4 : 6}</p>}
    </div>
  );
}

export function GuildTab() {
  const st = useStore();
  const [sub, setSub] = useState<'heroes' | 'exp'>('heroes');
  const ready = st.s.expeditions.filter((e) => e.end <= Date.now()).length;
  return (
    <div>
      <ScreenTitle>Гильдия</ScreenTitle>
      <div class="seg tabs2">
        <button class={sub === 'heroes' ? 'on' : ''} onClick={() => setSub('heroes')} style={{ fontFamily: 'var(--ui)', fontWeight: 600 }}>
          Герои
        </button>
        <button class={sub === 'exp' ? 'on' : ''} onClick={() => setSub('exp')} style={{ fontFamily: 'var(--ui)', fontWeight: 600 }}>
          Экспедиции{ready ? ` · ${ready}` : ''}
        </button>
      </div>
      {sub === 'heroes' ? (
        <Heroes />
      ) : (
        <Section
          help={() =>
            st.toast({ icon: 'compass', title: 'Экспедиции', text: 'Ингредиенты, эссенция и осколки. Долгие — выгоднее', kind: 'info' })
          }
          title="В пути"
        >
          <Expeditions />
        </Section>
      )}
    </div>
  );
}

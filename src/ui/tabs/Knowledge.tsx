import { useState } from 'preact/hooks';
import { useStore } from '../store';
import * as E from '../../core/engine';
import { CHALLENGES, CHALLENGE_MAX, TALENTS, challengeGoal } from '../../data/progression';
import { fmt, pct } from '../format';
import { burst } from '../fx';
import { Ic, Px } from '../Px';

const BRANCHES = [
  { id: 'tap', name: 'Руки мастера' },
  { id: 'idle', name: 'Мастерская' },
  { id: 'guild', name: 'Гильдия' },
] as const;

function Transmutation() {
  const st = useStore();
  const s = st.s;
  const [confirm, setConfirm] = useState(false);
  const pending = E.pendingStones(s);
  const now = s.stonesEarned * E.BAL.stoneBonus;
  const after = (s.stonesEarned + pending) * E.BAL.stoneBonus;
  const can = E.canTransmute(s);
  const nextGold = E.goldForNextStone(s);
  return (
    <div class="card stone-hero">
      <div class="stone-gem">
        <Px id="stone" scale={4} />
      </div>
      <h2 style={{ color: 'var(--gold)', fontSize: 22 }}>Трансмутация</h2>
      <div class="small muted" style={{ margin: '4px 0 12px' }}>
        Переплавь лавку: золото, постройки и улучшения сгорят, а философские камни останутся навсегда. Герои, рецепты, ингредиенты и таланты — тоже.
      </div>
      <div class="row" style={{ justifyContent: 'center', gap: 18, marginBottom: 12 }}>
        <div>
          <div class="small muted">Сейчас</div>
          <b class="num">
            <Ic id="stone" /> {fmt(s.stonesEarned)}
          </b>
          <div class="small" style={{ color: 'var(--teal)' }}>+{pct(now)} доход</div>
        </div>
        <Px id="arrow_right" scale={2} />
        <div>
          <div class="small muted">После</div>
          <b class="num" style={{ color: 'var(--gold)' }}>
            <Ic id="stone" /> {fmt(s.stonesEarned + pending)}
          </b>
          <div class="small" style={{ color: 'var(--teal)' }}>+{pct(after)} доход</div>
        </div>
      </div>
      <div class="small muted" style={{ marginBottom: 10 }}>
        Каждый добытый камень навсегда даёт +{pct(E.BAL.stoneBonus)} к доходу — даже потраченный на таланты. Следующий камень при <Ic id="coin" /> {fmt(nextGold)} заработанных за всё время.
      </div>
      {confirm ? (
        <div class="row">
          <button class="btn ghost grow" onClick={() => setConfirm(false)}>
            Отмена
          </button>
          <button
            class="btn violet grow"
            onClick={(e) => {
              setConfirm(false);
              if (st.transmute()) burst(e.clientX, e.clientY, { n: 60, kind: 'star', colors: ['#ff5d8a', '#ffd36b', '#fff'], speed: 9 });
            }}
          >
            Да, переплавить!
          </button>
        </div>
      ) : (
        <button class={`btn violet block big ${can ? '' : 'disabled'}`} onClick={() => can && setConfirm(true)}>
          {can ? (
            <>
              <Ic id="recycle" /> Трансмутировать: +{fmt(pending)} <Ic id="stone" />
            </>
          ) : (
            'Нужен хотя бы 1 камень'
          )}
        </button>
      )}
    </div>
  );
}

function Talents() {
  const st = useStore();
  const s = st.s;
  return (
    <>
      <div class="section-title">
        <h2>Древо знаний</h2>
        <button
          class="small muted"
          onClick={() => {
            const r = st.do((s) => E.respecTalents(s));
            if (r) st.toast({ icon: 'refresh', title: 'Таланты сброшены', text: `Возвращено камней: ${fmt(r)}`, kind: 'info' });
          }}
        >
          <Ic id="refresh" /> Сбросить
        </button>
      </div>
      <div class="talent-cols">
        {BRANCHES.map((b) => (
          <div key={b.id} class="talent-col">
            <h3>{b.name}</h3>
            {TALENTS.filter((t) => t.branch === b.id)
              .sort((a, c) => a.tier - c.tier)
              .map((t, i) => {
                const lv = s.talents[t.id] ?? 0;
                const avail = E.talentAvailable(s, t.id);
                const maxed = lv >= t.maxLevel;
                const cost = E.talentCost(t.id, lv);
                const can = avail && !maxed && s.stones >= cost;
                return (
                  <div key={t.id}>
                    {i > 0 && <div class="link" />}
                    <button
                      class={`talent ${can ? 'can' : ''} ${avail ? '' : 'locked'} ${maxed ? 'maxed' : ''}`}
                      onClick={(e) => {
                        if (st.do((s) => E.buyTalent(s, t.id))) burst(e.clientX, e.clientY, { n: 16, kind: 'star', colors: ['#a98bff', '#fff'] });
                        else st.toast({ icon: t.icon, title: t.name, text: t.desc, kind: 'info' });
                      }}
                    >
                      <span class="te">
                        <Px id={t.icon} scale={2} />
                      </span>
                      <span class="tn">{t.name}</span>
                      <span class="tl num">
                        {lv}/{t.maxLevel}
                      </span>
                      {!maxed && (
                        <span class="small num" style={{ color: can ? 'var(--violet)' : 'var(--dim)', fontWeight: 800 }}>
                          <Ic id="stone" /> {fmt(cost)}
                        </span>
                      )}
                    </button>
                  </div>
                );
              })}
          </div>
        ))}
      </div>
      <div class="small muted" style={{ textAlign: 'center' }}>
        Нажми на талант, чтобы изучить. Тратить камни не страшно — их бонус к доходу сохраняется. Сброс бесплатный — экспериментируй с билдами!
      </div>
    </>
  );
}

function Challenges() {
  const st = useStore();
  const s = st.s;
  const [confirm, setConfirm] = useState<string | null>(null);
  if (s.transmutations < 1) return null;
  return (
    <>
      <div class="section-title">
        <h2>Испытания</h2>
        <small>особые забеги с правилами</small>
      </div>
      <div class="stack">
        {CHALLENGES.map((c) => {
          const done = s.challengeDone[c.id] ?? 0;
          const active = s.challenge === c.id;
          const goal = challengeGoal(c, done);
          return (
            <div key={c.id} class={`challenge ${active ? 'active' : ''}`}>
              <div style={{ width: 44, flex: 'none', display: 'grid', placeItems: 'center' }}>
                <Px id={c.icon} scale={2} />
              </div>
              <div class="grow">
                <b>{c.name}</b>
                <div class="small muted">{c.desc}</div>
                <div class="small" style={{ color: 'var(--teal)', fontWeight: 700 }}>
                  Цель: <Ic id="coin" /> {fmt(goal)} · Награда: {c.rewardText}
                </div>
                <div class="pips" style={{ marginTop: 4 }}>
                  {Array.from({ length: CHALLENGE_MAX }).map((_, i) => (
                    <i key={i} class={i < done ? 'on' : ''} />
                  ))}
                </div>
              </div>
              {active ? (
                <button class="btn ghost" onClick={() => st.do((s) => E.abandonChallenge(s))}>
                  Сдаться
                </button>
              ) : done >= CHALLENGE_MAX ? (
                <Px id="trophy" scale={2} />
              ) : confirm === c.id ? (
                <button
                  class="btn violet"
                  onClick={() => {
                    setConfirm(null);
                    st.startChallenge(c.id);
                  }}
                >
                  Точно?
                </button>
              ) : (
                <button class={`btn ghost ${s.challenge ? 'disabled' : ''}`} onClick={() => !s.challenge && setConfirm(c.id)}>
                  Начать
                </button>
              )}
            </div>
          );
        })}
      </div>
      <div class="small muted" style={{ marginTop: 8 }}>
        Старт испытания проводит трансмутацию (камни начисляются как обычно). Сдаться можно в любой момент — правила просто снимутся.
      </div>
    </>
  );
}

export function KnowledgeTab() {
  return (
    <div>
      <div class="section-title">
        <h2>Знания</h2>
      </div>
      <Transmutation />
      <Talents />
      <Challenges />
    </div>
  );
}

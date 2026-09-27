import { useState } from 'preact/hooks';
import { useStore } from '../store';
import * as E from '../../core/engine';
import { CHALLENGES, CHALLENGE_MAX, TALENTS, challengeGoal } from '../../data/progression';
import { fmt, pct, plural } from '../format';
import { burst } from '../fx';
import { Ic, Px } from '../Px';
import { Cta, Glyph, Row, ScreenTitle, Section } from '../kit';

const BRANCHES = [
  { id: 'tap', name: 'Руки' },
  { id: 'idle', name: 'Мастерская' },
  { id: 'guild', name: 'Гильдия' },
] as const;

function Transmutation() {
  const st = useStore();
  const s = st.s;
  const [confirm, setConfirm] = useState(false);
  const pending = E.pendingStones(s);
  const can = E.canTransmute(s);
  return (
    <div class="transmute">
      <div class="row" style={{ gap: 14 }}>
        <span class="plate" style={{ width: 56, height: 56, borderRadius: 12, background: 'var(--bg-3)', display: 'grid', placeItems: 'center' }}>
          <Px id="stone" scale={3} />
        </span>
        <div class="grow">
          <div class="label">Трансмутация</div>
          <div style={{ font: '600 15px var(--ui)', marginTop: 2 }}>Переплавь лавку ради камней</div>
          <div class="hint">Золото и постройки сгорят, камни — навсегда</div>
        </div>
      </div>
      <div class="stat-pair">
        <div class="grow">
          <div class="label">Сейчас</div>
          <div class="big">{fmt(s.stonesEarned)}</div>
          <div class="hint">
            <span class="plus">+{pct(s.stonesEarned * E.BAL.stoneBonus)}</span> к доходу
          </div>
        </div>
        <div class="grow">
          <div class="label">После</div>
          <div class="big gold">{fmt(s.stonesEarned + pending)}</div>
          <div class="hint">
            <span class="plus">+{pct((s.stonesEarned + pending) * E.BAL.stoneBonus)}</span> к доходу
          </div>
        </div>
      </div>
      {confirm ? (
        <>
          <Cta
            onClick={(e) => {
              setConfirm(false);
              if (st.transmute()) burst(e.clientX, e.clientY, { n: 50, kind: 'star', colors: ['#f2b84b', '#fff'], speed: 9 });
            }}
          >
            Да, переплавить
          </Cta>
          <button class="btn2 block" style={{ marginTop: 8 }} onClick={() => setConfirm(false)}>
            Отмена
          </button>
        </>
      ) : (
        <Cta off={!can} onClick={() => setConfirm(true)}>
          {s.challenge
            ? 'Недоступно в Изнанке'
            : can
              ? `Получить ${fmt(pending)} ${plural(pending, 'камень', 'камня', 'камней')}`
              : `Следующий камень при ${fmt(E.goldForNextStone(s))}`}
        </Cta>
      )}
    </div>
  );
}

function Talents() {
  const st = useStore();
  const s = st.s;
  return (
    <Section
      title="Древо знаний"
      aside={
        <button
          class="btn2"
          style={{ minHeight: 32, padding: '0 10px', fontSize: 13 }}
          onClick={() => {
            const r = st.do((s) => E.respecTalents(s));
            if (r) st.toast({ icon: 'refresh', title: 'Таланты сброшены', text: `Вернулось камней: ${fmt(r)}`, kind: 'info' });
          }}
        >
          Сбросить
        </button>
      }
      help={() => st.toast({ icon: 'stone', title: 'Таланты', text: 'Потраченные камни всё равно дают доход. Сброс бесплатный', kind: 'info' })}
    >
      <div class="talent-grid">
        {BRANCHES.map((b) => (
          <div key={b.id} class="talent-col">
            <span class="label">{b.name}</span>
            {TALENTS.filter((t) => t.branch === b.id)
              .sort((a, c) => a.tier - c.tier)
              .map((t) => {
                const lv = s.talents[t.id] ?? 0;
                const avail = E.talentAvailable(s, t.id);
                const maxed = lv >= t.maxLevel;
                const cost = E.talentCost(t.id, lv);
                const can = avail && !maxed && s.stones >= cost;
                return (
                  <button
                    key={t.id}
                    class={`tal ${can ? 'can' : ''} ${avail ? '' : 'locked'} ${maxed ? 'maxed' : ''}`}
                    onClick={(e) => {
                      if (st.do((s) => E.buyTalent(s, t.id))) burst(e.clientX, e.clientY, { n: 12, kind: 'star', colors: ['#f2b84b', '#fff'] });
                      else st.toast({ icon: t.icon, title: t.name, text: t.desc, kind: 'info' });
                    }}
                  >
                    {avail ? <Px id={t.icon} scale={2} /> : <Glyph name="lock" cell={3} color="var(--text-3)" />}
                    <span class="tn">{t.name}</span>
                    <span class="tl">{maxed ? 'макс.' : `${lv}/${t.maxLevel > 100 ? '∞' : t.maxLevel}`}</span>
                    {!maxed && (
                      <span class="tc">
                        <Ic id="stone" /> {fmt(cost)}
                      </span>
                    )}
                  </button>
                );
              })}
          </div>
        ))}
      </div>
    </Section>
  );
}

function Challenges() {
  const st = useStore();
  const s = st.s;
  const [confirmReset, setConfirmReset] = useState<string | null>(null);
  if (s.transmutations < 1) return null;
  return (
    <Section
      title="Испытания"
      help={() =>
        st.toast({
          icon: 'trophy',
          title: 'Испытания — Изнанка',
          text: 'Отдельное измерение с особым правилом. Основной мир сохраняется, выйти можно в любой момент',
          kind: 'info',
        })
      }
    >
      <p class="hint" style={{ marginBottom: 12 }}>
        Испытание проходит в Изнанке. Основной мир ждёт тебя и приносит доход, как в офлайне; прогресс испытания сохраняется, если выйти
        раньше.
      </p>
      <div class="stack">
        {CHALLENGES.map((c) => {
          const done = s.challengeDone[c.id] ?? 0;
          const active = s.challenge === c.id;
          const complete = done >= CHALLENGE_MAX;
          const goal = challengeGoal(c, done);
          const saved = s.challengeRuns[c.id];
          return (
            <Row
              key={c.id}
              icon={<Px id={c.icon} scale={2} />}
              name={c.name}
              count={`${done}/${CHALLENGE_MAX}`}
              claim={active}
              sub={
                <>
                  {c.desc}
                  <br />
                  <span class="plus">{c.rewardText}</span> · цель <span class="num t2">{fmt(goal)}</span>
                  {saved && !active && (
                    <>
                      <br />
                      Сохранён прогресс: <span class="num t2">{fmt(saved.runEarned)}</span>
                      {' · '}
                      {confirmReset === c.id ? (
                        <a
                          class="link"
                          onClick={() => {
                            st.do((s) => E.resetChallengeProgress(s, c.id));
                            setConfirmReset(null);
                          }}
                        >
                          точно сбросить?
                        </a>
                      ) : (
                        <a class="link" onClick={() => setConfirmReset(c.id)}>
                          начать заново
                        </a>
                      )}
                    </>
                  )}
                </>
              }
              right={
                complete ? (
                  <span class="state done">
                    <Glyph name="check" />
                  </span>
                ) : active ? (
                  <button class="btn2" onClick={() => st.leaveChallenge()}>
                    Домой
                  </button>
                ) : (
                  <button class={`btn2 ${s.challenge ? 'off' : ''}`} onClick={() => !s.challenge && st.startChallenge(c.id)}>
                    {saved ? 'Продолжить' : 'Войти'}
                  </button>
                )
              }
            />
          );
        })}
      </div>
    </Section>
  );
}

export function KnowledgeTab() {
  return (
    <div>
      <ScreenTitle>Знания</ScreenTitle>
      <Transmutation />
      <Talents />
      <Challenges />
    </div>
  );
}

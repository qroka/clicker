import { useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { useStore } from './store';
import * as E from '../core/engine';
import { HEROES } from '../data/heroes';
import { EXPEDITION_DURATIONS, ING_BY_ID, LOCATIONS } from '../data/world';
import { LOGIN_REWARDS, QUEST_TEMPLATES, QUEST_REWARD, QUESTS_ALL_BONUS } from '../data/progression';
import { ACHIEVEMENTS } from '../data/achievements';
import { TEXTS } from '../data/texts';
import { fmt, fmtTime, pct } from './format';
import { RARITY_LABEL, ROLE_LABEL, bonusText } from './labels';
import { Portrait } from './tabs/Guild';
import { burst } from './fx';
import type { LocationId } from '../core/types';
import { Ic, Px } from './Px';

function Sheet({ title, children, onClose }: { title: string; children: ComponentChildren; onClose: () => void }) {
  return (
    <>
      <div class="scrim" onClick={onClose} />
      <div class="sheet">
        <div class="sheet-grip" />
        <div class="sheet-head">
          <h2>{title}</h2>
          <button class="icon-btn" onClick={onClose} aria-label="Закрыть">
            <Px id="close" scale={2} />
          </button>
        </div>
        <div class="sheet-body">{children}</div>
      </div>
    </>
  );
}

// ─── Ежедневное ──────────────────────────────────────────────────────────────

function Daily() {
  const st = useStore();
  const s = st.s;
  const now = Date.now();
  const wd = TEXTS.weeklyEvents[new Date(now).getDay()];
  const idx = E.loginRewardIndex(s);
  const canLogin = E.canClaimLogin(s, now);
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return (
    <div class="stack">
      <div class="event-banner">
        <span class="ee">
          <Px id={wd.icon} scale={3} />
        </span>
        <div>
          <b>Сегодня: {wd.name}</b>
          <div class="small muted">{wd.desc}</div>
        </div>
      </div>

      <div class="section-title" style={{ marginTop: 8 }}>
        <h2>Награда за вход</h2>
        <small>
          серия: {s.daily.streak} <Ic id="fire" />
        </small>
      </div>
      <div class="calendar">
        {LOGIN_REWARDS.map((r, i) => (
          <div key={i} class={`cal-day ${i < idx || (i === idx && !canLogin) ? 'done' : ''} ${i === idx && canLogin ? 'today' : ''} ${i === 6 ? 'big' : ''}`}>
            <span>{i + 1}</span>
            <span class="ce">
              <Px id={r.icon} scale={2} />
            </span>
          </div>
        ))}
      </div>
      <button
        class={`btn block big ${canLogin ? '' : 'disabled'}`}
        onClick={(e) => {
          if (st.do((s, m, n, r) => E.claimLogin(s, m, n, r))) {
            burst(e.clientX, e.clientY, { n: 40, kind: 'coin', speed: 8 });
            st.toast({ icon: LOGIN_REWARDS[idx].icon, title: 'Награда получена!', text: LOGIN_REWARDS[idx].label, kind: 'gold' });
          }
        }}
      >
        {canLogin ? `Забрать: ${LOGIN_REWARDS[idx].label}` : `Завтра — новая награда (через ${fmtTime((midnight.getTime() - now) / 1000)})`}
      </button>
      <div class="small muted">Не пропускай дни — серия сбросится. На 7-й день — сундук гильдии.</div>

      <div class="section-title">
        <h2>Задания дня</h2>
        <small>
          +{QUEST_REWARD.essence} <Ic id="essence" /> и осколок за каждое
        </small>
      </div>
      {s.daily.quests.map((q, i) => {
        const t = QUEST_TEMPLATES.find((x) => x.kind === q.kind)!;
        const done = q.progress >= q.target;
        return (
          <div key={i} class={`quest ${done ? 'done' : ''} ${q.claimed ? 'claimed' : ''}`}>
            <Px id={t.icon} scale={2} />
            <div class="grow">
              <b style={{ fontSize: 14 }}>{t.text(fmt(q.target))}</b>
              <div class="bar teal" style={{ marginTop: 5 }}>
                <i style={{ width: `${(q.progress / q.target) * 100}%` }} />
              </div>
              <div class="small muted num">
                {fmt(q.progress)} / {fmt(q.target)}
              </div>
            </div>
            {q.claimed ? (
              <Px id="check" scale={2} />
            ) : done ? (
              <button class="btn teal" onClick={(e) => st.do((s, _m, _n, r) => E.claimQuest(s, i, r)) && burst(e.clientX, e.clientY, { n: 20, kind: 'star', colors: ['#5ee6c4', '#fff'] })}>
                Забрать
              </button>
            ) : (
              !s.daily.rerollUsed && (
                <button class="btn ghost" title="Заменить задание (1 раз в день)" onClick={() => st.do((s, m, n, r) => E.rerollQuest(s, m, i, n, r))}>
                  <Px id="dice" scale={2} />
                </button>
              )
            )}
          </div>
        );
      })}
      <button
        class={`btn violet block ${E.canClaimAllBonus(s) ? '' : 'disabled'}`}
        onClick={() => {
          const got = st.do((s, _m, _n, r) => E.claimAllBonus(s, r));
          if (got) st.toast({ icon: 'gift', title: 'Бонус за все задания!', text: `+${QUESTS_ALL_BONUS.essence} эссенции и ингредиенты`, kind: 'gold' });
        }}
      >
        <Ic id={s.daily.allBonusClaimed ? 'check' : 'gift'} />{' '}
        {s.daily.allBonusClaimed ? 'Бонус дня получен' : `Все 3 задания: +${QUESTS_ALL_BONUS.essence} эссенции и ${QUESTS_ALL_BONUS.ingredients} ингредиента`}
      </button>
    </div>
  );
}

// ─── Герой ───────────────────────────────────────────────────────────────────

function HeroView({ id }: { id: string }) {
  const st = useStore();
  const s = st.s;
  const m = st.mods();
  const h = E.HERO_BY_ID[id];
  const hs = s.heroes[id];
  const unlocked = E.heroUnlocked(s, h);
  if (!unlocked) {
    return (
      <div class="empty-state">
        <Portrait h={h} locked size="lg" />
        <p>Этот гость появится на Перекрёстке в главе {h.chapter}.</p>
      </div>
    );
  }
  const lv = hs?.level ?? 0;
  const rec = !!hs?.recruited;
  const cost = E.heroLevelCost(s, m, h);
  const role = ROLE_LABEL[h.role];
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ display: 'grid', placeItems: 'center', margin: '8px 0 10px' }}>
        <Portrait h={h} size="lg" />
      </div>
      <h2 style={{ fontSize: 24 }}>{h.name}</h2>
      <div class="muted">{h.title}</div>
      <div class="row" style={{ justifyContent: 'center', gap: 6, margin: '8px 0' }}>
        <span class={`rarity ${h.rarity}`}>{RARITY_LABEL[h.rarity]}</span>
        <span class="chip" style={{ fontSize: 11 }}>
          <Ic id={role.icon} /> {role.name}
        </span>
        {rec && <span class="chip" style={{ fontSize: 11 }}>Ур. {lv}</span>}
      </div>
      <div class="small dim" style={{ fontStyle: 'italic' }}>Гость из мира: {h.realm}</div>
      <p class="small" style={{ textAlign: 'left' }}>{h.bio}</p>
      <div class="card" style={{ fontStyle: 'italic', margin: '8px 0' }}>«{h.quote}»</div>
      <div class="card" style={{ margin: '10px 0', textAlign: 'left' }}>
        <div class="small muted">Бонус</div>
        <b style={{ color: 'var(--teal)' }}>{bonusText(h.bonus.type, E.heroBonusValue(h, Math.max(1, lv)), h.bonus.target)}</b>
        {rec && lv < E.BAL.maxHeroLevel && (
          <div class="small muted">
            На ур. {lv + 1}: {bonusText(h.bonus.type, E.heroBonusValue(h, lv + 1), h.bonus.target)}
          </div>
        )}
        <div class="small muted" style={{ marginTop: 4 }}>
          Сила в экспедиции: {fmt(E.heroPower(s, id) || E.BAL.heroPower[h.rarity], 1)}
        </div>
      </div>
      {rec ? (
        lv >= E.BAL.maxHeroLevel ? (
          <div class="btn block disabled">Максимальный уровень</div>
        ) : (
          <button class={`btn teal block big ${s.essence >= cost ? '' : 'disabled'}`} onClick={(e) => st.levelHero(id) && burst(e.clientX, e.clientY, { n: 20, kind: 'star', colors: ['#5ee6c4', '#fff'] })}>
            {s.essence >= cost ? (
              <>
                <Ic id="arrow_up" /> Повысить уровень · <Ic id="essence" /> {fmt(cost)}
              </>
            ) : (
              <>
                Нужно ещё <Ic id="essence" /> {fmt(cost - s.essence)}
              </>
            )}
          </button>
        )
      ) : h.recruit === 'gold' ? (
        <button class={`btn block big ${E.canRecruit(s, h) ? '' : 'disabled'}`} onClick={(e) => st.recruit(id) && burst(e.clientX, e.clientY, { n: 50, kind: 'star', speed: 8 })}>
          <Ic id="contract" /> Нанять · <Ic id="coin" /> {fmt(E.heroGoldCost(h))}
        </button>
      ) : (
        <>
          <div class="bar violet" style={{ margin: '4px 0 8px' }}>
            <i style={{ width: `${Math.min(1, (hs?.shards ?? 0) / E.BAL.heroShardsNeeded[h.rarity]) * 100}%` }} />
          </div>
          <button class={`btn violet block big ${E.canRecruit(s, h) ? '' : 'disabled'}`} onClick={(e) => st.recruit(id) && burst(e.clientX, e.clientY, { n: 60, kind: 'star', speed: 9 })}>
            <Ic id="shard" /> Контракт: {hs?.shards ?? 0}/{E.BAL.heroShardsNeeded[h.rarity]} осколков
          </button>
          <div class="small muted" style={{ marginTop: 6 }}>
            Осколки выпадают в средних и долгих экспедициях, за задания дня и награды за вход.
          </div>
        </>
      )}
    </div>
  );
}

// ─── Новая экспедиция ────────────────────────────────────────────────────────

function ExpeditionPlanner({ onDone }: { onDone: () => void }) {
  const st = useStore();
  const s = st.s;
  const m = st.mods();
  const open = LOCATIONS.filter((l) => l.chapter <= s.chapter);
  const [loc, setLoc] = useState<LocationId>(open[open.length - 1].id);
  const [dur, setDur] = useState<'short' | 'medium' | 'long'>('medium');
  const busy = E.busyHeroes(s);
  const free = HEROES.filter((h) => s.heroes[h.id]?.recruited && !busy.has(h.id)).sort((a, b) => E.heroPower(s, b.id, loc) - E.heroPower(s, a.id, loc));
  const [team, setTeam] = useState<string[]>(() => free.slice(0, 3).map((h) => h.id));
  const chance = team.length ? E.successChance(s, loc, team) : 0;
  const L = LOCATIONS.find((l) => l.id === loc)!;
  const d = EXPEDITION_DURATIONS.find((x) => x.id === dur)!;

  const toggle = (id: string) => setTeam(team.includes(id) ? team.filter((x) => x !== id) : team.length < 3 ? [...team, id] : team);

  return (
    <div class="stack">
      <div class="small muted">Куда отправимся?</div>
      <div class="pick-grid">
        {LOCATIONS.map((l) => {
          const avail = l.chapter <= s.chapter;
          return (
            <button key={l.id} class={`pick ${loc === l.id ? 'on' : ''} ${avail ? '' : 'off'}`} onClick={() => avail && setLoc(l.id)}>
              <Px id={avail ? l.id : 'lock'} scale={2} />
              <div class="grow">
                <b style={{ fontSize: 13 }}>{avail ? TEXTS.locations[l.id].name : `Глава ${l.chapter}`}</b>
                {avail && (
                  <div class="small">
                    <Ic id={ING_BY_ID[l.drops[0]].id} /> <Ic id={ING_BY_ID[l.drops[1]].id} /> · <Ic id={ROLE_LABEL[l.favoredRole].icon} />
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
      <div class="small muted">{TEXTS.locations[loc].desc}</div>
      <div class="small">
        Любит: <Ic id={ROLE_LABEL[L.favoredRole].icon} /> {ROLE_LABEL[L.favoredRole].name} (сила ×1,5) · нужная сила: {L.power}
      </div>

      <div class="seg">
        {EXPEDITION_DURATIONS.map((x) => (
          <button key={x.id} class={dur === x.id ? 'on' : ''} onClick={() => setDur(x.id)}>
            {fmtTime(E.expeditionSeconds(m, x.id))}
          </button>
        ))}
      </div>
      <div class="small muted">
        Добыча ≈ {Math.round(d.loot * 1.5 * m.expLoot)} ингредиентов, <Ic id="essence" /> {Math.round(d.essence * (1 + L.chapter * 0.25) * m.essence)}
        {dur !== 'short' ? ', шанс осколков контракта' : ''}
      </div>

      <div class="small muted">Отряд (до 3 героев):</div>
      <div class="pick-grid">
        {free.map((h) => (
          <button key={h.id} class={`pick ${team.includes(h.id) ? 'on' : ''}`} onClick={() => toggle(h.id)}>
            <Px id={h.id} scale={1} />
            <div class="grow">
              <b style={{ fontSize: 12.5 }}>{h.name}</b>
              <div class="small muted">
                <Ic id={ROLE_LABEL[h.role].icon} /> сила {fmt(E.heroPower(s, h.id, loc), 1)}
              </div>
            </div>
          </button>
        ))}
      </div>
      {!free.length && <div class="small muted">Все герои уже в пути.</div>}

      <div class="card row">
        <div class="grow">
          <div class="small muted">Шанс успеха</div>
          <b style={{ fontSize: 20, color: chance >= 0.85 ? 'var(--green)' : chance >= 0.5 ? 'var(--gold)' : 'var(--red)' }}>{pct(chance)}</b>
        </div>
        <button
          class={`btn teal big ${team.length ? '' : 'disabled'}`}
          onClick={() => {
            if (team.length && st.startExpedition(loc, dur, team)) onDone();
          }}
        >
          <Ic id="compass" /> В путь!
        </button>
      </div>
      <div class="small muted">При неудаче отряд вернётся с частью эссенции, но без ингредиентов.</div>
    </div>
  );
}

// ─── Меню / настройки ────────────────────────────────────────────────────────

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return <button class={`toggle ${on ? 'on' : ''}`} onClick={onClick} />;
}

function Settings() {
  const st = useStore();
  const s = st.s;
  const [view, setView] = useState<'main' | 'ach' | 'save'>('main');
  const [code, setCode] = useState('');
  const [resetConfirm, setResetConfirm] = useState(0);

  if (view === 'ach') {
    const have = new Set(s.achievements);
    return (
      <div>
        <button class="btn ghost" onClick={() => setView('main')}>
          <Ic id="arrow_left" /> Назад
        </button>
        <p class="muted small">
          Открыто {s.achievements.length}/{ACHIEVEMENTS.length} · каждое даёт +1% ко всему доходу
        </p>
        <div class="ach-grid">
          {ACHIEVEMENTS.map((a) => (
            <button key={a.id} class={`ach ${have.has(a.id) ? '' : 'off'}`} onClick={() => st.toast({ icon: a.icon, title: a.name, text: a.desc, kind: have.has(a.id) ? 'ach' : 'info' })}>
              <Px id={a.icon} scale={2} />
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (view === 'save') {
    return (
      <div class="stack">
        <button class="btn ghost" onClick={() => setView('main')}>
          <Ic id="arrow_left" /> Назад
        </button>
        <p class="small muted">Скопируй код, чтобы перенести прогресс на другое устройство или сделать резервную копию.</p>
        <textarea class="code" readOnly value={st.exportSave()} onFocus={(e) => (e.currentTarget as HTMLTextAreaElement).select()} />
        <button
          class="btn ghost"
          onClick={() => {
            void navigator.clipboard?.writeText(st.exportSave());
            st.toast({ icon: 'copy', title: 'Скопировано', kind: 'info' });
          }}
        >
          <Ic id="copy" /> Копировать
        </button>
        <p class="small muted">Загрузить сохранение:</p>
        <textarea class="code" value={code} onInput={(e) => setCode((e.currentTarget as HTMLTextAreaElement).value)} placeholder="Вставь код сюда" />
        <button
          class="btn"
          onClick={() =>
            st.importSave(code) ? st.toast({ icon: 'check', title: 'Прогресс загружен', kind: 'info' }) : st.toast({ icon: 'warning', title: 'Неверный код', kind: 'warn' })
          }
        >
          Загрузить
        </button>
      </div>
    );
  }
  const stats: [string, string][] = [
    ['Золото за всё время', fmt(s.allTimeEarned)],
    ['Лучший доход', `${fmt(s.stats.bestGps)}/с`],
    ['Тапов', fmt(s.stats.taps)],
    ['Критов', fmt(s.stats.crits)],
    ['Кипений котла', fmt(s.stats.boils)],
    ['Поймано искр', fmt(s.stats.wisps)],
    ['Сварено зелий', fmt(s.stats.brews)],
    ['Экспедиций', fmt(s.stats.expeditions)],
    ['Трансмутаций', fmt(s.transmutations)],
    ['Лучшая серия входов', `${s.daily.bestStreak} дн.`],
    ['Время в игре', fmtTime(s.stats.playSeconds)],
  ];
  const set = (k: 'sound' | 'haptics') => {
    st.s.settings[k] = !st.s.settings[k];
    st.applySettings();
    st.save();
    st.bump();
  };
  return (
    <div>
      <div class="list-row" style={{ alignItems: 'center' }}>
        <span>
          <Ic id="sound" /> Звук
        </span>
        <Toggle on={s.settings.sound} onClick={() => set('sound')} />
      </div>
      <div class="list-row" style={{ alignItems: 'center' }}>
        <span>
          <Ic id="vibrate" /> Вибрация
        </span>
        <Toggle on={s.settings.haptics} onClick={() => set('haptics')} />
      </div>
      <div class="list-row" style={{ alignItems: 'center' }}>
        <span>
          <Ic id="numbers" /> Числа
        </span>
        <div class="seg" style={{ width: 170 }}>
          {(['short', 'sci'] as const).map((n) => (
            <button
              key={n}
              class={s.settings.notation === n ? 'on' : ''}
              onClick={() => {
                s.settings.notation = n;
                st.applySettings();
                st.bump();
              }}
            >
              {n === 'short' ? '1,5M' : '1,5e6'}
            </button>
          ))}
        </div>
      </div>
      <div class="row" style={{ margin: '14px 0', gap: 8 }}>
        <button class="btn ghost grow" onClick={() => setView('ach')}>
          <Ic id="trophy" /> {s.achievements.length}/{ACHIEVEMENTS.length}
        </button>
        <button class="btn ghost grow" onClick={() => setView('save')}>
          <Ic id="save" /> Сохранение
        </button>
      </div>
      <button class="btn ghost block" onClick={() => st.modals.push({ type: 'dialogue', title: 'Пролог', lines: TEXTS.prologue }) && st.bump()}>
        <Ic id="scroll" /> Перечитать историю
      </button>
      <div class="section-title">
        <h2>Статистика</h2>
      </div>
      {stats.map(([k, v]) => (
        <div key={k} class="list-row">
          <span class="muted">{k}</span>
          <b class="num">{v}</b>
        </div>
      ))}
      <div class="small muted" style={{ margin: '16px 0 8px' }}>
        <Ic id="bulb" /> Совет: в Safari нажми «Поделиться» → «На экран Домой», чтобы играть как в приложении, на весь экран и офлайн.
      </div>
      <button
        class="btn ghost block"
        style={{ color: 'var(--red)', marginTop: 12 }}
        onClick={() => {
          if (resetConfirm < 2) setResetConfirm(resetConfirm + 1);
          else {
            st.hardReset();
            st.openSheet(null);
          }
        }}
      >
        <Ic id={resetConfirm ? 'warning' : 'trash'} /> {['Начать заново', 'Весь прогресс будет удалён!', 'Нажми ещё раз для подтверждения'][resetConfirm]}
      </button>
    </div>
  );
}

export function Sheets() {
  const st = useStore();
  const sh = st.sheet;
  if (!sh) return null;
  const close = () => st.openSheet(null);
  if (sh === 'daily')
    return (
      <Sheet title="Ежедневное" onClose={close}>
        <Daily />
      </Sheet>
    );
  if (sh === 'settings' || sh === 'achievements')
    return (
      <Sheet title="Меню" onClose={close}>
        <Settings />
      </Sheet>
    );
  if ('hero' in sh)
    return (
      <Sheet title="Герой" onClose={close}>
        <HeroView id={sh.hero} />
      </Sheet>
    );
  return (
    <Sheet title="Новая экспедиция" onClose={close}>
      <ExpeditionPlanner onDone={close} />
    </Sheet>
  );
}

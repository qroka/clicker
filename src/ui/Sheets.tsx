import { useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { useStore } from './store';
import * as E from '../core/engine';
import { HEROES } from '../data/heroes';
import { EXPEDITION_DURATIONS, ING_BY_ID, LOCATIONS } from '../data/world';
import { LOGIN_REWARDS, QUEST_TEMPLATES, QUEST_REWARD, QUESTS_ALL_BONUS } from '../data/progression';
import { ACHIEVEMENTS } from '../data/achievements';
import { TEXTS } from '../data/texts';
import { fmt, fmtTime, pct, plural } from './format';
import { RARITY_LABEL, ROLE_LABEL, bonusText } from './labels';
import { Portrait } from './tabs/Guild';
import { burst, hapticTest } from './fx';
import type { LocationId } from '../core/types';
import { Ic, Px } from './Px';
import { CloseButton, Cta, Glyph, Row, Section, Segments, StateBox } from './kit';

function Sheet({ title, children, onClose }: { title: string; children: ComponentChildren; onClose: () => void }) {
  return (
    <>
      <div class="scrim" onClick={onClose} />
      <div class="sheet" role="dialog" aria-label={title}>
        <div class="sheet-grip" />
        <div class="sheet-head">
          <h2>{title}</h2>
          <CloseButton onClick={onClose} />
        </div>
        <div class="sheet-body">{children}</div>
      </div>
    </>
  );
}

// ─── Ежедневное (эталонный экран) ────────────────────────────────────────────

/** Эффект дня недели одной строкой: число вперёд. Индекс = Date.getDay(). */
const DAY_EFFECT: [string, string][] = [
  ['×2', 'к доходу, пока тебя нет'],
  ['−10%', 'к цене построек'],
  ['×2', 'чаще блуждающие искры'],
  ['−25%', 'к времени экспедиций'],
  ['×2', 'к силе тапа'],
  ['−25%', 'к цене уровня героев'],
  ['+50%', 'к редкой добыче в экспедициях'],
];

function loginVerb(label: string): string {
  return `Забрать ${label.charAt(0).toLowerCase()}${label.slice(1)}`;
}

function Daily() {
  const st = useStore();
  const s = st.s;
  const now = Date.now();
  const day = new Date(now).getDay();
  const wd = TEXTS.weeklyEvents[day];
  const [num, effect] = DAY_EFFECT[day];
  const idx = E.loginRewardIndex(s);
  const canLogin = E.canClaimLogin(s, now);
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const [rerollArm, setRerollArm] = useState<number | null>(null);

  const quests = s.daily.quests;
  const claimable = quests.map((q, i) => (!q.claimed && q.progress >= q.target ? i : -1)).filter((i) => i >= 0);
  const claimedCount = quests.filter((q) => q.claimed).length;
  const canBonus = E.canClaimAllBonus(s);

  const claimQuests = (e: MouseEvent) => {
    let n = 0;
    for (const i of claimable) if (st.do((s, _m, _n, r) => E.claimQuest(s, i, r))) n++;
    if (n) {
      burst(e.clientX, e.clientY, { n: 16, kind: 'star', colors: ['#f2b84b', '#fff'] });
      st.toast({ icon: 'essence', title: `Награда за ${n} ${plural(n, 'задание', 'задания', 'заданий')}`, text: `+${QUEST_REWARD.essence * n} эссенции и осколки`, kind: 'gold' });
    }
  };

  // Одна золотая кнопка на экран: то, что можно забрать прямо сейчас.
  let cta: { text: string; run?: (e: MouseEvent) => void };
  if (canLogin)
    cta = {
      text: loginVerb(LOGIN_REWARDS[idx].label),
      run: (e) => {
        if (st.do((s, m, n, r) => E.claimLogin(s, m, n, r))) {
          burst(e.clientX, e.clientY, { n: 30, kind: 'coin', speed: 8 });
          st.toast({ icon: LOGIN_REWARDS[idx].icon, title: 'Награда получена', text: LOGIN_REWARDS[idx].label, kind: 'gold' });
        }
      },
    };
  else if (claimable.length) cta = { text: claimable.length > 1 ? 'Забрать награды за задания' : 'Забрать награду за задание', run: claimQuests };
  else if (canBonus)
    cta = {
      text: 'Забрать бонус дня',
      run: () => {
        if (st.do((s, _m, _n, r) => E.claimAllBonus(s, r))) st.toast({ icon: 'gift', title: 'Бонус дня', text: `+${QUESTS_ALL_BONUS.essence} эссенции и ингредиенты`, kind: 'gold' });
      },
    };
  else cta = { text: `Новые награды через ${fmtTime((midnight.getTime() - now) / 1000)}` };

  return (
    <div>
      <div class="event">
        <span class="eplate">
          <Px id={wd.icon} scale={3} />
        </span>
        <div class="grow">
          <div class="label">Событие дня</div>
          <div class="en">{wd.name}</div>
          <div class="ed">
            <b>{num}</b> {effect}
          </div>
        </div>
      </div>

      <Section
        title="Серия входа"
        aside={
          <span class="streak-count">
            <Glyph name="flame" cell={2} color="var(--gold)" />
            <span class="num">{s.daily.streak}</span> {plural(s.daily.streak, 'день', 'дня', 'дней')} подряд
          </span>
        }
      >
        <div class="streak">
          {LOGIN_REWARDS.map((r, i) => {
            const past = i < idx || (i === idx && !canLogin);
            if (i === idx)
              return (
                <div key={i} class={`sday cur ${canLogin ? '' : 'claimed'}`}>
                  {canLogin ? <Px id={r.icon} scale={2} /> : <Glyph name="check" cell={3} color="var(--check-muted)" />}
                  <span class="dn">День {i + 1}</span>
                </div>
              );
            return (
              <div key={i} class={`sday ${past ? 'past' : ''}`}>
                <span class="dn">{i + 1}</span>
                {past ? <Glyph name="check" cell={2} /> : <Px id={r.icon} scale={1} />}
              </div>
            );
          })}
        </div>
        <div class="hint">Пропустишь день — серия начнётся заново</div>
      </Section>

      <Section
        title="Задания дня"
        aside={
          <>
            <span class="ess num">+{QUEST_REWARD.essence}</span> за каждое
          </>
        }
      >
        <div class="stack">
          {quests.map((q, i) => {
            const t = QUEST_TEMPLATES.find((x) => x.kind === q.kind)!;
            const done = q.progress >= q.target;
            const ready = done && !q.claimed;
            return (
              <Row
                key={i}
                icon={<Px id={t.icon} scale={2} />}
                name={t.text(fmt(q.target))}
                count={done ? <span class="plus">готово</span> : `${fmt(q.progress)} / ${fmt(q.target)}`}
                progress={{ value: q.progress / q.target, full: done }}
                claim={ready}
                right={<StateBox state={q.claimed ? 'done' : ready ? 'claim' : 'todo'} />}
                onClick={() => {
                  if (ready) return;
                  if (q.claimed || s.daily.rerollUsed) return;
                  if (rerollArm === i) {
                    st.do((s, m, n, r) => E.rerollQuest(s, m, i, n, r));
                    setRerollArm(null);
                  } else {
                    setRerollArm(i);
                    st.toast({ icon: 'dice', title: 'Заменить задание?', text: 'Нажми ещё раз. Можно раз в день', kind: 'info' });
                  }
                }}
              />
            );
          })}
        </div>
        <div class="segplate" style={canBonus ? { background: 'var(--gold-bg)', boxShadow: 'inset 0 0 0 2px var(--gold)' } : undefined}>
          <Segments total={quests.length || 3} filled={claimedCount} />
          <span class="grow">
            <b>Бонус дня</b>{' '}
            <span class="t2">
              {s.daily.allBonusClaimed
                ? '— получен'
                : canBonus
                  ? '— готов'
                  : `— ещё ${quests.length - claimedCount} ${plural(quests.length - claimedCount, 'задание', 'задания', 'заданий')}`}
            </span>
          </span>
        </div>
      </Section>

      <div style={{ marginTop: 24 }}>
        <Cta off={!cta.run} onClick={cta.run}>
          {cta.text}
        </Cta>
      </div>
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
  if (!E.heroUnlocked(s, h)) {
    return (
      <div class="empty-state">
        <Portrait h={h} locked size="lg" />
        <span>Этот гость появится в главе {h.chapter}</span>
      </div>
    );
  }
  const lv = hs?.level ?? 0;
  const rec = !!hs?.recruited;
  const cost = E.heroLevelCost(s, m, h);
  const role = ROLE_LABEL[h.role];
  const need = E.BAL.heroShardsNeeded[h.rarity];

  let cta: preact.JSX.Element;
  if (rec) {
    if (lv >= E.BAL.maxHeroLevel) cta = <Cta off>Максимальный уровень</Cta>;
    else if (s.essence >= cost)
      cta = (
        <Cta onClick={(e) => st.levelHero(id) && burst(e.clientX, e.clientY, { n: 16, kind: 'star', colors: ['#f2b84b', '#fff'] })}>
          Повысить уровень · <Ic id="essence" scale={1} /> {fmt(cost)}
        </Cta>
      );
    else cta = <Cta off>Нужно ещё {fmt(cost - s.essence)} эссенции</Cta>;
  } else if (h.recruit === 'gold') {
    cta = E.canRecruit(s, h) ? (
      <Cta onClick={(e) => st.recruit(id) && burst(e.clientX, e.clientY, { n: 40, kind: 'star', speed: 8 })}>
        Нанять за <Ic id="coin" /> {fmt(E.heroGoldCost(h))}
      </Cta>
    ) : (
      <Cta off>Нужно {fmt(E.heroGoldCost(h))} золота</Cta>
    );
  } else {
    cta = E.canRecruit(s, h) ? (
      <Cta onClick={(e) => st.recruit(id) && burst(e.clientX, e.clientY, { n: 50, kind: 'star', speed: 9 })}>Подписать контракт</Cta>
    ) : (
      <Cta off>Собери осколки контракта</Cta>
    );
  }

  return (
    <div>
      <div style={{ display: 'grid', placeItems: 'center', textAlign: 'center', marginBottom: 20 }}>
        <Portrait h={h} size="lg" />
        <div class="px-font" style={{ font: '700 26px var(--px)', marginTop: 14 }}>
          {h.name}
        </div>
        <div class="t2">{h.title}</div>
      </div>

      <div class="row" style={{ gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <span class={`rarity ${h.rarity}`}>{RARITY_LABEL[h.rarity]}</span>
        <span class="label">
          <Ic id={role.icon} /> {role.name}
        </span>
        {rec && <span class="label">Ур. {lv}</span>}
      </div>

      <p style={{ marginBottom: 10 }}>{h.bio}</p>
      <p class="t2" style={{ marginBottom: 6 }}>
        «{h.quote}»
      </p>
      <p class="hint">Гость из мира: {h.realm}</p>

      <Section title="Бонус">
        <div class="lrow">
          <div class="grow">
            <div class="name plus" style={{ whiteSpace: 'normal' }}>
              {bonusText(h.bonus.type, E.heroBonusValue(h, Math.max(1, lv)), h.bonus.target)}
            </div>
            {rec && lv < E.BAL.maxHeroLevel && <div class="sub">На ур. {lv + 1}: {bonusText(h.bonus.type, E.heroBonusValue(h, lv + 1), h.bonus.target)}</div>}
            <div class="sub">Сила в экспедиции: {fmt(E.heroPower(s, id) || E.BAL.heroPower[h.rarity], 1)}</div>
          </div>
        </div>
        {!rec && h.recruit === 'shards' && (
          <div style={{ marginTop: 8 }}>
            <Row
              icon={<Px id="shard" scale={2} />}
              name="Осколки контракта"
              count={`${hs?.shards ?? 0} / ${need}`}
              progress={{ value: (hs?.shards ?? 0) / need }}
              sub="Выпадают в экспедициях и за задания дня"
            />
          </div>
        )}
      </Section>

      <div style={{ marginTop: 24 }}>{cta}</div>
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
    <div>
      <Section title="Куда">
        <div class="pick-grid">
          {LOCATIONS.map((l) => {
            const avail = l.chapter <= s.chapter;
            return (
              <button key={l.id} class={`pick ${loc === l.id ? 'on' : ''} ${avail ? '' : 'off'}`} onClick={() => avail && setLoc(l.id)}>
                <span class="plate">{avail ? <Px id={l.id} scale={2} /> : <Glyph name="lock" cell={3} color="var(--text-3)" />}</span>
                <div class="grow">
                  <div class="pn">{avail ? TEXTS.locations[l.id].name : `Глава ${l.chapter}`}</div>
                  {avail && (
                    <div class="ps">
                      <Ic id={ING_BY_ID[l.drops[0]].id} /> <Ic id={ING_BY_ID[l.drops[1]].id} />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        <p class="hint" style={{ marginTop: 10 }}>
          Здесь сильнее: <Ic id={ROLE_LABEL[L.favoredRole].icon} /> {ROLE_LABEL[L.favoredRole].name} · нужна сила {L.power}
        </p>
      </Section>

      <Section title="Время">
        <div class="seg">
          {EXPEDITION_DURATIONS.map((x) => (
            <button key={x.id} class={dur === x.id ? 'on' : ''} onClick={() => setDur(x.id)}>
              {fmtTime(E.expeditionSeconds(m, x.id))}
            </button>
          ))}
        </div>
        <p class="hint" style={{ marginTop: 10 }}>
          ≈ <span class="num t2">{Math.round(d.loot * 1.5 * m.expLoot)}</span> ингредиентов и <span class="num ess">{Math.round(d.essence * (1 + L.chapter * 0.25) * m.essence)}</span> эссенции
        </p>
      </Section>

      <Section title="Отряд" aside="до 3 героев">
        {free.length ? (
          <div class="pick-grid">
            {free.map((h) => (
              <button key={h.id} class={`pick ${team.includes(h.id) ? 'on' : ''}`} onClick={() => toggle(h.id)}>
                <Portrait h={h} size="sm" />
                <div class="grow">
                  <div class="pn">{h.name}</div>
                  <div class="ps">
                    <Ic id={ROLE_LABEL[h.role].icon} /> сила <span class="num">{fmt(E.heroPower(s, h.id, loc), 1)}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p class="hint">Все герои уже в пути</p>
        )}
      </Section>

      <div class="row" style={{ marginTop: 24, marginBottom: 14 }}>
        <span class="label grow">Шанс успеха</span>
        <span class="num" style={{ fontSize: 24, color: chance >= 0.85 ? 'var(--plus)' : chance >= 0.5 ? 'var(--gold)' : 'var(--text-2)' }}>
          {pct(chance)}
        </span>
      </div>
      <Cta off={!team.length} onClick={() => team.length && st.startExpedition(loc, dur, team) && onDone()}>
        Отправить отряд
      </Cta>
      <p class="hint" style={{ marginTop: 10 }}>
        При неудаче вернутся с частью эссенции
      </p>
    </div>
  );
}

// ─── Меню ────────────────────────────────────────────────────────────────────

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return <button class={`toggle ${on ? 'on' : ''}`} onClick={onClick} role="switch" aria-checked={on} aria-label={label} />;
}

/** Проверка вибрации: системный переключатель (его щелчок проигрывает сама iOS) и щелчок из кода игры. */
function HapticCheck() {
  const ua = navigator.userAgent;
  const ios = ua.match(/OS (\d+)_(\d+)/);
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone;
  const env = [
    ios ? `iOS ${ios[1]}.${ios[2]}` : 'не iOS',
    standalone ? 'приложение' : 'браузер',
    typeof navigator.vibrate === 'function' ? 'vibrate есть' : 'vibrate нет',
  ].join(' · ');
  return (
    <div class="haptic-check">
      <p class="hint">
        Нет вибрации? Переключи системный тумблер: если iPhone не щёлкнул, вибрация для сайтов выключена в iOS (Настройки → Звуки, тактильные сигналы → Системные тактильные сигналы) или версия iOS ниже 18.
      </p>
      <div class="row">
        <label class="native">
          <input type="checkbox" {...({ switch: true } as Record<string, unknown>)} />
          Системный
        </label>
        <button class="btn2" onClick={() => hapticTest()}>
          Щелчок из игры
        </button>
      </div>
      <small class="t3">{env}</small>
    </div>
  );
}

function Settings() {
  const st = useStore();
  const s = st.s;
  const [view, setView] = useState<'main' | 'ach' | 'save'>('main');
  const [code, setCode] = useState('');
  const [resetConfirm, setResetConfirm] = useState(0);
  const [recovery, setRecovery] = useState<string | null>(null);
  const [claimCode, setClaimCode] = useState('');
  const back = (
    <button class="btn2" style={{ marginBottom: 16 }} onClick={() => setView('main')}>
      <Ic id="arrow_left" /> Назад
    </button>
  );

  if (view === 'ach') {
    const have = new Set(s.achievements);
    return (
      <div>
        {back}
        <p class="hint" style={{ marginBottom: 12 }}>
          <span class="num t2">
            {s.achievements.length}/{ACHIEVEMENTS.length}
          </span>{' '}
          · каждое <span class="plus">+1%</span> к доходу
        </p>
        <div class="ach-grid">
          {ACHIEVEMENTS.map((a) => (
            <button key={a.id} class={`ach ${have.has(a.id) ? '' : 'off'}`} aria-label={a.name} onClick={() => st.toast({ icon: a.icon, title: a.name, text: a.desc, kind: have.has(a.id) ? 'ach' : 'info' })}>
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
        {back}
        <Row
          icon={<Px id="save" scale={2} />}
          name="Облачное сохранение"
          count={st.cloudStatus === 'synced' ? <span class="plus">включено</span> : st.cloudStatus === 'connecting' ? '…' : 'нет связи'}
          sub={
            st.cloudStatus === 'synced'
              ? `Синхронизировано в ${new Date(st.cloudAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
              : 'Прогресс сохранится в облако, когда появится интернет'
          }
        />
        <button
          class="btn2 block"
          onClick={() => {
            void st.cloud?.pushNow(true);
            st.toast({ icon: 'save', title: 'Сохраняем в облако', kind: 'info' });
          }}
        >
          Сохранить в облако сейчас
        </button>

        <span class="label" style={{ marginTop: 16 }}>
          Код восстановления
        </span>
        {recovery ? (
          <div class="lrow" style={{ justifyContent: 'space-between' }}>
            <span class="num gold" style={{ fontSize: 22, letterSpacing: 1 }}>
              {recovery}
            </span>
            <button
              class="btn2"
              onClick={() => {
                void navigator.clipboard?.writeText(recovery);
                st.toast({ icon: 'copy', title: 'Код скопирован', text: 'Сохрани его в Заметки', kind: 'info' });
              }}
            >
              <Ic id="copy" /> Копировать
            </button>
          </div>
        ) : (
          <button
            class="btn2 block"
            onClick={async () => {
              const c = await st.cloud?.getRecoveryCode();
              if (c) setRecovery(c);
              else st.toast({ icon: 'warning', title: 'Нет связи с облаком', text: 'Попробуй позже', kind: 'warn' });
            }}
          >
            <Ic id="shard" /> Показать мой код
          </button>
        )}
        <p class="hint">С этим кодом прогресс вернётся после переустановки или на новом телефоне</p>
        <input
          class="code"
          style={{ minHeight: 0, height: 48, fontFamily: 'var(--px)', fontSize: 18, letterSpacing: 1, textTransform: 'uppercase' }}
          placeholder="XXXX-XXXX-XXXX"
          autocapitalize="characters"
          autocomplete="off"
          spellcheck={false}
          value={claimCode}
          onInput={(e) => setClaimCode((e.currentTarget as HTMLInputElement).value)}
        />
        <button
          class={`btn2 block ${claimCode.replace(/[^A-Za-z0-9]/g, '').length === 12 ? '' : 'off'}`}
          onClick={async () => {
            if (claimCode.replace(/[^A-Za-z0-9]/g, '').length !== 12) return;
            if (!confirm('Прогресс на этом устройстве заменится прогрессом из облака. Продолжить?')) return;
            const r = await st.cloud?.claimRecoveryCode(claimCode);
            if (r === 'ok') {
              setClaimCode('');
              setRecovery(null);
              st.toast({ icon: 'check', title: 'Прогресс восстановлен', kind: 'gold' });
            } else if (r === 'invalid') st.toast({ icon: 'warning', title: 'Код не найден', text: 'Проверь буквы и цифры', kind: 'warn' });
            else st.toast({ icon: 'warning', title: 'Нет связи с облаком', text: 'Попробуй позже', kind: 'warn' });
          }}
        >
          Восстановить по коду
        </button>

        <span class="label" style={{ marginTop: 16 }}>
          Код прогресса (без облака)
        </span>
        <textarea class="code" readOnly value={st.exportSave()} onFocus={(e) => (e.currentTarget as HTMLTextAreaElement).select()} />
        <button
          class="btn2 block"
          onClick={() => {
            void navigator.clipboard?.writeText(st.exportSave());
            st.toast({ icon: 'copy', title: 'Скопировано', kind: 'info' });
          }}
        >
          <Ic id="copy" /> Скопировать код
        </button>
        <span class="label" style={{ marginTop: 16 }}>
          Загрузить прогресс
        </span>
        <textarea class="code" value={code} onInput={(e) => setCode((e.currentTarget as HTMLTextAreaElement).value)} placeholder="Вставь код сюда" />
        <button
          class="btn2 block"
          onClick={() =>
            st.importSave(code) ? st.toast({ icon: 'check', title: 'Прогресс загружен', kind: 'info' }) : st.toast({ icon: 'warning', title: 'Неверный код', kind: 'warn' })
          }
        >
          Загрузить
        </button>
        <button
          class="btn2 block"
          style={{ marginTop: 16, color: 'var(--text-2)' }}
          onClick={async () => {
            if (!confirm('Удалить облачный аккаунт и все сохранения в облаке? Прогресс на этом устройстве останется.')) return;
            const ok = await st.cloud?.deleteCloudAccount();
            st.toast({ icon: ok ? 'check' : 'warning', title: ok ? 'Облачный аккаунт удалён' : 'Не удалось удалить', kind: 'info' });
          }}
        >
          <Ic id="trash" /> Удалить облачный аккаунт
        </button>
      </div>
    );
  }
  const stats: [string, string][] = [
    ['Золото за всё время', fmt(s.allTimeEarned)],
    ['Лучший доход', `${fmt(s.stats.bestGps)}/с`],
    ['Тапов', fmt(s.stats.taps)],
    ['Критов', fmt(s.stats.crits)],
    ['Поймано искр', fmt(s.stats.wisps)],
    ['Сварено зелий', fmt(s.stats.brews)],
    ['Экспедиций', fmt(s.stats.expeditions)],
    ['Трансмутаций', fmt(s.transmutations)],
    ['Лучшая серия', `${s.daily.bestStreak}`],
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
      <div class="stack">
        <div class="setting">
          <Ic id="sound" scale={2} />
          <span class="grow">Звук</span>
          <Toggle label="Звук" on={s.settings.sound} onClick={() => set('sound')} />
        </div>
        <div class="setting">
          <Ic id="vibrate" scale={2} />
          <span class="grow">Вибрация</span>
          <Toggle label="Вибрация" on={s.settings.haptics} onClick={() => set('haptics')} />
        </div>
        <HapticCheck />
        <div class="setting">
          <Ic id="numbers" scale={2} />
          <span class="grow">Числа</span>
          <div class="seg">
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
        <Row icon={<Px id="trophy" scale={2} />} name="Достижения" count={`${s.achievements.length}/${ACHIEVEMENTS.length}`} onClick={() => setView('ach')} />
        <Row
          icon={<Px id="save" scale={2} />}
          name="Облако и сохранение"
          count={
            st.cloudStatus === 'synced' ? (
              <span class="plus">{new Date(st.cloudAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
            ) : st.cloudStatus === 'connecting' ? (
              '…'
            ) : st.cloudStatus === 'off' ? (
              ''
            ) : (
              'нет связи'
            )
          }
          onClick={() => setView('save')}
        />
        <Row icon={<Px id="scroll" scale={2} />} name="История" count={`${Math.min(s.chapter, TEXTS.chapters.length)}/${TEXTS.chapters.length}`} onClick={() => st.openSheet('story')} />
      </div>

      <Section title="Статистика">
        {stats.map(([k, v]) => (
          <div key={k} class="stat">
            <span>{k}</span>
            <span class="num">{v}</span>
          </div>
        ))}
      </Section>

      <Section>
        <p class="hint" style={{ marginBottom: 12 }}>
          Safari → «Поделиться» → «На экран Домой» — и лавка откроется как приложение
        </p>
        <button
          class="btn2 block"
          onClick={() => {
            if (resetConfirm < 2) setResetConfirm(resetConfirm + 1);
            else {
              st.hardReset();
              st.openSheet(null);
            }
          }}
        >
          <Ic id={resetConfirm ? 'warning' : 'trash'} /> {['Начать заново', 'Весь прогресс будет удалён', 'Нажми ещё раз для подтверждения'][resetConfirm]}
        </button>
      </Section>
    </div>
  );
}

/** Все открытые главы можно перечитать: пролог, вступления глав, эпилог. */
function StorySheet() {
  const st = useStore();
  const s = st.s;
  return (
    <div class="stack">
      <Row icon={<Px id="scroll" scale={2} />} name="Пролог" sub="Как ты попал в лавку" onClick={() => st.replayStory('Пролог', TEXTS.prologue)} />
      {TEXTS.chapters.map((ch, i) => {
        const open = i < s.chapter;
        return (
          <Row
            key={i}
            icon={<Px id={open ? 'book' : 'lock'} scale={2} />}
            name={open ? ch.title : '???'}
            count={`Глава ${i + 1}`}
            sub={open ? ch.goal : 'Откроется по ходу игры'}
            locked={!open}
            onClick={open ? () => st.replayStory(`Глава ${i + 1}. ${ch.title}`, ch.intro) : undefined}
          />
        );
      })}
      <Row
        icon={<Px id={s.finalDone ? 'stone' : 'lock'} scale={2} />}
        name={s.finalDone ? 'Эпилог' : '???'}
        sub={s.finalDone ? 'Философский камень' : 'Свари Философский камень'}
        locked={!s.finalDone}
        onClick={s.finalDone ? () => st.replayStory('Эпилог', TEXTS.epilogue) : undefined}
      />
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
  if (sh === 'story')
    return (
      <Sheet title="История" onClose={close}>
        <StorySheet />
      </Sheet>
    );
  if ('hero' in sh)
    return (
      <Sheet title="Герой" onClose={close}>
        <HeroView id={sh.hero} />
      </Sheet>
    );
  return (
    <Sheet title="Экспедиция" onClose={close}>
      <ExpeditionPlanner onDone={close} />
    </Sheet>
  );
}


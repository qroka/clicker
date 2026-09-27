import { useEffect, useState } from 'preact/hooks';
import { useStore, type Modal } from './store';
import { TEXTS } from '../data/texts';
import { ING_BY_ID, RECIPES } from '../data/world';
import { CHALLENGE_BY_ID } from '../data/progression';
import { fmt, fmtTime } from './format';
import { bonusText, speaker } from './labels';
import { brewText } from './tabs/Lab';
import { haptic, sfx } from './fx';
import type { DialogueLine, IngredientId } from '../core/types';
import { Ic, Px } from './Px';
import { Cta } from './kit';
import * as E from '../core/engine';
import { HERO_VISITS } from '../data/visits';
import { RARITY_LABEL } from './labels';

/** Если гость предлагает ускорить экспедиции — общая реплика (у героев свои только для сделок роли). */
const HASTE_LINE = 'Вижу, твои ребята в пути. Я знаю тропу покороче — сбегаю, подскажу им?';

function dealText(o: E.VisitOffer, lvl: number): { get: string; icon: string } {
  switch (o.kind) {
    case 'tap':
      return { icon: 'fist', get: `Тапы ×${o.buff!.mult} на ${o.buff!.seconds} с` };
    case 'crit':
      return { icon: 'target', get: `Шанс крита ×${o.buff!.mult} на ${o.buff!.seconds} с` };
    case 'prod':
      return { icon: 'flask', get: `Весь доход ×${o.buff!.mult} на ${o.buff!.seconds} с` };
    case 'trade':
      return { icon: 'essence', get: `+${fmt(o.essence!)} эссенции и ${o.ingredients} ингредиента` };
    case 'train':
      return { icon: 'cap', get: `Уровень героя ${lvl} → ${lvl + 1}` };
    case 'haste':
      return { icon: 'compass', get: 'Экспедиции в пути вернутся вдвое быстрее' };
  }
}

function VisitView({ onClose }: { onClose: () => void }) {
  const st = useStore();
  const s = st.s;
  const v = s.visit;
  if (!v) return null;
  const h = E.HERO_BY_ID[v.hero];
  const text = HERO_VISITS[v.hero];
  const m = st.mods();
  const o = E.visitOffer(s, m, v);
  const lvl = s.heroes[v.hero]?.level ?? 1;
  const deal = dealText(o, lvl);
  const talks = s.heroTalks[v.hero] ?? 0;
  const greet = text && talks >= text.arc.length ? text.greet[v.arrived % text.greet.length] : null;
  const line = o.kind === 'haste' ? HASTE_LINE : (text?.offer ?? h.quote);
  const can = E.canAcceptVisit(s, m);
  const price = o.cost.gold ? (
    <>
      <Px id="coin" scale={1} /> {fmt(o.cost.gold)}
    </>
  ) : o.cost.essence ? (
    <>
      <Ic id="essence" /> {fmt(o.cost.essence)}
    </>
  ) : null;
  const lack = o.cost.gold && s.gold < o.cost.gold ? 'золота' : o.cost.essence && s.essence < o.cost.essence ? 'эссенции' : '';
  return (
    <>
      <div class="scrim" onClick={onClose} />
      <div class="modal visit-modal" role="dialog">
        <div class="visit-head">
          <span class="plate">
            <Px id={h.id} scale={3} />
          </span>
          <div>
            <div class="label">
              {RARITY_LABEL[h.rarity]} · {h.title}
            </div>
            <h2>{h.name}</h2>
          </div>
        </div>
        {greet && <p class="visit-say">«{greet}»</p>}
        <p class="visit-say">«{line}»</p>
        <div class="deal">
          <div class="deal-row">
            <span class="k">Ты получишь</span>
            <span class="v">
              <Ic id={deal.icon} /> {deal.get}
            </span>
          </div>
          <div class="deal-row">
            <span class="k">Цена</span>
            <span class="v">{price ?? <span class="plus">бесплатно</span>}</span>
          </div>
        </div>
        <Cta
          off={!can}
          onClick={() => {
            st.acceptVisit();
            onClose();
          }}
        >
          {can ? 'По рукам' : `Не хватает ${lack}`}
        </Cta>
        <button
          class="btn2 block"
          style={{ marginTop: 8 }}
          onClick={() => {
            st.declineVisit();
            onClose();
          }}
        >
          Не сейчас
        </button>
      </div>
    </>
  );
}

function Dialogue({ title, lines, onClose }: { title?: string; lines: DialogueLine[]; onClose: () => void }) {
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(0);
  const line = lines[i];
  useEffect(() => {
    setShown(0);
  }, [i]);
  useEffect(() => {
    if (!line || shown >= line.text.length) return;
    const t = setTimeout(() => setShown((n) => Math.min(line.text.length, n + 2)), 18);
    return () => clearTimeout(t);
  }, [shown, line]);
  if (!line) return null;
  const sp = speaker(line.speaker);
  const next = () => {
    haptic();
    if (shown < line.text.length) setShown(line.text.length);
    else if (i + 1 < lines.length) {
      sfx.soft();
      setI(i + 1);
    } else onClose();
  };
  return (
    <>
      <div class="scrim" onClick={next} />
      <div class="dialogue" onClick={next}>
        {title && <div class="dtitle">{title}</div>}
        <div class="dbox">
          <div class="dspeaker">
            <span class="plate">
              <Px id={sp.icon} scale={2} />
            </span>
            <span class="label" style={{ color: 'var(--gold)' }}>
              {sp.name}
            </span>
          </div>
          <div class="dtext">{line.text.slice(0, shown)}</div>
          <div class="dnext">
            <button
              class="btn2"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
            >
              Пропустить
            </button>
            <span class="num t3">
              {i + 1}/{lines.length}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

function IngList({ ings }: { ings: Partial<Record<IngredientId, number>> }) {
  return (
    <div class="row" style={{ flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
      {Object.entries(ings).map(([id, n]) => (
        <span key={id} class="pill">
          <Px id={ING_BY_ID[id as IngredientId].id} scale={1} /> ×{n}
        </span>
      ))}
    </div>
  );
}

function ModalView({ m, onClose }: { m: Exclude<Modal, { type: 'dialogue' }>; onClose: () => void }) {
  if (m.type === 'visit') return <VisitView onClose={onClose} />;
  let body;
  let cta = 'Отлично';
  switch (m.type) {
    case 'offline':
      cta = 'Забрать золото';
      body = (
        <>
          <div class="hero-art">
            <Px id="moon" scale={4} />
          </div>
          <h2>С возвращением</h2>
          <p>
            Тебя не было {fmtTime(m.report.seconds)}
            {m.report.cappedSeconds < m.report.seconds ? `, засчитано ${fmtTime(m.report.cappedSeconds)}` : ''}
          </p>
          <div class="reward">
            <Px id="coin" scale={2} />+{fmt(m.report.gold)}
          </div>
          {m.report.expeditionsReady > 0 && (
            <p class="hint">
              <Ic id="compass" /> Вернулись экспедиции: <span class="num t2">{m.report.expeditionsReady}</span>
            </p>
          )}
        </>
      );
      break;
    case 'loot': {
      cta = 'Забрать добычу';
      body = (
        <>
          <div class="hero-art">
            <Px id={m.loot.success ? 'bag' : 'broken'} scale={4} />
          </div>
          <h2>{m.loot.success ? 'Удачная вылазка' : 'Неудача'}</h2>
          <p>{m.story}</p>
          <IngList ings={m.loot.ingredients} />
          <div class="row" style={{ flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            <span class="pill essence">
              <Ic id="essence" />+{m.loot.essence}
            </span>
            {m.loot.shards.map((sh, i) => (
              <span key={i} class="pill">
                <Px id={sh.hero} scale={1} />+{sh.n}
              </span>
            ))}
          </div>
        </>
      );
      break;
    }
    case 'discover': {
      const r = RECIPES.find((x) => x.id === m.recipe)!;
      body = (
        <>
          <div class="hero-art">
            <Px id="flask" scale={4} tint={r.color} />
          </div>
          <div class="label">Новый рецепт</div>
          <h2 style={{ marginTop: 4 }}>{TEXTS.recipes[r.id].name}</h2>
          <p>
            <span class="plus">{bonusText(r.discovery.type, r.discovery.value, r.discovery.target)}</span> навсегда
          </p>
          <p class="hint" style={{ marginTop: -8 }}>
            Варка: {brewText(r.brew)}
          </p>
        </>
      );
      break;
    }
    case 'transmuted':
      body = (
        <>
          <div class="hero-art">
            <Px id="stone" scale={4} />
          </div>
          <h2>Трансмутация</h2>
          <p>Лавка возрождается сильнее прежнего</p>
          <div class="reward">
            <Px id="stone" scale={2} />+{fmt(m.stones)}
          </div>
        </>
      );
      break;
    case 'cloudConflict':
      return (
        <>
          <div class="scrim" />
          <div class="modal" role="dialog">
            <div class="hero-art">
              <Px id="save" scale={4} />
            </div>
            <div class="label">Облачное сохранение</div>
            <h2 style={{ marginTop: 4 }}>В облаке больше прогресса</h2>
            <p>
              Сейв от {new Date(m.updatedAt).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })} ·{' '}
              <span class="num gold">{fmt(m.progress)}</span> золота за всё время
            </p>
            <Cta
              onClick={() => {
                m.useCloud();
                onClose();
              }}
            >
              Загрузить из облака
            </Cta>
            <button
              class="btn2 block"
              style={{ marginTop: 8 }}
              onClick={() => {
                m.keepLocal();
                onClose();
              }}
            >
              Оставить прогресс устройства
            </button>
          </div>
        </>
      );
    case 'challengeDone': {
      const c = CHALLENGE_BY_ID[m.id];
      body = (
        <>
          <div class="hero-art">
            <Px id="trophy" scale={4} />
          </div>
          <div class="label">Испытание пройдено</div>
          <h2 style={{ marginTop: 4 }}>{c.name}</h2>
          <p>
            <span class="plus">{c.rewardText}</span> навсегда
          </p>
        </>
      );
      break;
    }
  }
  return (
    <>
      <div class="scrim" onClick={onClose} />
      <div class="modal" role="dialog">
        {body}
        <div style={{ marginTop: 8 }}>
          <Cta onClick={onClose}>{cta}</Cta>
        </div>
      </div>
    </>
  );
}

export function Overlays() {
  const st = useStore();
  const m = st.modals[0];
  return (
    <>
      {m && (m.type === 'dialogue' ? <Dialogue key={m.title ?? 'd'} title={m.title} lines={m.lines} onClose={() => st.closeModal()} /> : <ModalView m={m} onClose={() => st.closeModal()} />)}
      <div class="toasts">
        {st.toasts.map((t) => (
          <div key={t.id} class={`toast ${t.kind ? 'toast-' + t.kind : ''}`}>
            <span class="tplate">
              <Px id={t.icon} scale={2} />
            </span>
            <div>
              <b>{t.title}</b>
              {t.text && <small>{t.text}</small>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

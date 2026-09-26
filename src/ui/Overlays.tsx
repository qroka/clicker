import { useEffect, useState } from 'preact/hooks';
import { useStore, type Modal } from './store';
import { TEXTS } from '../data/texts';
import { ING_BY_ID, RECIPES } from '../data/world';
import { CHALLENGE_BY_ID } from '../data/progression';
import * as E from '../core/engine';
import { fmt, fmtTime } from './format';
import { bonusText, speaker } from './labels';
import { brewText } from './tabs/Lab';
import { haptic, sfx } from './fx';
import type { DialogueLine, IngredientId } from '../core/types';

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
            <span>{sp.emoji}</span>
            {sp.name}
          </div>
          <div class="dtext">{line.text.slice(0, shown)}</div>
          <div class="dnext">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
            >
              Пропустить
            </button>
            <span>
              {i + 1}/{lines.length} · нажми ▸
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

function IngList({ ings }: { ings: Partial<Record<IngredientId, number>> }) {
  return (
    <div class="row" style={{ justifyContent: 'center', flexWrap: 'wrap', gap: 8, margin: '8px 0' }}>
      {Object.entries(ings).map(([id, n]) => (
        <span key={id} class="chip">
          {ING_BY_ID[id as IngredientId].emoji} ×{n}
        </span>
      ))}
    </div>
  );
}

function ModalView({ m, onClose }: { m: Exclude<Modal, { type: 'dialogue' }>; onClose: () => void }) {
  let body;
  switch (m.type) {
    case 'offline':
      body = (
        <>
          <div class="big-emoji">🌙</div>
          <h2>С возвращением!</h2>
          <p class="muted">
            Пока тебя не было {fmtTime(m.report.seconds)}, ученики и кот работали.
            {m.report.cappedSeconds < m.report.seconds && ` (Лимит оффлайна: ${fmtTime(m.report.cappedSeconds)})`}
          </p>
          <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--gold)', margin: '10px 0' }} class="num">
            +{fmt(m.report.gold)} 🪙
          </div>
          {m.report.expeditionsReady > 0 && <p class="small" style={{ color: 'var(--teal)' }}>🧭 Вернулись экспедиции: {m.report.expeditionsReady}</p>}
        </>
      );
      break;
    case 'loot': {
      const story = (m.loot.success ? TEXTS.expeditionStories.success : TEXTS.expeditionStories.fail)[Math.floor(Math.random() * 8)] ?? '';
      const hero = E.HERO_BY_ID[m.heroes[0]]?.name ?? 'Отряд';
      body = (
        <>
          <div class="big-emoji">{m.loot.success ? '🎒' : '🩹'}</div>
          <h2>{m.loot.success ? 'Удачная вылазка!' : 'Неудача…'}</h2>
          <p class="muted small">{story.replaceAll('{hero}', hero).replaceAll('{place}', TEXTS.locations[m.location as keyof typeof TEXTS.locations]?.name ?? '')}</p>
          <IngList ings={m.loot.ingredients} />
          <div class="row" style={{ justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span class="chip">💧 +{m.loot.essence}</span>
            {m.loot.shards.map((sh, i) => (
              <span key={i} class="chip">
                📜 {E.HERO_BY_ID[sh.hero]?.emoji} +{sh.n}
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
          <div class="rays" />
          <div class="big-emoji">🧪</div>
          <h2>Новый рецепт!</h2>
          <h3 style={{ color: r.color, fontSize: 20, margin: '4px 0' }}>{TEXTS.recipes[r.id].name}</h3>
          <p class="muted small">{TEXTS.recipes[r.id].desc}</p>
          <p style={{ color: 'var(--teal)', fontWeight: 800 }}>Навсегда: {bonusText(r.discovery.type, r.discovery.value, r.discovery.target)}</p>
          <p class="small">Эффект варки: {brewText(r.brew)}</p>
        </>
      );
      break;
    }
    case 'transmuted':
      body = (
        <>
          <div class="rays" />
          <div class="big-emoji">💎</div>
          <h2>Трансмутация!</h2>
          <p class="muted">Лавка возрождается из пепла — сильнее прежнего.</p>
          <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--gold)' }}>+{fmt(m.stones)} 💎</div>
        </>
      );
      break;
    case 'challengeDone': {
      const c = CHALLENGE_BY_ID[m.id];
      body = (
        <>
          <div class="rays" />
          <div class="big-emoji">🏆</div>
          <h2>Испытание пройдено!</h2>
          <p>
            {c.emoji} {c.name}
          </p>
          <p style={{ color: 'var(--teal)', fontWeight: 800 }}>Навсегда: {c.rewardText}</p>
        </>
      );
      break;
    }
  }
  return (
    <>
      <div class="scrim" onClick={onClose} />
      <div class="modal">
        {body}
        <button class="btn block big" style={{ marginTop: 14 }} onClick={onClose}>
          Отлично!
        </button>
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
            <span class="te">{t.emoji}</span>
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

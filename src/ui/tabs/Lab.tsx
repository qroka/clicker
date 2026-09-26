import { useState } from 'preact/hooks';
import { useStore } from '../store';
import * as E from '../../core/engine';
import { FINAL_RECIPE, INGREDIENTS, ING_BY_ID, RECIPES } from '../../data/world';
import { TEXTS } from '../../data/texts';
import type { IngredientId, RecipeDef } from '../../core/types';
import { bonusText } from '../labels';
import { fmt, fmtTime } from '../format';
import { burst } from '../fx';

export function brewText(b: RecipeDef['brew']): string {
  switch (b.kind) {
    case 'prodBoost':
      return `Доход ×${b.mult} на ${fmtTime(b.seconds)}`;
    case 'tapBoost':
      return `Тап ×${b.mult} на ${fmtTime(b.seconds)}`;
    case 'critBoost':
      return `Шанс крита ×${b.mult} на ${fmtTime(b.seconds)}`;
    case 'wispRain':
      return `Дождь искр ${fmtTime(b.seconds)}`;
    case 'haste':
      return `Экспедиции −${fmtTime(b.seconds)}`;
    case 'goldRush':
      return `Мгновенно ${fmtTime(b.mult * 60)} дохода`;
  }
}

const RARITY_STARS = { common: 1, rare: 2, epic: 3, legendary: 4 };

export function LabTab() {
  const st = useStore();
  const s = st.s;
  const [slots, setSlots] = useState<IngredientId[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [distillMode, setDistillMode] = useState(false);

  const used = (id: IngredientId) => slots.filter((x) => x === id).length;
  const add = (id: IngredientId) => {
    if (distillMode) {
      const got = st.do((s) => E.distill(s, id, 10));
      setMsg(got ? `⚗️ Перегнано в эссенцию: +${fmt(got)} 💧` : 'Нечего перегонять.');
      return;
    }
    if (slots.length >= 3 || (s.ingredients[id] ?? 0) - used(id) <= 0) return;
    setSlots([...slots, id]);
    setMsg(null);
  };
  const remove = (i: number) => setSlots(slots.filter((_, j) => j !== i));

  const doBrew = (ings: IngredientId[], el?: HTMLElement) => {
    const r = st.brew(ings);
    if (r.kind === 'failed') {
      setMsg(
        r.closest === 0
          ? '💨 Пшик. Ни один ингредиент не подходит к неизвестным рецептам.'
          : `💨 Не вышло… но ${r.closest} из 3 ингредиентов подходят к одному неизвестному рецепту! (+3 💧)`,
      );
    } else if (r.kind === 'locked') {
      setMsg(s.chapter < 8 ? '🔒 Котёл не выдержит такой силы. Вернись в главе 8.' : `🔒 Для Великого Делания нужно 🪙 ${fmt(E.BAL.finalCost)} в казне.`);
      return;
    } else if (r.kind === 'missing') {
      setMsg('Не хватает ингредиентов.');
      return;
    } else {
      setMsg(r.kind === 'brewed' ? `✨ ${TEXTS.recipes[r.recipe].name} готово! ${brewText(RECIPES.find((x) => x.id === r.recipe)!.brew)}` : null);
      const rect = el?.getBoundingClientRect();
      if (rect) burst(rect.left + rect.width / 2, rect.top + rect.height / 2, { n: 30, kind: 'bubble', colors: [RECIPES.find((x) => x.id === r.recipe)!.color, '#fff'], speed: 6 });
    }
    setSlots([]);
  };

  const known = RECIPES.filter((r) => s.recipesKnown.includes(r.id));
  const unknown = RECIPES.filter((r) => !s.recipesKnown.includes(r.id));

  return (
    <div>
      <div class="section-title">
        <h2>Котёл экспериментов</h2>
        <small>Рецептов: {known.length}/{RECIPES.length}</small>
      </div>
      <div class="card">
        <div class="brew-slots">
          {[0, 1, 2].map((i) => {
            const id = slots[i];
            return (
              <button key={i} class={`brew-slot ${id ? 'filled' : ''}`} onClick={() => id && remove(i)} style={id ? { borderColor: ING_BY_ID[id].color } : {}}>
                {id ? ING_BY_ID[id].emoji : ''}
              </button>
            );
          })}
        </div>
        <button
          class={`btn teal block big ${slots.length === 3 ? '' : 'disabled'}`}
          onClick={(e) => slots.length === 3 && doBrew(slots, e.currentTarget as HTMLElement)}
        >
          🧪 Сварить
        </button>
        {msg && (
          <div class="small" style={{ marginTop: 10, textAlign: 'center', fontWeight: 700 }}>
            {msg}
          </div>
        )}
        <div class="ing-grid" style={{ marginTop: 14 }}>
          {INGREDIENTS.map((ing) => {
            const n = (s.ingredients[ing.id] ?? 0) - used(ing.id);
            return (
              <button key={ing.id} class={`ing ${n <= 0 ? 'empty' : ''}`} style={{ '--c': ing.color }} onClick={() => add(ing.id)} title={TEXTS.ingredients[ing.id].name}>
                {ing.emoji}
                <span class="cnt num">{n}</span>
              </button>
            );
          })}
        </div>
        <button class={`btn ${distillMode ? 'violet' : 'ghost'} block`} style={{ marginTop: 10 }} onClick={() => { setDistillMode(!distillMode); setSlots([]); setMsg(null); }}>
          {distillMode ? '⚗️ Перегонка: нажимай ингредиенты (по 10 шт.) · выйти' : '⚗️ Перегнать лишнее в эссенцию'}
        </button>
        <div class="small muted" style={{ marginTop: 10 }}>
          Выбери 3 ингредиента и попробуй. Неудачный опыт сжигает ингредиенты, зато кот подскажет, насколько ты был близок.
        </div>
      </div>

      {known.length > 0 && (
        <>
          <div class="section-title">
            <h2>Книга рецептов</h2>
          </div>
          <div class="stack">
            {known.map((r) => {
              const can = E.canBrewKnown(s, r.id);
              return (
                <div key={r.id} class="recipe">
                  <div class="flask" style={{ '--c': r.color }}>
                    🧪
                  </div>
                  <div class="grow">
                    <b>{TEXTS.recipes[r.id].name}</b>
                    <div class="small" style={{ color: 'var(--teal)', fontWeight: 700 }}>
                      Открытие: {bonusText(r.discovery.type, r.discovery.value, r.discovery.target)}
                    </div>
                    <div class="small muted">
                      {r.ingredients.map((i) => ING_BY_ID[i].emoji).join(' ')} → {brewText(r.brew)}
                    </div>
                  </div>
                  <button class={`btn ${can ? '' : 'disabled'}`} onClick={(e) => can && doBrew([...r.ingredients], e.currentTarget as HTMLElement)}>
                    Сварить
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {unknown.length > 0 && (
        <>
          <div class="section-title">
            <h2>Неизвестные рецепты</h2>
            <small>подсказки из записей Альбериха</small>
          </div>
          <div class="stack">
            {unknown.map((r) => {
              const stars = Math.max(...r.ingredients.map((i) => RARITY_STARS[ING_BY_ID[i].rarity]));
              const isFinal = r.id === FINAL_RECIPE;
              return (
                <div key={r.id} class="recipe" style={isFinal ? { borderColor: 'rgba(255,51,85,0.5)', background: 'linear-gradient(90deg, rgba(255,51,85,0.12), var(--card))' } : {}}>
                  <div class="flask unknown">?</div>
                  <div class="grow">
                    <b>{isFinal ? TEXTS.recipes[r.id].name : '???'}</b>
                    <div class="small muted">{TEXTS.recipes[r.id].desc}</div>
                    <div class="small" style={{ color: 'var(--gold)' }}>
                      {'★'.repeat(stars)}
                      <span class="dim">{'★'.repeat(4 - stars)}</span>
                      {isFinal && <span class="muted"> · глава 8 + 🪙 {fmt(E.BAL.finalCost)}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

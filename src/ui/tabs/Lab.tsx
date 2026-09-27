import { useState } from 'preact/hooks';
import { useStore } from '../store';
import * as E from '../../core/engine';
import { FINAL_RECIPE, INGREDIENTS, ING_BY_ID, RECIPES } from '../../data/world';
import { TEXTS } from '../../data/texts';
import type { IngredientId, RecipeDef } from '../../core/types';
import { bonusText } from '../labels';
import { fmt, fmtTime } from '../format';
import { burst } from '../fx';
import { Ic, Px } from '../Px';
import { Cta, Row, ScreenTitle, Section } from '../kit';

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
      setMsg(got ? `+${fmt(got)} эссенции` : 'Нечего перегонять');
      return;
    }
    if (slots.length >= 3 || (s.ingredients[id] ?? 0) - used(id) <= 0) return;
    setSlots([...slots, id]);
    setMsg(null);
  };
  const remove = (i: number) => setSlots(slots.filter((_, j) => j !== i));

  const doBrew = (ings: IngredientId[], x?: number, y?: number) => {
    const r = st.brew(ings);
    if (r.kind === 'failed') {
      setMsg(r.closest === 0 ? 'Пшик. Ни один ингредиент не подошёл' : `Мимо, но ${r.closest} из 3 подходят к неизвестному рецепту`);
    } else if (r.kind === 'locked') {
      setMsg(s.chapter < 8 ? 'Котёл не выдержит. Вернись в главе 8' : `Нужно ${fmt(E.BAL.finalCost)} золота в казне`);
      return;
    } else if (r.kind === 'missing') {
      setMsg('Не хватает ингредиентов');
      return;
    } else {
      setMsg(r.kind === 'brewed' ? `${TEXTS.recipes[r.recipe].name}: ${brewText(RECIPES.find((q) => q.id === r.recipe)!.brew)}` : null);
      if (x !== undefined && y !== undefined) burst(x, y, { n: 20, kind: 'bubble', colors: [RECIPES.find((q) => q.id === r.recipe)!.color, '#fff'], speed: 6 });
    }
    setSlots([]);
  };

  const known = RECIPES.filter((r) => s.recipesKnown.includes(r.id));
  const unknown = RECIPES.filter((r) => !s.recipesKnown.includes(r.id));

  return (
    <div>
      <ScreenTitle aside={<span class="num t2" style={{ fontSize: 17 }}>{known.length}/{RECIPES.length}</span>}>Рецепты</ScreenTitle>

      <div class="brew">
        <div class="slots">
          {[0, 1, 2].map((i) => {
            const id = slots[i];
            return (
              <button key={i} class={`slot ${id ? '' : 'vacant'}`} onClick={() => id && remove(i)} aria-label={id ? 'Убрать ингредиент' : 'Пустой слот'}>
                {id ? <Px id={id} scale={3} /> : null}
              </button>
            );
          })}
        </div>
        <div class="ing-grid">
          {INGREDIENTS.map((ing) => {
            const n = (s.ingredients[ing.id] ?? 0) - used(ing.id);
            return (
              <button key={ing.id} class={`ing ${n <= 0 ? 'none' : ''}`} onClick={() => add(ing.id)} aria-label={TEXTS.ingredients[ing.id].name}>
                <Px id={ing.id} scale={2} />
                <span class="cnt">{fmt(n)}</span>
              </button>
            );
          })}
        </div>
        {msg && <p class="msg">{msg}</p>}
        {distillMode ? (
          <button class="btn2 block" onClick={() => setDistillMode(false)}>
            Готово
          </button>
        ) : (
          <Cta off={slots.length !== 3} onClick={(e) => doBrew(slots, e.clientX, e.clientY)}>
            {slots.length === 3 ? 'Сварить зелье' : `Выбери ещё ${3 - slots.length}`}
          </Cta>
        )}
        {!distillMode && (
          <button
            class="btn2 block"
            style={{ marginTop: 10 }}
            onClick={() => {
              setDistillMode(true);
              setSlots([]);
              setMsg('Нажимай ингредиент — 10 штук станут эссенцией');
            }}
          >
            <Ic id="essence" /> Перегнать в эссенцию
          </button>
        )}
      </div>

      {known.length > 0 && (
        <Section title="Книга рецептов">
          <div class="stack">
            {known.map((r) => {
              const can = E.canBrewKnown(s, r.id);
              return (
                <Row
                  key={r.id}
                  icon={<Px id="flask" scale={2} tint={r.color} />}
                  name={TEXTS.recipes[r.id].name}
                  sub={
                    <>
                      <span class="plus">{bonusText(r.discovery.type, r.discovery.value, r.discovery.target)}</span>
                      <br />
                      {r.ingredients.map((i, k) => (
                        <Px key={k} id={i} scale={1} class="ic" />
                      ))}{' '}
                      {brewText(r.brew)}
                    </>
                  }
                  right={
                    <button class={`btn2 ${can ? '' : 'off'}`} onClick={(e) => can && doBrew([...r.ingredients], e.clientX, e.clientY)}>
                      Сварить
                    </button>
                  }
                />
              );
            })}
          </div>
        </Section>
      )}

      {unknown.length > 0 && (
        <Section
          title="Неизвестные"
          aside={`${unknown.length}`}
          help={() => st.toast({ icon: 'book', title: 'Как открыть рецепт', text: 'Смешай 3 ингредиента. Подсказка — в описании', kind: 'info' })}
        >
          <div class="stack">
            {unknown.map((r) => {
              const stars = Math.max(...r.ingredients.map((i) => RARITY_STARS[ING_BY_ID[i].rarity]));
              const isFinal = r.id === FINAL_RECIPE;
              return (
                <Row
                  key={r.id}
                  icon={isFinal ? <Px id="stone" scale={2} /> : <span class="px-font t3" style={{ fontSize: 22 }}>?</span>}
                  name={isFinal ? TEXTS.recipes[r.id].name : '???'}
                  count={
                    <span>
                      {Array.from({ length: 4 }).map((_, k) => (
                        <Ic key={k} id={k < stars ? 'star' : 'star_empty'} />
                      ))}
                    </span>
                  }
                  sub={isFinal ? `Глава 8 и ${fmt(E.BAL.finalCost)} золота` : TEXTS.recipes[r.id].desc}
                />
              );
            })}
          </div>
        </Section>
      )}
    </div>
  );
}

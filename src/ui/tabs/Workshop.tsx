import { useStore } from '../store';
import * as E from '../../core/engine';
import { GENERATORS } from '../../data/world';
import { MILESTONES } from '../../data/progression';
import { TEXTS } from '../../data/texts';
import { fmt } from '../format';
import { burst } from '../fx';
import { Ic, Px } from '../Px';
import { Bar, Glyph, ScreenTitle, Section } from '../kit';

function upgradeName(id: string, fallback: string): string {
  const m = /^(.+)_u(\d)$/.exec(id);
  if (m && m[1] in TEXTS.generators) return TEXTS.generators[m[1] as keyof typeof TEXTS.generators].upgrades[Number(m[2])];
  return fallback;
}

/** Короткое описание эффекта улучшения: число вперёд. */
function upgradeEffect(desc: string): string {
  return desc.replace('Доход постройки ×2', '×2 к постройке').replace('Сила тапа ×2', '×2 к тапу').replace('Весь доход +50%', '+50% к доходу').replace('Шанс крита +3%', '+3% к криту');
}

export function WorkshopTab() {
  const st = useStore();
  const s = st.s;
  const m = st.mods();
  const upgrades = E.availableUpgrades(s).slice(0, 12);

  // Открытые постройки + одна «загадочная» следующая
  const visible: typeof GENERATORS = [];
  for (const g of GENERATORS) {
    visible.push(g);
    if (s.generators[g.id] === 0 && s.runEarned < g.baseCost * 0.6 && s.allTimeEarned < g.baseCost * 2) break;
  }

  return (
    <div>
      <ScreenTitle>Мастерская</ScreenTitle>

      {upgrades.length > 0 && (
        <Section title="Улучшения" aside={`${upgrades.filter((u) => u.cost <= s.gold).length} по карману`}>
          <div class="hscroll">
            {upgrades.map((u) => {
              const can = u.cost <= s.gold;
              return (
                <button
                  key={u.id}
                  class={`upg ${can ? 'can' : ''}`}
                  onClick={(e) => {
                    if (st.buyUpgrade(u.id)) burst(e.clientX, e.clientY, { n: 12, kind: 'star' });
                  }}
                >
                  <span class="plate">
                    <Px id={u.icon} scale={2} />
                  </span>
                  <span class="un">{upgradeName(u.id, u.name)}</span>
                  <span class="ud">{upgradeEffect(u.desc)}</span>
                  <span class="uc">
                    <Ic id="coin" /> {fmt(u.cost)}
                  </span>
                </button>
              );
            })}
          </div>
        </Section>
      )}

      <Section title="Постройки">
        <div class="seg" style={{ marginBottom: 12 }}>
          {([1, 10, 100, 'max'] as const).map((a) => (
            <button
              key={a}
              class={st.buyAmount === a ? 'on' : ''}
              onClick={() => {
                st.buyAmount = a;
                st.bump();
              }}
            >
              {a === 'max' ? 'MAX' : `×${a}`}
            </button>
          ))}
        </div>
        <div class="stack">
          {visible.map((g, i) => {
            const owned = s.generators[g.id];
            const txt = TEXTS.generators[g.id];
            const mystery = owned === 0 && i === visible.length - 1 && s.runEarned < g.baseCost * 0.6 && s.allTimeEarned < g.baseCost * 2;
            const available = E.genAvailable(s, g.id);
            const amount = st.buyAmount === 'max' ? Math.max(1, E.maxAffordable(s, m, g.id)) : st.buyAmount;
            const cost = E.genCost(s, m, g.id, amount);
            const can = available && cost <= s.gold;
            const total = E.genProd(s, m, g.id);
            const nextMs = MILESTONES.find((x) => x > owned);
            const prevMs = [...MILESTONES].reverse().find((x) => x <= owned) ?? 0;
            if (mystery) {
              return (
                <div key={g.id} class="lrow locked">
                  <span class="plate">
                    <Glyph name="lock" cell={3} color="var(--text-3)" />
                  </span>
                  <div class="grow">
                    <div class="top">
                      <span class="name">Неизвестная постройка</span>
                    </div>
                    <div class="sub">
                      Откроется при <Ic id="coin" /> <span class="num">{fmt(g.baseCost * 0.6)}</span>
                    </div>
                  </div>
                </div>
              );
            }
            return (
              <div key={g.id} class={`lrow ${available ? '' : 'locked'}`}>
                <span class="plate">
                  <Px id={g.id} scale={2} />
                  {owned > 0 && <span class="lvl">{owned}</span>}
                </span>
                <div class="grow">
                  <div class="top">
                    <span class="name">{txt.name}</span>
                  </div>
                  <div class="sub">
                    {owned > 0 ? (
                      <>
                        <span class="num t2">{fmt(total, 1)}</span> в сек{nextMs ? ` · ×2 на ${nextMs}` : ''}
                      </>
                    ) : (
                      txt.desc
                    )}
                  </div>
                  {nextMs && owned > 0 && <Bar value={(owned - prevMs) / (nextMs - prevMs)} thin />}
                </div>
                <button
                  class={`price ${can ? 'can' : ''}`}
                  aria-label={`Купить ${txt.name}`}
                  onClick={(e) => {
                    if (st.buyGen(g.id)) burst(e.clientX, e.clientY, { n: 8, kind: 'coin' });
                  }}
                >
                  <Ic id="coin" />
                  {fmt(cost)}
                  {amount !== 1 && <span class="t3">×{amount}</span>}
                </button>
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

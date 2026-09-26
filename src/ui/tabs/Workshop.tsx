import { useStore } from '../store';
import * as E from '../../core/engine';
import { GENERATORS } from '../../data/world';
import { MILESTONES } from '../../data/progression';
import { TEXTS } from '../../data/texts';
import { fmt } from '../format';
import { burst } from '../fx';

function upgradeName(id: string, fallback: string): string {
  const m = /^(.+)_u(\d)$/.exec(id);
  if (m && m[1] in TEXTS.generators) return TEXTS.generators[m[1] as keyof typeof TEXTS.generators].upgrades[Number(m[2])];
  return fallback;
}

export function WorkshopTab() {
  const st = useStore();
  const s = st.s;
  const m = st.mods();
  const upgrades = E.availableUpgrades(s).slice(0, 12);

  // Показываем открытые постройки + одну «загадочную» следующую
  const visible: typeof GENERATORS = [];
  for (const g of GENERATORS) {
    visible.push(g);
    if (s.generators[g.id] === 0 && s.runEarned < g.baseCost * 0.6 && s.allTimeEarned < g.baseCost * 2) break;
  }

  return (
    <div>
      {upgrades.length > 0 && (
        <>
          <div class="section-title">
            <h2>Улучшения</h2>
            <small>{upgrades.filter((u) => u.cost <= s.gold).length} доступно</small>
          </div>
          <div class="upgrades">
            {upgrades.map((u) => {
              const can = u.cost <= s.gold;
              return (
                <button
                  key={u.id}
                  class={`upg ${can ? 'can' : ''}`}
                  onClick={(e) => {
                    if (st.buyUpgrade(u.id)) burst(e.clientX, e.clientY, { n: 18, kind: 'star' });
                  }}
                >
                  <span class="ue">{u.emoji}</span>
                  <span class="un">{upgradeName(u.id, u.name)}</span>
                  <span class="ud">{u.desc}</span>
                  <span class="uc num">🪙 {fmt(u.cost)}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      <div class="section-title">
        <h2>Мастерская</h2>
        <div class="seg" style={{ width: 190 }}>
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
          const prodEach = g.baseProd * m.gen[g.id] * m.prod;
          const total = E.genProd(s, m, g.id);
          const nextMs = MILESTONES.find((x) => x > owned);
          const prevMs = [...MILESTONES].reverse().find((x) => x <= owned) ?? 0;
          if (mystery) {
            return (
              <div key={g.id} class="gen locked">
                <div class="gen-icon">❔</div>
                <div class="grow">
                  <div class="gen-name">???</div>
                  <div class="gen-sub">Откроется, когда накопишь 🪙 {fmt(g.baseCost * 0.6)}</div>
                </div>
              </div>
            );
          }
          return (
            <div key={g.id} class={`gen ${can ? 'can' : ''} ${available ? '' : 'locked'}`}>
              <div class="gen-icon">
                {g.emoji}
                {owned > 0 && <span class="owned num">{owned}</span>}
              </div>
              <div class="grow">
                <div class="gen-name">{txt.name}</div>
                <div class="gen-sub">
                  {owned > 0 ? (
                    <>
                      <b class="num">{fmt(total, 1)}</b>/с · {fmt(prodEach, 1)} за шт.
                    </>
                  ) : (
                    txt.desc
                  )}
                </div>
                {nextMs && owned > 0 && (
                  <div class="bar violet" title={`До ×2: ${owned}/${nextMs}`}>
                    <i style={{ width: `${((owned - prevMs) / (nextMs - prevMs)) * 100}%` }} />
                  </div>
                )}
                {!available && <div class="gen-sub" style={{ color: 'var(--rose)' }}>Недоступно в испытании</div>}
              </div>
              <button
                class={`btn ${can ? '' : 'disabled'}`}
                onClick={(e) => {
                  if (st.buyGen(g.id)) burst(e.clientX, e.clientY, { n: 10, kind: 'coin' });
                }}
              >
                <span class="cost num">🪙 {fmt(cost)}</span>
                <small>
                  +{amount} {nextMs && owned > 0 ? `· ×2 на ${nextMs}` : ''}
                </small>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

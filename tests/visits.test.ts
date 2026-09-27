import { describe, expect, it } from 'vitest';
import { migrate, newGame } from '../src/core/state';
import * as E from '../src/core/engine';
import { HEROES } from '../src/data/heroes';
import { HERO_VISITS } from '../src/data/visits';

const T0 = new Date(2026, 8, 28, 12, 0, 0).getTime();
const rng = () => 0.4;

function withHero(id: string, chapter = 3) {
  const s = newGame(T0);
  s.chapter = chapter;
  s.heroes[id] = { recruited: true, level: 1, shards: 0 };
  return s;
}

describe('визиты героев', () => {
  it('гость приходит по таймеру только с главы гильдии и при нанятом герое', () => {
    const s = newGame(T0);
    s.nextVisitAt = T0;
    E.tick(s, T0 + 1000, rng);
    expect(s.visit).toBeNull();

    const g = withHero('pudding');
    g.nextVisitAt = T0;
    const ev = E.tick(g, T0 + 1000, rng);
    expect(ev.visitArrived).toBe('pudding');
    expect(g.visit?.hero).toBe('pudding');
  });

  it('незамеченный гость уходит, начатый разговор его удерживает', () => {
    const s = withHero('pudding');
    s.nextVisitAt = T0;
    E.tick(s, T0 + 1000, rng);
    const leave = s.visit!.leaves;
    const ev = E.tick(s, leave + 1, rng);
    expect(ev.visitLeft).toBe('pudding');
    expect(s.visit).toBeNull();
    expect(s.nextVisitAt).toBeGreaterThan(leave + E.BAL.visitMinSec * 1000 - 1);

    const t = withHero('pudding');
    t.nextVisitAt = T0;
    E.tick(t, T0 + 1000, rng);
    t.visit!.talked = true;
    E.tick(t, t.visit!.leaves + 5000, rng);
    expect(t.visit?.hero).toBe('pudding');
  });

  it('герой в экспедиции в лавку не заходит', () => {
    const s = withHero('pudding');
    s.expeditions.push({ uid: 1, location: 'whispering_woods', duration: 'short', heroes: ['pudding'], start: T0, end: T0 + 3600e3, success: true } as never);
    expect(E.pickVisitor(s, rng)).toBeNull();
  });

  it('сделка по роли: воин даёт бафф тапов, торговец меняет золото на эссенцию', () => {
    const s = withHero('pudding');
    s.visit = { hero: 'pudding', kind: 'tap', arrived: T0, leaves: T0 + 1e5 };
    const m = E.computeMods(s, T0);
    const r = E.acceptVisit(s, m, T0, rng)!;
    expect(r.offer.buff?.kind).toBe('tapBoost');
    expect(s.buffs.tapBoost!.until).toBe(T0 + 60_000);
    expect(s.visit).toBeNull();

    const t = withHero('hadji_murr');
    t.visit = { hero: 'hadji_murr', kind: 'trade', arrived: T0, leaves: T0 + 1e5 };
    const tm = E.computeMods(t, T0);
    const offer = E.visitOffer(t, tm, t.visit);
    expect(E.acceptVisit(t, tm, T0, rng)).toBeNull(); // не хватает золота
    t.gold = offer.cost.gold!;
    const essence = t.essence;
    expect(E.acceptVisit(t, tm, T0, rng)).not.toBeNull();
    expect(t.gold).toBe(0);
    expect(t.essence).toBe(essence + offer.essence!);
  });

  it('мудрец тренируется за половину цены уровня', () => {
    const s = withHero('snezhana');
    s.visit = { hero: 'snezhana', kind: 'train', arrived: T0, leaves: T0 + 1e5 };
    const m = E.computeMods(s, T0);
    const full = E.heroLevelCost(s, m, E.HERO_BY_ID.snezhana);
    const o = E.visitOffer(s, m, s.visit);
    expect(o.cost.essence).toBe(Math.ceil(full * 0.5));
    s.essence = o.cost.essence!;
    E.acceptVisit(s, m, T0, rng);
    expect(s.heroes.snezhana.level).toBe(2);
    expect(s.essence).toBe(0);
  });

  it('ускорение срезает половину оставшегося времени экспедиций', () => {
    const s = withHero('pudding');
    s.expeditions.push({ uid: 1, location: 'whispering_woods', duration: 'long', heroes: ['trusvind'], start: T0, end: T0 + 4000e3, success: true } as never);
    s.visit = { hero: 'pudding', kind: 'haste', arrived: T0, leaves: T0 + 1e5 };
    E.acceptVisit(s, E.computeMods(s, T0), T0, rng);
    expect(s.expeditions[0].end).toBe(T0 + 2000e3);
  });

  it('отказ отпускает гостя и планирует следующего', () => {
    const s = withHero('pudding');
    s.visit = { hero: 'pudding', kind: 'tap', arrived: T0, leaves: T0 + 1e5 };
    E.declineVisit(s, T0, rng);
    expect(s.visit).toBeNull();
    expect(s.buffs.tapBoost).toBeUndefined();
    expect(s.nextVisitAt).toBeGreaterThan(T0);
  });

  it('старый сейв получает поля визитов', () => {
    const old = newGame(T0) as unknown as Record<string, unknown>;
    delete old.visit;
    delete old.nextVisitAt;
    delete old.heroTalks;
    const s = migrate(old, T0);
    expect(s.visit).toBeNull();
    expect(s.heroTalks).toEqual({});
    expect(s.nextVisitAt).toBeGreaterThan(T0);
  });

  it('у каждого героя есть тексты визита', () => {
    for (const h of HEROES) {
      const v = HERO_VISITS[h.id];
      expect(v, h.id).toBeTruthy();
      expect(v.arc).toHaveLength(3);
      for (const talk of v.arc) {
        expect(talk.length).toBeGreaterThanOrEqual(3);
        for (const l of talk) expect(['cat', 'player', 'narrator', h.id]).toContain(l.speaker);
      }
      expect(v.greet.length).toBeGreaterThan(0);
      expect(v.offer && v.accept && v.decline).toBeTruthy();
    }
  });
});

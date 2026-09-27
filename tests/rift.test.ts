import { describe, expect, it } from 'vitest';
import { migrate, newGame } from '../src/core/state';
import * as E from '../src/core/engine';
import { CHALLENGE_BY_ID, challengeGoal } from '../src/data/progression';

const T0 = new Date(2026, 8, 28, 12, 0, 0).getTime();
const rng = () => 0.5;

/** Основной мир «в разгаре»: есть золото, постройки, улучшения, трансмутация пройдена. */
function midGame() {
  const s = newGame(T0);
  s.chapter = 5;
  s.transmutations = 1;
  s.gold = 5e9;
  s.runEarned = 2e10;
  s.allTimeEarned = 3e11;
  s.generators.mortar = 120;
  s.generators.apprentice = 60;
  s.upgrades = ['mortar_1'];
  s.lastTick = T0;
  return s;
}

describe('Изнанка: испытания в отдельном измерении', () => {
  it('вход сохраняет основной мир и начинает испытание с нуля', () => {
    const s = midGame();
    expect(E.startChallenge(s, 'c_notap', T0)).toBe(true);
    expect(s.challenge).toBe('c_notap');
    expect(s.gold).toBe(0);
    expect(s.generators.mortar).toBe(0);
    expect(s.upgrades).toEqual([]);
    expect(s.mainRun?.gold).toBe(5e9);
    expect(s.mainRun?.generators.mortar).toBe(120);
    expect(s.transmutations).toBe(1); // вход — не трансмутация
    expect(s.stonesEarned).toBe(0);
  });

  it('выход возвращает основной мир с доходом за время отсутствия и сохраняет прогресс испытания', () => {
    const s = midGame();
    const gpsHome = E.baseGps(s, E.computeMods(s, T0));
    E.startChallenge(s, 'c_notap', T0);
    s.generators.mortar = 7;
    s.gold = 1234;
    s.runEarned = 5000;
    const rep = E.leaveChallenge(s, T0 + 3600e3, true)!;
    expect(s.challenge).toBeNull();
    expect(s.mainRun).toBeNull();
    expect(s.generators.mortar).toBe(120);
    expect(s.upgrades).toEqual(['mortar_1']);
    expect(rep.seconds).toBe(3600);
    expect(rep.gold).toBeCloseTo(gpsHome * 3600 * E.computeMods(s, T0).offlineRate, -2);
    expect(s.gold).toBeCloseTo(5e9 + rep.gold, -2);
    expect(s.challengeRuns.c_notap.generators.mortar).toBe(7);

    // Возвращаемся в испытание — оно продолжается с того же места
    E.startChallenge(s, 'c_notap', T0 + 7200e3);
    expect(s.gold).toBe(1234);
    expect(s.generators.mortar).toBe(7);
    expect(s.challengeRuns.c_notap).toBeUndefined();
  });

  it('золото Изнанки не влияет на камни и главы основного мира', () => {
    const s = midGame();
    E.startChallenge(s, 'c_notap', T0);
    const all = s.allTimeEarned;
    E.earn(s, 1e20);
    expect(s.allTimeEarned).toBe(all);
    expect(E.checkChapter(s)).toBeUndefined();
    expect(s.chapter).toBe(5);
    expect(E.canTransmute(s)).toBe(false);
  });

  it('пройденное испытание даёт награду и само возвращает домой', () => {
    const s = midGame();
    E.startChallenge(s, 'c_expensive', T0);
    s.runEarned = challengeGoal(CHALLENGE_BY_ID.c_expensive, 0);
    s.lastTick = T0 + 1000;
    const ev = E.tick(s, T0 + 2000, rng);
    expect(ev.challengeDone).toBe('c_expensive');
    expect(s.challengeDone.c_expensive).toBe(1);
    expect(s.challenge).toBeNull();
    expect(s.generators.mortar).toBe(120);
    expect(s.challengeRuns.c_expensive).toBeUndefined();
  });

  it('в одно испытание за раз; сброс сохранённого прогресса', () => {
    const s = midGame();
    E.startChallenge(s, 'c_notap', T0);
    expect(E.startChallenge(s, 'c_weak', T0)).toBe(false);
    E.leaveChallenge(s, T0 + 1000);
    expect(s.challengeRuns.c_notap).toBeTruthy();
    E.resetChallengeProgress(s, 'c_notap');
    expect(s.challengeRuns.c_notap).toBeUndefined();
  });

  it('старый сейв посреди испытания (без основного мира) выходит без потерь', () => {
    const old = midGame() as unknown as Record<string, unknown>;
    old.challenge = 'c_notap';
    delete old.mainRun;
    delete old.challengeRuns;
    const s = migrate(old, T0);
    expect(s.challengeRuns).toEqual({});
    const gens = s.generators.mortar;
    expect(E.leaveChallenge(s, T0 + 1000)).toBeNull();
    expect(s.challenge).toBeNull();
    expect(s.generators.mortar).toBe(gens);
  });
});

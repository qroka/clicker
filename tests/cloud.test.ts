import { describe, expect, it } from 'vitest';
import { resolveSave } from '../src/cloud/resolve';

describe('выбор между локальным и облачным сейвом', () => {
  const T = 1_800_000_000_000;
  it('облака нет — отправляем локальный', () => {
    expect(resolveSave({ progress: 500, updatedAt: T }, null)).toBe('push-local');
  });
  it('новое устройство (локально почти пусто) — тихо загружаем облако', () => {
    expect(resolveSave({ progress: 10, updatedAt: T }, { progress: 1e9, updatedAt: T - 1000 })).toBe('pull-cloud');
  });
  it('в облаке заметно больше прогресса — спрашиваем игрока', () => {
    expect(resolveSave({ progress: 1e6, updatedAt: T }, { progress: 1e9, updatedAt: T - 1000 })).toBe('ask');
  });
  it('локально больше прогресса — отправляем локальный', () => {
    expect(resolveSave({ progress: 1e9, updatedAt: T - 5000 }, { progress: 1e6, updatedAt: T })).toBe('push-local');
  });
  it('прогресс почти равен — берём более свежий', () => {
    expect(resolveSave({ progress: 1000_000, updatedAt: T }, { progress: 1000_500, updatedAt: T + 60_000 })).toBe('pull-cloud');
    expect(resolveSave({ progress: 1000_500, updatedAt: T + 60_000 }, { progress: 1000_000, updatedAt: T })).toBe('push-local');
  });
});

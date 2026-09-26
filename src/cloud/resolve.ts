// Выбор между локальным и облачным сохранением (чистая функция — покрыта тестами).

export interface CloudSave {
  progress: number; // золото за всё время
  updatedAt: number; // мс
}

export type Resolution = 'push-local' | 'pull-cloud' | 'ask';

/**
 * - облака нет → отправляем локальный;
 * - прогресс почти равен (±1%) → берём более свежий;
 * - облако заметно дальше и локальный почти пустой (новое устройство) → тихо загружаем облако;
 * - иначе, если в облаке больше прогресса → спрашиваем игрока;
 * - если локально больше → отправляем локальный.
 */
export function resolveSave(local: { progress: number; updatedAt: number }, cloud: CloudSave | null): Resolution {
  if (!cloud) return 'push-local';
  const hi = Math.max(local.progress, cloud.progress, 1);
  const close = Math.abs(local.progress - cloud.progress) / hi <= 0.01;
  if (close) return cloud.updatedAt > local.updatedAt ? 'pull-cloud' : 'push-local';
  if (cloud.progress > local.progress) return local.progress < 1000 ? 'pull-cloud' : 'ask';
  return 'push-local';
}

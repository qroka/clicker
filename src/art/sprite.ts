import { PALETTE } from './palette';

/** Пиксельный спрайт: строки одинаковой длины w, символы — ключи палитры, '.' — прозрачность. */
export interface SpriteDef {
  w: number;
  h: number;
  /** Дополнительные/переопределённые цвета (по возможности не нужны). */
  pal?: Record<string, string>;
  px: string[];
}

export type SpriteSet = Record<string, SpriteDef>;

/** RGBA-пиксели спрайта (используется и в браузере, и в node-скрипте превью). */
export function spritePixels(def: SpriteDef): Uint8ClampedArray {
  const out = new Uint8ClampedArray(def.w * def.h * 4);
  const pal = { ...PALETTE, ...(def.pal ?? {}) };
  for (let y = 0; y < def.h; y++) {
    const row = def.px[y] ?? '';
    for (let x = 0; x < def.w; x++) {
      const ch = row[x] ?? '.';
      if (ch === '.' || ch === ' ') continue;
      const hex = pal[ch];
      if (!hex) continue;
      const i = (y * def.w + x) * 4;
      out[i] = parseInt(hex.slice(1, 3), 16);
      out[i + 1] = parseInt(hex.slice(3, 5), 16);
      out[i + 2] = parseInt(hex.slice(5, 7), 16);
      out[i + 3] = 255;
    }
  }
  return out;
}

/** Проверка спрайта: возвращает список проблем (пустой — всё хорошо). */
export function validateSprite(id: string, def: SpriteDef): string[] {
  const errs: string[] = [];
  const pal = { ...PALETTE, ...(def.pal ?? {}) };
  if (def.px.length !== def.h) errs.push(`${id}: строк ${def.px.length}, ожидалось h=${def.h}`);
  def.px.forEach((row, y) => {
    if (row.length !== def.w) errs.push(`${id}: строка ${y} длиной ${row.length}, ожидалось w=${def.w}`);
    for (const ch of row) if (ch !== '.' && !pal[ch]) errs.push(`${id}: неизвестный цвет '${ch}' в строке ${y}`);
  });
  return errs;
}

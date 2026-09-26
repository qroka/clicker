import { SPRITES } from '../art';
import { spritePixels } from '../art/sprite';

const cache = new Map<string, string>();

function lighten(hex: string, k = 0.55): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.round(v + (255 - v) * k);
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => ch(v).toString(16).padStart(2, '0')).join('')}`;
}

/** data:URL спрайта (с кэшем). tint перекрашивает жидкость L/l (зелья, котёл). */
export function spriteUrl(id: string, tint?: string): string | null {
  const key = tint ? `${id}|${tint}` : id;
  const hit = cache.get(key);
  if (hit) return hit;
  const def = SPRITES[id];
  if (!def) return null;
  // У котла руна (c) светится цветом зелья главы
  const extra: Record<string, string> = tint && id === 'cauldron' ? { c: lighten(tint, 0.25) } : {};
  const d = tint ? { ...def, pal: { ...(def.pal ?? {}), L: tint, l: lighten(tint), ...extra } } : def;
  const canvas = document.createElement('canvas');
  canvas.width = def.w;
  canvas.height = def.h;
  const g = canvas.getContext('2d')!;
  g.putImageData(new ImageData(spritePixels(d) as Uint8ClampedArray<ArrayBuffer>, def.w, def.h), 0, 0);
  const url = canvas.toDataURL('image/png');
  cache.set(key, url);
  return url;
}

interface Props {
  id: string;
  /** Целочисленный масштаб: 1 пиксель спрайта = scale CSS-пикселей. */
  scale?: number;
  tint?: string;
  class?: string;
  title?: string;
}

/** Пиксельный спрайт. Всегда целый масштаб — чтобы пиксели были ровными на Retina. */
export function Px({ id, scale = 1, tint, class: cls, title }: Props) {
  const def = SPRITES[id];
  const url = def ? spriteUrl(id, tint) : null;
  if (!def || !url) {
    return (
      <span class={`px px-missing ${cls ?? ''}`} style={{ width: 16 * scale, height: 16 * scale }} title={id}>
        ?
      </span>
    );
  }
  return <img class={`px ${cls ?? ''}`} src={url} width={def.w * scale} height={def.h * scale} alt="" title={title} draggable={false} />;
}

/** Иконка 16×16, выровненная по строке текста. */
export function Ic({ id, scale = 1, tint }: { id: string; scale?: number; tint?: string }) {
  return <Px id={id} scale={scale} tint={tint} class="ic" />;
}

// Пиксельные иконки приложения: котёл с золотым зельем на тёплом фоне (палитра docs/ui-rules.md).
// npm run icons
import { writeFileSync } from 'node:fs';
import { spritePixels, type SpriteDef } from '../src/art/sprite';
import { SPRITES } from '../src/art';
import { encodePng } from './png';

const BG = '#1c1612'; // --bg-1
const DISC = '#241d17'; // --bg-2
const DISC_EDGE = '#2b231c'; // --bg-3
const GOLD = '#f2b84b'; // --gold
const CREAM = '#f3e9da'; // --text

const hex = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** Рисуем в логической пиксельной сетке G×G, затем увеличиваем целым масштабом. */
function icon(size: number, file: string) {
  const u = Math.max(1, Math.floor(size / 76)); // размер «пикселя» иконки
  const G = Math.floor(size / u);
  const grid: ([number, number, number] | null)[] = new Array(G * G).fill(null);
  const put = (x: number, y: number, c: string) => {
    if (x >= 0 && y >= 0 && x < G && y < G) grid[y * G + x] = hex(c);
  };

  // Фон и диск за котлом (пиксельная окружность)
  for (let i = 0; i < G * G; i++) grid[i] = hex(BG);
  const cx = G / 2 - 0.5;
  const cy = G / 2 + 1.5;
  const R = G * 0.43;
  for (let y = 0; y < G; y++)
    for (let x = 0; x < G; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d <= R) put(x, y, d > R - 1.5 ? DISC_EDGE : DISC);
    }

  // Искорки
  const spark = (x: number, y: number, c: string, big = false) => {
    put(x, y, c);
    if (big) {
      put(x - 1, y, c);
      put(x + 1, y, c);
      put(x, y - 1, c);
      put(x, y + 1, c);
    }
  };
  spark(Math.round(G * 0.2), Math.round(G * 0.2), GOLD, true);
  spark(Math.round(G * 0.8), Math.round(G * 0.16), CREAM, true);
  spark(Math.round(G * 0.86), Math.round(G * 0.34), GOLD);
  spark(Math.round(G * 0.13), Math.round(G * 0.4), CREAM);
  spark(Math.round(G * 0.68), Math.round(G * 0.08), GOLD);

  const blit = (def: SpriteDef, ox: number, oy: number, pal?: Record<string, string>) => {
    const px = spritePixels(pal ? { ...def, pal: { ...(def.pal ?? {}), ...pal } } : def);
    for (let y = 0; y < def.h; y++)
      for (let x = 0; x < def.w; x++) {
        const i = (y * def.w + x) * 4;
        if (px[i + 3]) grid[(oy + y) * G + ox + x] = [px[i], px[i + 1], px[i + 2]];
      }
  };
  const pot = SPRITES.cauldron;
  const fire = SPRITES.fire1;
  const totalH = pot.h + fire.h - 1;
  const oy = Math.floor((G - totalH) / 2) + 2;
  blit(pot, Math.floor((G - pot.w) / 2), oy, { L: GOLD, l: '#ffe6a8', c: '#ffd27a' });
  blit(fire, Math.floor((G - fire.w) / 2), oy + pot.h - 1);

  // Увеличение целым масштабом, по краям — цвет фона
  const img = new Uint8Array(size * size * 4);
  const off = Math.floor((size - G * u) / 2);
  const [br, bg, bb] = hex(BG);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const gx = Math.floor((x - off) / u);
      const gy = Math.floor((y - off) / u);
      const c = gx >= 0 && gy >= 0 && gx < G && gy < G ? grid[gy * G + gx]! : [br, bg, bb];
      img.set([c[0], c[1], c[2], 255], (y * size + x) * 4);
    }
  writeFileSync(file, encodePng(size, size, img));
}

icon(180, 'public/icons/apple-touch-icon.png');
icon(192, 'public/icons/icon-192.png');
icon(512, 'public/icons/icon-512.png');
console.log('icons ok');

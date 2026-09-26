// Пиксельные иконки приложения из спрайтов котла и огня: npm run icons
import { writeFileSync } from 'node:fs';
import { spritePixels, type SpriteDef } from '../src/art/sprite';
import { SPRITES } from '../src/art';
import { encodePng } from './png';

function icon(size: number, file: string) {
  const img = new Uint8Array(size * size * 4);
  const bands = ['#120d1f', '#181229', '#1e1632', '#241a3b', '#2b1f47'];
  const hex = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  for (let y = 0; y < size; y++) {
    const [r, g, b] = hex(bands[Math.min(bands.length - 1, Math.floor((y / size) * bands.length))]);
    for (let x = 0; x < size; x++) img.set([r, g, b, 255], (y * size + x) * 4);
  }
  const unit = Math.max(1, Math.floor(size / 64));
  const stars = [
    [8, 8],
    [52, 6],
    [58, 18],
    [6, 24],
    [40, 4],
    [20, 14],
  ];
  for (const [sx, sy] of stars)
    for (let dy = 0; dy < unit; dy++) for (let dx = 0; dx < unit; dx++) img.set([255, 255, 255, 255], ((sy * unit + dy) * size + sx * unit + dx) * 4);

  const blit = (def: SpriteDef, scale: number, ox: number, oy: number, tint?: Record<string, string>) => {
    const px = spritePixels(tint ? { ...def, pal: { ...(def.pal ?? {}), ...tint } } : def);
    for (let y = 0; y < def.h; y++)
      for (let x = 0; x < def.w; x++) {
        const i = (y * def.w + x) * 4;
        if (!px[i + 3]) continue;
        for (let dy = 0; dy < scale; dy++)
          for (let dx = 0; dx < scale; dx++) {
            const X = ox + x * scale + dx;
            const Y = oy + y * scale + dy;
            if (X < 0 || Y < 0 || X >= size || Y >= size) continue;
            img.set([px[i], px[i + 1], px[i + 2], 255], (Y * size + X) * 4);
          }
      }
  };
  const pot = SPRITES.cauldron;
  const fire = SPRITES.fire1;
  const scale = Math.max(1, Math.floor((size * 0.78) / pot.w));
  const totalH = pot.h * scale + (fire ? fire.h * scale : 0);
  const oy = Math.floor((size - totalH) / 2) + Math.floor(size * 0.04);
  blit(pot, scale, Math.floor((size - pot.w * scale) / 2), oy, { L: '#2ce8f5', l: '#b3ffe9' });
  if (fire) blit(fire, scale, Math.floor((size - fire.w * scale) / 2), oy + pot.h * scale - scale);
  writeFileSync(file, encodePng(size, size, img));
}

icon(180, 'public/icons/apple-touch-icon.png');
icon(192, 'public/icons/icon-192.png');
icon(512, 'public/icons/icon-512.png');
console.log('icons ok');

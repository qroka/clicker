// Рисует PNG-лист спрайтов для визуальной проверки (без браузера).
// npx tsx scripts/sprite-sheet.ts <portraits|world|ui|all> <out.png> [scale]
import { writeFileSync } from 'node:fs';
import { encodePng } from './png';
import { spritePixels, validateSprite, type SpriteDef } from '../src/art/sprite';
import { PORTRAITS_ART } from '../src/art/portraits';
import { WORLD_ART } from '../src/art/world';
import { UI_ART } from '../src/art/ui';

const [which = 'all', out = 'sheet.png', scaleArg = '6'] = process.argv.slice(2);
const sets: Record<string, Record<string, SpriteDef>> = { portraits: PORTRAITS_ART, world: WORLD_ART, ui: UI_ART };
const set = which === 'all' ? { ...UI_ART, ...WORLD_ART, ...PORTRAITS_ART } : sets[which];
const scale = Number(scaleArg);
const ids = Object.keys(set);
const errs = ids.flatMap((id) => validateSprite(id, set[id]));
if (errs.length) console.log('ОШИБКИ:\n' + errs.join('\n'));

const cell = Math.max(...ids.map((id) => Math.max(set[id].w, set[id].h)), 16) * scale + 12;
const cols = Math.min(8, ids.length || 1);
const rows = Math.ceil(ids.length / cols) || 1;
const W = cols * cell;
const H = rows * cell;
const img = new Uint8Array(W * H * 4);
// Фон: тёмно-фиолетовый в шашечку, как в игре
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    const alt = ((Math.floor(x / cell) + Math.floor(y / cell)) % 2) === 0;
    img[i] = alt ? 0x1c : 0x28;
    img[i + 1] = alt ? 0x12 : 0x1a;
    img[i + 2] = alt ? 0x30 : 0x42;
    img[i + 3] = 255;
  }
ids.forEach((id, n) => {
  const d = set[id];
  const px = spritePixels(d);
  const ox = (n % cols) * cell + 6;
  const oy = Math.floor(n / cols) * cell + 6;
  for (let y = 0; y < d.h; y++)
    for (let x = 0; x < d.w; x++) {
      const si = (y * d.w + x) * 4;
      if (!px[si + 3]) continue;
      for (let dy = 0; dy < scale; dy++)
        for (let dx = 0; dx < scale; dx++) {
          const i = ((oy + y * scale + dy) * W + ox + x * scale + dx) * 4;
          img[i] = px[si];
          img[i + 1] = px[si + 1];
          img[i + 2] = px[si + 2];
        }
    }
});

writeFileSync(out, encodePng(W, H, img));
console.log(`${ids.length} спрайтов → ${out} (${cols} в ряд, слева направо):`);
console.log(ids.map((id, i) => `${i + 1}.${id}`).join('  '));

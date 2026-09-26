/** Палитры по главам: цвет зелья и свечения фона. */
export const PALETTES: [string, string][] = [
  ['#2ce8f5', '#7b5cff'],
  ['#63c74d', '#124e89'],
  ['#feae34', '#e43b44'],
  ['#f6757a', '#68386c'],
  ['#0099db', '#b55088'],
  ['#3e8948', '#f77622'],
  ['#b55088', '#262b44'],
  ['#fee761', '#ff0044'],
];

export const chapterPalette = (chapter: number) => PALETTES[Math.max(0, Math.min(PALETTES.length, chapter) - 1)];

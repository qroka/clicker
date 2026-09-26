let notation: 'short' | 'sci' = 'short';
export const setNotation = (n: 'short' | 'sci') => (notation = n);

const SUFFIX = ['', 'K', 'M', 'B', 'T'];

function suffix(i: number): string {
  if (i < SUFFIX.length) return SUFFIX[i];
  const k = i - SUFFIX.length; // aa, ab, … az, ba …
  return String.fromCharCode(97 + Math.floor(k / 26)) + String.fromCharCode(97 + (k % 26));
}

export function fmt(n: number, decimalsSmall = 0): string {
  if (!isFinite(n)) return '∞';
  if (n < 0) return '-' + fmt(-n, decimalsSmall);
  if (n < 1000) {
    if (decimalsSmall && n < 100 && n % 1 !== 0) return n.toFixed(decimalsSmall).replace('.', ',');
    return Math.floor(n).toString();
  }
  if (notation === 'sci') return n.toExponential(2).replace('+', '').replace('.', ',');
  const i = Math.floor(Math.log10(n) / 3);
  const v = n / Math.pow(1000, i);
  const s = v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
  return s.replace('.', ',') + suffix(i);
}

export function fmtTime(sec: number): string {
  sec = Math.max(0, Math.ceil(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h) return `${h} ч ${m ? m + ' мин' : ''}`.trim();
  if (m) return `${m} мин${s && m < 10 ? ' ' + s + ' с' : ''}`;
  return `${s} с`;
}

export function pct(v: number, digits = 0): string {
  return `${(v * 100).toFixed(digits).replace('.', ',')}%`;
}

export function plural(n: number, one: string, few: string, many: string): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

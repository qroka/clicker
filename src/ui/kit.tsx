// Базовые компоненты интерфейса по UI-правилам (docs/ui-rules.md).
import type { ComponentChildren } from 'preact';
import { Px } from './Px';

// ─── Пиксельные системные глифы (SVG по пиксельной сетке, crispEdges) ────────

const GLYPHS: Record<string, string[]> = {
  cross: ['X.....X', '.X...X.', '..X.X..', '...X...', '..X.X..', '.X...X.', 'X.....X'],
  check: ['......X', '.....XX', 'X...XX.', 'XX.XX..', '.XXX...', '..X....'],
  flame: ['...X...', '..XX...', '..XXX..', '.XXXX.X', '.XXXXXX', 'XXXXXXX', 'XXX.XXX', '.XX.XX.', '..XXX..'],
  plus: ['...X...', '...X...', '...X...', 'XXXXXXX', '...X...', '...X...', '...X...'],
  lock: ['..XXX..', '.X...X.', '.X...X.', 'XXXXXXX', 'XXX.XXX', 'XXX.XXX', 'XXXXXXX'],
};

/** Пиксельный глиф цвета currentColor. size — CSS-размер клетки (px). */
export function Glyph({ name, cell = 2.5, color }: { name: keyof typeof GLYPHS; cell?: number; color?: string }) {
  const rows = GLYPHS[name];
  const w = Math.max(...rows.map((r) => r.length));
  const h = rows.length;
  const rects: preact.JSX.Element[] = [];
  rows.forEach((r, y) => {
    for (let x = 0; x < r.length; x++) if (r[x] === 'X') rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} />);
  });
  return (
    <svg class="glyph" width={w * cell} height={h * cell} viewBox={`0 0 ${w} ${h}`} fill={color ?? 'currentColor'} aria-hidden="true">
      {rects}
    </svg>
  );
}

// ─── Структура экрана ────────────────────────────────────────────────────────

export function ScreenTitle({ children, aside }: { children: ComponentChildren; aside?: ComponentChildren }) {
  return (
    <div class="row" style={{ alignItems: 'center', marginBottom: 20, marginTop: 6 }}>
      <h1 class="screen-title grow" style={{ margin: 0 }}>
        {children}
      </h1>
      {aside}
    </div>
  );
}

export function Section({ title, aside, help, children }: { title?: ComponentChildren; aside?: ComponentChildren; help?: () => void; children: ComponentChildren }) {
  return (
    <section class="section">
      {title && (
        <div class="section-head">
          <h2>{title}</h2>
          {aside && <span class="aside">{aside}</span>}
          {help && (
            <button class="help" onClick={help} aria-label="Подробнее">
              ?
            </button>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

// ─── Элементы ────────────────────────────────────────────────────────────────

export function Bar({ value, full, thin }: { value: number; full?: boolean; thin?: boolean }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div class={`bar ${full || v >= 1 ? 'full' : ''} ${thin ? 'thin' : ''}`}>
      <i style={{ width: `${v * 100}%` }} />
    </div>
  );
}

export type RowState = 'todo' | 'done' | 'claim' | 'none';

export function StateBox({ state }: { state: RowState }) {
  if (state === 'none') return null;
  return <span class={`state ${state}`}>{state === 'todo' ? null : <Glyph name="check" cell={2.5} />}</span>;
}

/** Строка списка: подложка с иконкой, название + счётчик, опционально полоса и правый слот. */
export function Row(props: {
  icon?: ComponentChildren;
  name: ComponentChildren;
  count?: ComponentChildren;
  sub?: ComponentChildren;
  progress?: { value: number; full?: boolean };
  right?: ComponentChildren;
  claim?: boolean;
  locked?: boolean;
  onClick?: () => void;
}) {
  const cls = `lrow ${props.claim ? 'claim' : ''} ${props.locked ? 'locked' : ''}`;
  const body = (
    <>
      {props.icon && <span class="plate">{props.icon}</span>}
      <div class="grow">
        <div class="top">
          <span class="name">{props.name}</span>
          {props.count !== undefined && <span class="count">{props.count}</span>}
        </div>
        {props.sub && <div class="sub">{props.sub}</div>}
        {props.progress && <Bar value={props.progress.value} full={props.progress.full} />}
      </div>
      {props.right}
    </>
  );
  return props.onClick ? (
    <button class={cls} onClick={props.onClick}>
      {body}
    </button>
  ) : (
    <div class={cls}>{body}</div>
  );
}

/** Иконка-спрайт в подложке (для строк списков). */
export function PlateIcon({ id, tint, scale = 2 }: { id: string; tint?: string; scale?: number }) {
  return <Px id={id} scale={scale} tint={tint} />;
}

/** Главная «физическая» кнопка. Одна на экран. */
export function Cta({ children, off, onClick }: { children: ComponentChildren; off?: boolean; onClick?: (e: MouseEvent) => void }) {
  return (
    <button class={`cta ${off ? 'off' : ''}`} onClick={(e) => !off && onClick?.(e as unknown as MouseEvent)} aria-disabled={off}>
      {children}
    </button>
  );
}

export function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button class="close" onClick={onClick} aria-label="Закрыть">
      <Glyph name="cross" cell={2.6} />
    </button>
  );
}

export function Segments({ total, filled }: { total: number; filled: number }) {
  return (
    <span class="segs">
      {Array.from({ length: total }).map((_, i) => (
        <i key={i} class={i < filled ? 'on' : ''} />
      ))}
    </span>
  );
}

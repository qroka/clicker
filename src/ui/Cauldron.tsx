import { useEffect, useRef, useState } from 'preact/hooks';
import { Px } from './Px';
import { SPRITES } from '../art';

interface Props {
  heat: number; // 0..100
  boiling: boolean;
  potion: string; // цвет зелья главы
  onTap: (x: number, y: number) => void;
}

const SEGMENTS = 24;

/** Дуга сегмента кольца (углы в градусах, 0 — сверху, по часовой). */
function arc(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const p = (a: number) => {
    const rad = ((a - 90) * Math.PI) / 180;
    return `${(cx + r * Math.cos(rad)).toFixed(2)} ${(cy + r * Math.sin(rad)).toFixed(2)}`;
  };
  return `M ${p(a0)} A ${r} ${r} 0 0 1 ${p(a1)}`;
}

/** Кольцо нагрева: 24 сегмента вокруг котла, загораются золотом по мере нагрева. */
function HeatRing({ size, heat, boiling }: { size: number; heat: number; boiling: boolean }) {
  const lit = boiling ? SEGMENTS : Math.round((heat / 100) * SEGMENTS);
  const c = size / 2;
  const stroke = Math.max(6, Math.round(size / 40));
  const r = c - stroke;
  const step = 360 / SEGMENTS;
  const gap = 4;
  return (
    <svg class={`heat-ring ${boiling ? 'boiling' : ''}`} width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      {Array.from({ length: SEGMENTS }).map((_, i) => (
        <path key={i} d={arc(c, c, r, i * step + gap / 2, (i + 1) * step - gap / 2)} class={i < lit ? 'on' : ''} stroke-width={stroke} fill="none" stroke-linecap="butt" />
      ))}
    </svg>
  );
}

/** Пиксельный котёл: спрайт 48×40 с перекрашиваемым зельем, огонь в два кадра и кольцо нагрева. */
export function Cauldron({ heat, boiling, potion, onTap }: Props) {
  const [squish, setSquish] = useState(false);
  const [frame, setFrame] = useState(0);
  const timer = useRef<number>();
  const scale = Math.max(3, Math.min(6, Math.floor((Math.min(window.innerWidth, 560) * 0.56) / 48)));
  const pot = SPRITES.cauldron;
  const fire = SPRITES.fire1;
  const potW = pot.w * scale;
  const potH = pot.h * scale;
  const ring = Math.round(potW * 1.3);

  useEffect(() => {
    const iv = setInterval(() => setFrame((f) => 1 - f), boiling ? 110 : 220);
    return () => clearInterval(iv);
  }, [boiling]);

  const handle = (e: PointerEvent) => {
    e.preventDefault();
    onTap(e.clientX, e.clientY);
    setSquish(true);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setSquish(false), 90);
  };

  return (
    <button class={`pixel-cauldron ${squish ? 'squish' : ''} ${boiling ? 'boiling' : ''}`} onPointerDown={handle} aria-label="Котёл">
      <div class="potwrap" style={{ width: ring, height: ring }}>
        <HeatRing size={ring} heat={heat} boiling={boiling} />
        <div class="potstack" style={{ top: Math.round((ring - potH) / 2 - (fire ? fire.h * scale * 0.35 : 0)) }}>
          <div class="pot">
            <Px id="cauldron" scale={scale} tint={potion} />
            {[0, 1, 2, 3].map((i) => (
              <i key={i} class="pbub" style={{ left: `${28 + i * 14}%`, animationDelay: `${i * 0.45}s` }} />
            ))}
          </div>
          <div class="fire">
            <Px id={frame ? 'fire2' : 'fire1'} scale={scale} />
          </div>
        </div>
      </div>
    </button>
  );
}

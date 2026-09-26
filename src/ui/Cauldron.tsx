import { useEffect, useRef, useState } from 'preact/hooks';
import { Px } from './Px';

interface Props {
  heat: number; // 0..100
  boiling: boolean;
  potion: string; // цвет зелья главы
  onTap: (x: number, y: number) => void;
}

const HEAT_SEGMENTS = 10;

/** Пиксельный котёл: спрайт 48×40 с перекрашиваемым зельем, огонь в два кадра и шкала нагрева. */
export function Cauldron({ heat, boiling, potion, onTap }: Props) {
  const [squish, setSquish] = useState(false);
  const [frame, setFrame] = useState(0);
  const timer = useRef<number>();
  const scale = Math.max(3, Math.min(6, Math.floor((Math.min(window.innerWidth, 560) * 0.62) / 48)));

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

  const lit = boiling ? HEAT_SEGMENTS : Math.round((heat / 100) * HEAT_SEGMENTS);

  return (
    <button class={`pixel-cauldron ${squish ? 'squish' : ''} ${boiling ? 'boiling' : ''}`} onPointerDown={handle} aria-label="Котёл">
      <div class="glow" />
      <div class="pot">
        <Px id="cauldron" scale={scale} tint={potion} />
        {[0, 1, 2, 3].map((i) => (
          <i key={i} class="pbub" style={{ left: `${28 + i * 14}%`, animationDelay: `${i * 0.45}s` }} />
        ))}
      </div>
      <div class="fire">
        <Px id={frame ? 'fire2' : 'fire1'} scale={scale} />
      </div>
      <div class="heat" aria-label="Нагрев котла">
        {Array.from({ length: HEAT_SEGMENTS }).map((_, i) => (
          <i key={i} class={i < lit ? 'on' : ''} />
        ))}
      </div>
    </button>
  );
}

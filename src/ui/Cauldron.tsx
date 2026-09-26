import { useRef, useState } from 'preact/hooks';

interface Props {
  heat: number; // 0..100
  boiling: boolean;
  onTap: (x: number, y: number) => void;
}

/** Котёл: SVG с анимированным зельем. Цвет зелья берётся из CSS-переменной --potion (меняется по главам). */
export function Cauldron({ heat, boiling, onTap }: Props) {
  const [squish, setSquish] = useState(false);
  const timer = useRef<number>();

  const handle = (e: PointerEvent) => {
    e.preventDefault();
    onTap(e.clientX, e.clientY);
    setSquish(true);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setSquish(false), 90);
  };

  const R = 44;
  const C = 2 * Math.PI * R;
  const heatFrac = boiling ? 1 : heat / 100;

  return (
    <button class={`cauldron-btn ${squish ? 'squish' : ''} ${boiling ? 'boiling' : ''}`} onPointerDown={handle} aria-label="Котёл">
      <div class="halo" />
      <svg class="heat-ring" viewBox="0 0 100 100">
        <defs>
          <linearGradient id="heatG" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#ffd36b" />
            <stop offset="1" stop-color="#ff5a3c" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="55" r={R} fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="2.2" />
        <circle
          cx="50"
          cy="55"
          r={R}
          fill="none"
          stroke="url(#heatG)"
          stroke-width="2.6"
          stroke-linecap="round"
          stroke-dasharray={`${C * heatFrac} ${C}`}
          transform="rotate(-90 50 55)"
          opacity={heatFrac > 0.01 ? 1 : 0}
          style={{ transition: 'stroke-dasharray 0.15s, opacity 0.2s', filter: heatFrac > 0.02 ? 'drop-shadow(0 0 3px #ff8a3c)' : 'none' }}
        />
      </svg>
      <svg viewBox="0 0 200 200">
        <defs>
          <radialGradient id="potionG" cx="50%" cy="40%" r="60%">
            <stop offset="0" stop-color="#ffffff" stop-opacity="0.85" />
            <stop offset="0.25" stop-color="var(--potion)" />
            <stop offset="1" stop-color="var(--potion)" stop-opacity="0.55" />
          </radialGradient>
          <linearGradient id="potG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#4a3a5e" />
            <stop offset="0.5" stop-color="#2a1f38" />
            <stop offset="1" stop-color="#140c1f" />
          </linearGradient>
          <linearGradient id="rimG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#8a7aa0" />
            <stop offset="1" stop-color="#3a2d4c" />
          </linearGradient>
          <radialGradient id="fireG" cx="50%" cy="100%" r="80%">
            <stop offset="0" stop-color="#fff3b0" />
            <stop offset="0.4" stop-color="#ffab3b" />
            <stop offset="1" stop-color="#ff3d2e" stop-opacity="0" />
          </radialGradient>
          <clipPath id="mouth">
            <ellipse cx="100" cy="86" rx="62" ry="15" />
          </clipPath>
        </defs>

        {/* Огонь */}
        <g class="fire" opacity={boiling ? 1 : 0.55 + heatFrac * 0.45}>
          {[0, 1, 2, 3, 4].map((i) => (
            <path
              key={i}
              d={`M${70 + i * 15} 188 q -8 -18 0 -${26 + (i % 2) * 12} q 8 16 0 ${26 + (i % 2) * 12}`}
              fill="url(#fireG)"
              style={{ transformOrigin: `${70 + i * 15}px 188px`, animation: `flame ${0.5 + i * 0.07}s ease-in-out ${i * 0.1}s infinite alternate` }}
            />
          ))}
        </g>
        {/* Ножки */}
        <path d="M58 166 l-8 20 h10 l8 -16z M142 166 l8 20 h-10 l-8 -16z" fill="#2a1f38" />
        {/* Корпус */}
        <path d="M34 90 C 30 150, 60 178, 100 178 C 140 178, 170 150, 166 90 Z" fill="url(#potG)" />
        <path d="M44 100 C 44 140, 64 162, 92 168" stroke="rgba(255,255,255,0.12)" stroke-width="5" fill="none" stroke-linecap="round" />
        {/* Руны */}
        <g fill="none" stroke="var(--potion)" stroke-width="2" opacity={0.35 + heatFrac * 0.6} style={{ filter: 'drop-shadow(0 0 3px var(--potion))' }}>
          <circle cx="100" cy="135" r="15" />
          <path d="M100 120 v30 M86 128 l28 14 M114 128 l-28 14" />
          <path d="M60 128 l6 -8 l6 8 z M140 128 l-6 -8 l-6 8 z" />
        </g>
        {/* Край */}
        <ellipse cx="100" cy="88" rx="70" ry="19" fill="url(#rimG)" />
        <ellipse cx="100" cy="86" rx="62" ry="15" fill="#120a1c" />
        {/* Зелье */}
        <g clip-path="url(#mouth)">
          <ellipse cx="100" cy="90" rx="62" ry="15" fill="url(#potionG)" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <circle
              key={i}
              class="anim"
              cx={60 + i * 16}
              cy={92}
              r={3 + (i % 3) * 2}
              fill="rgba(255,255,255,0.55)"
              style={{ animation: `bubble ${(boiling ? 0.5 : 1.6) + (i % 3) * 0.35}s ease-in ${i * 0.27}s infinite` }}
            />
          ))}
        </g>
        {/* Пар / пузыри над котлом */}
        {[0, 1, 2].map((i) => (
          <circle
            key={i}
            class="anim"
            cx={80 + i * 20}
            cy={70}
            r={5 + i}
            fill="none"
            stroke="var(--potion)"
            stroke-width="1.5"
            opacity="0"
            style={{ animation: `rise ${boiling ? 0.9 : 2.4}s ease-out ${i * 0.7}s infinite` }}
          />
        ))}
        <ellipse cx="100" cy="88" rx="70" ry="19" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1.5" />
      </svg>
      <style>{`
        .cauldron-btn .anim { transform-box: fill-box; transform-origin: center; }
        @keyframes flame { from { transform: scaleY(0.8) } to { transform: scaleY(1.15) skewX(4deg) } }
        @keyframes bubble { 0% { transform: translateY(8px) scale(0.3); opacity: 0 } 40% { opacity: 1 } 100% { transform: translateY(-6px) scale(1); opacity: 0 } }
        @keyframes rise { 0% { transform: translateY(0); opacity: 0 } 20% { opacity: 0.8 } 100% { transform: translateY(-60px) scale(1.6); opacity: 0 } }
      `}</style>
    </button>
  );
}

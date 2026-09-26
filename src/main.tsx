import { render } from 'preact';
import { App } from './ui/App';
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/600.css';
import '@fontsource/pixelify-sans/700.css';
import './styles/main.css';
import './styles/pixel.css';

// Высота сцены. В iOS-PWA (black-translucent) window.innerHeight бывает меньше экрана
// на высоту статус-бара — тогда в портрете берём полную высоту экрана.
function updateAppHeight() {
  const nav = navigator as Navigator & { standalone?: boolean };
  const standalone = nav.standalone === true || matchMedia('(display-mode: standalone)').matches;
  const portrait = window.innerHeight >= window.innerWidth;
  let h = window.innerHeight;
  if (standalone && portrait && /iPhone|iPod/.test(navigator.userAgent)) h = Math.max(h, window.screen.height);
  document.documentElement.style.setProperty('--app-h', `${h}px`);
}
updateAppHeight();
window.addEventListener('resize', updateAppHeight);
window.addEventListener('orientationchange', () => setTimeout(updateAppHeight, 300));

render(<App />, document.getElementById('root')!);

// Не даём iOS зумить двойным тапом и жестами.
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  });
}

// Просим браузер не вычищать сохранение (iOS может чистить данные сайтов, которые давно не открывали).
void navigator.storage?.persist?.().catch(() => {});

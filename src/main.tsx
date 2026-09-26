import { render } from 'preact';
import { App } from './ui/App';
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/600.css';
import '@fontsource/pixelify-sans/700.css';
import '@fontsource/onest/400.css';
import '@fontsource/onest/500.css';
import '@fontsource/onest/600.css';
import '@fontsource/onest/700.css';
import './styles/game.css';

// Высота сцены = реально видимая область окна. Статус-бар непрозрачный (black),
// поэтому игра не заходит под него и не обрезается снизу.
function updateAppHeight() {
  const h = window.visualViewport?.height ?? window.innerHeight;
  document.documentElement.style.setProperty('--app-h', `${Math.round(h)}px`);
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

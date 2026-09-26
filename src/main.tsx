import { render } from 'preact';
import { App } from './ui/App';
import './styles/main.css';

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

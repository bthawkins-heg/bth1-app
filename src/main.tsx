import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { applyTheme } from './lib/theme';
import { getState, subscribe } from './lib/store';

// Full-bleed layout only when launched from the Home Screen; inside Claude's viewer the page keeps normal margins.
const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
if (standalone) {
  document.documentElement.classList.add('standalone');
  document.querySelector('meta[name=viewport]')?.setAttribute('content', 'width=device-width, initial-scale=1.0, viewport-fit=cover');
}

applyTheme(getState().prefs.theme);
subscribe(() => applyTheme(getState().prefs.theme));

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

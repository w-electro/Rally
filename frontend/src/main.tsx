// Polyfill Node.js globals for libraries like simple-peer that expect a Node environment
if (typeof globalThis.global === 'undefined') {
  (globalThis as any).global = globalThis;
}
if (typeof globalThis.process === 'undefined') {
  (globalThis as any).process = { env: {} };
}
if (typeof globalThis.Buffer === 'undefined') {
  (globalThis as any).Buffer = { isBuffer: () => false };
}

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './i18n/i18n';
import './styles/globals.css';

// Hide splash screen after app loads
window.addEventListener('load', () => {
  setTimeout(() => {
    const splash = document.getElementById('splash');
    if (splash) {
      splash.classList.add('hidden');
      setTimeout(() => splash.remove(), 500);
    }
  }, 800);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />
);

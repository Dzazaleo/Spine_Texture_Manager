/**
 * Phase 1 Plan 03 — React 19 renderer entry.
 *
 * - `createRoot` with StrictMode (catches effects firing twice in dev).
 * - Side-effect import of `./index.css` triggers Tailwind + @theme inline
 *   + @font-face processing by `@tailwindcss/vite`.
 * - Mounts on `#root` in `src/renderer/index.html`.
 *
 * No business logic here — all state lives in `App.tsx`.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Renderer mount point #root not found in index.html');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

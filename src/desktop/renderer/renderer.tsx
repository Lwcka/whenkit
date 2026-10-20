// Tokens and base styles first, so the component styles that follow win ties.
import './tokens.css';
import './index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app';
import { createCatalogStore } from './catalog-store';
import { followSystemTheme } from './theme';
import './whenkit-api';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Missing #root element in index.html');
}

// data-theme goes on <html> before the first render (AD-20): the CSS reads
// only that attribute. Electron ties prefers-color-scheme to the theme main
// applied, so this is right after a reload and follows Windows live.
followSystemTheme();

// The one store of the renderer process. Listening comes first: a change
// announced while the first load runs makes the store read once more.
const store = createCatalogStore(window.whenkit);
window.whenkit.onCatalogChanged(() => {
  void store.reload();
});
void store.load();

createRoot(container).render(
  <StrictMode>
    <App store={store} api={window.whenkit} />
  </StrictMode>,
);

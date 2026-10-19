import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app';
import { createCatalogStore } from './catalog-store';
import './index.css';
import './whenkit-api';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Missing #root element in index.html');
}

// The one store of the renderer process, loaded once.
const store = createCatalogStore(window.whenkit);
void store.load();

createRoot(container).render(
  <StrictMode>
    <App store={store} />
  </StrictMode>,
);

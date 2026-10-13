import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// The CSP in index.html allows no inline code. In development, Vite injects
// imported CSS as inline <style> elements, so `npm start` alone gets
// 'unsafe-inline' for styles. Production builds extract CSS to files and
// keep the policy exactly as written.
const allowInlineStylesInDev = (): Plugin => ({
  name: 'whenkit:allow-inline-styles-in-dev',
  apply: 'serve',
  transformIndexHtml: (html) =>
    html.replace("style-src 'self'", "style-src 'self' 'unsafe-inline'"),
});

// https://vitejs.dev/config
export default defineConfig({
  plugins: [react(), allowInlineStylesInDev()],
});

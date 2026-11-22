import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'FarmaStock — Inventário da farmácia',
        short_name: 'FarmaStock',
        description: 'Gestão interna de inventário da farmácia.',
        lang: 'pt-PT',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#f6f7f5',
        theme_color: '#0f5c4d',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Só o shell da aplicação e os ficheiros estáticos. Nada de respostas da API:
        // o inventário nunca fica em cache (especificação, secção 9.4).
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/auth\//, /^\/rest\//, /^\/functions\//],
        runtimeCaching: [],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: { port: 5173 },
  build: { sourcemap: false },
});

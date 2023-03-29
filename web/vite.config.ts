import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import checker from 'vite-plugin-checker';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    manifest: true,
    rollupOptions: {
      // overwrite default .html entry
      input: {
        main: 'index.html',
        iframe: 'iframe.html',
      },
    },
  },
  plugins: [
    svelte(),
    checker({ typescript: true }),
    VitePWA({
      includeAssets: [
        'robots.txt',
        'apple-touch-icon.png',
        'android-chrome-144x144.png',
        'anki.png',
        'apple-touch-icon.png',
        'apple-touch-icon-precomposed.png',
        'favicon.ico',
        'favicon-16x16.png',
        'favicon-32x32.png',
        'mstile-150x150.png',
        'raycast.png',
        'safari-pinned-tab.svg',
      ],
      registerType: 'autoUpdate',
      manifest: {
        name: 'Suomea.xyz',
        short_name: 'Suomea.xyz',
        icons: [
          {
            src: '/android-chrome-144x144.png',
            sizes: '144x144',
            type: 'image/png',
          },
          {
            src: 'apple-touch-icon.png',
            sizes: '144x144',
            type: 'image/png',
          }
        ],
        theme_color: '#002F6C',
        background_color: '#002F6C',
        display: 'standalone',
      },
    }),
  ],
  server: {
    port: 8080,
    host: true,
  },
});

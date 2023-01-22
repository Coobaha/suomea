import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import checker from 'vite-plugin-checker';

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
  plugins: [svelte(), checker({ typescript: true })],
  server: {
    port: 8080,
    host: true,
  },
});

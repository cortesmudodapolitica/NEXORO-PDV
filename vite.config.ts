import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
  build: {
    // O projeto possui mÃ³dulos grandes (Admin/Brand). O tamanho nÃ£o Ã© erro de build;
    // aumentamos o limite apenas para eliminar o warning falso-positivo sem alterar o cÃ³digo.
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        painel: resolve(__dirname, 'painel.html'),
      },
    },
  },
  server: {
    allowedHosts: ['badland-unsolved-blabber.ngrok-free.dev'],
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
    // Dev: encaminha /api para o NEXORO LOCAL SERVER se VITE_DEV_PROXY estiver definido
    proxy: process.env.VITE_DEV_PROXY
      ? {
          '/api': {
            target: process.env.VITE_DEV_PROXY,
            changeOrigin: true,
          },
        }
      : undefined,
  },
});

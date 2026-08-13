import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
// postcss/tailwind loaded automatically by vite via postcss.config.js

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  // Configurações do servidor de desenvolvimento
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // Evitar que o dev server observe arquivos do Electron userData criados localmente
    // que podem estar travados por outros processos (IndexedDB/LOCK). Ignorar essa
    // pasta previne erros EBUSY ao rodar `npm run dev` junto com `electron:dev`.
    watch: {
      ignored: ['**/.electron-user-data/**']
    }
  },
  test: {
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx']
  }
});

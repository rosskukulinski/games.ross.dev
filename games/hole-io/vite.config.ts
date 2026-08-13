import { defineConfig } from 'vite';

export default defineConfig({
  // Required for serving from a subdirectory (/hole-io/) on games.ross.dev.
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
  },
});

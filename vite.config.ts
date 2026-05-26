import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist-renderer',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@tauri-apps/api/core': path.resolve(__dirname, 'src/lib/electron-tauri-shim/core.ts'),
      '@tauri-apps/api/event': path.resolve(__dirname, 'src/lib/electron-tauri-shim/event.ts'),
      '@tauri-apps/api/app': path.resolve(__dirname, 'src/lib/electron-tauri-shim/app.ts'),
      '@tauri-apps/api/path': path.resolve(__dirname, 'src/lib/electron-tauri-shim/path.ts'),
      '@tauri-apps/plugin-store': path.resolve(__dirname, 'src/lib/electron-tauri-shim/store.ts'),
      '@tauri-apps/plugin-os': path.resolve(__dirname, 'src/lib/electron-tauri-shim/os.ts'),
      '@tauri-apps/plugin-updater': path.resolve(__dirname, 'src/lib/electron-tauri-shim/updater.ts'),
      '@tauri-apps/plugin-process': path.resolve(__dirname, 'src/lib/electron-tauri-shim/process.ts'),
    },
  },
});

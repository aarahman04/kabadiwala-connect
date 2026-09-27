/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Emits /service-worker.js with the list of built assets injected, so the
 * whole app shell is precached on install and the app opens in airplane mode.
 */
function serviceWorkerPlugin(): Plugin {
  return {
    name: 'kc-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const assets = Object.keys(bundle).map((file) => '/' + file);
      const precache = [...new Set(['/', '/index.html', '/manifest.json', '/icon.svg', '/icon-192.png', '/icon-512.png', ...assets])];
      const source = readFileSync(resolve(import.meta.dirname, 'service-worker.js'), 'utf8')
        .replace('self.__PRECACHE__', JSON.stringify(precache))
        .replace('__BUILD_ID__', Date.now().toString(36));
      this.emitFile({ type: 'asset', fileName: 'service-worker.js', source });
    },
  };
}

// `--mode https` serves over self-signed HTTPS so a phone on the LAN gets a
// secure context (needed for service workers, crypto.subtle and camera).
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), serviceWorkerPlugin(), ...(mode === 'https' ? [basicSsl()] : [])],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'backend/src/**/*.test.ts'],
  },
}));

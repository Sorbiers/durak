import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// The table server (server/main.ts) as one file with the game's rules inside it, so that the
// server needs Node and nothing else: dist-net/server.mjs.
export default defineConfig({
  publicDir: false,
  ssr: { noExternal: true },
  build: {
    ssr: fileURLToPath(new URL('./server/main.ts', import.meta.url)),
    outDir: 'dist-net',
    rollupOptions: { output: { entryFileNames: 'server.mjs' } },
  },
});

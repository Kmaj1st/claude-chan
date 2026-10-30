import { defineConfig } from 'vite';

// Library build for the package; vite (dev) serves demo/ as the root.
export default defineConfig(({ command }) => ({
 root: command === 'serve' ? 'demo' : '.',
 // Dev only: serves assets/ at the site root (for example /chars/neutral.webp).
 publicDir: command === 'serve' ? '../assets' : false,
 server: { port: 5178, host: '127.0.0.1' },
 build: {
 lib: { entry: 'src/index.ts', formats: ['es'], fileName: () => 'claude-chan.js' },
 target: 'es2022',
 minify: true,
 },
}));

import { defineConfig } from 'vite';

// Library build for the package; vite (dev) serves demo/ as the root.
export default defineConfig(({ command }) => ({
 root: command === 'serve' ? 'demo' : '.',
 server: { port: 5178, host: '127.0.0.1' },
 build: {
 lib: { entry: 'src/index.ts', formats: ['es'], fileName: () => 'claude-chan.js' },
 target: 'es2022',
 minify: true,
 },
}));

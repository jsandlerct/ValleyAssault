import { defineConfig } from 'vite';

export default defineConfig({
    base: '/ValleyAssault/',
    build: { outDir: 'docs' },
    test: {
        environment: 'jsdom',
        globals:     true,
        setupFiles:  ['./src/__tests__/setup.js'],
    },
});

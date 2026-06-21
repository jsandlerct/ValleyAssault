import { defineConfig } from 'vite';

export default defineConfig({
    base: '/ValleyAssault/',
    test: {
        environment: 'jsdom',
        globals:     true,
        setupFiles:  ['./src/__tests__/setup.js'],
    },
});

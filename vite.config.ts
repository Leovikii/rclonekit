import { defineConfig } from 'vite';

export default defineConfig({
  server: { host: '127.0.0.1', port: 1420, strictPort: true },
  build: {
    target: 'es2023',
    rolldownOptions: {
      onwarn(warning, defaultHandler) {
        // This client-only SPA has no React Server Components boundary.
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE' && warning.message.includes('"use client"')
          && warning.id?.replaceAll('\\', '/').includes('/@mantine/')) return;
        defaultHandler(warning);
      },
    },
  },
});

import { defineConfig } from 'vite';

const port = 5240;
const engine = `http://127.0.0.1:${process.env.FORMTOOLS_PORT || '8240'}`;

export default defineConfig({
  clearScreen: false,
  server: {
    host: false,
    port,
    strictPort: true,
    fs: { allow: ['..'] },
    proxy: {
      '/api': { target: engine, ws: true, changeOrigin: true },
      '/mcp': { target: engine, changeOrigin: true },
    },
  },
  preview: { host: false, port: 5241, strictPort: true },
  build: { target: 'es2022', sourcemap: true, outDir: 'dist', emptyOutDir: true },
});

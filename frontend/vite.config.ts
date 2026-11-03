import { cpSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

const port = 5240;
const engine = `http://127.0.0.1:${process.env.FORMTOOLS_PORT || '8240'}`;
const PDF_ASSETS = ['cmaps', 'standard_fonts', 'wasm'];
const pdfRoot = resolve(__dirname, 'node_modules/pdfjs-dist');

function pdfAssets(): Plugin {
  let outDir = 'dist';
  return {
    name: 'formtools-pdf-assets',
    configResolved(c) { outDir = resolve(c.root, c.build.outDir); },
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url?.startsWith('/pdfjs/')) req.url = `/node_modules/pdfjs-dist/${req.url.slice('/pdfjs/'.length)}`;
        next();
      });
    },
    writeBundle() {
      for (const d of PDF_ASSETS) {
        const from = resolve(pdfRoot, d);
        if (existsSync(from)) cpSync(from, resolve(outDir, 'pdfjs', d), { recursive: true });
      }
    },
  };
}

export default defineConfig({
  clearScreen: false,
  plugins: [pdfAssets()],
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
  build: {
    target: 'es2022',
    sourcemap: true,
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: { main: resolve(__dirname, 'index.html'), overlay: resolve(__dirname, 'overlay.html') },
    },
  },
});

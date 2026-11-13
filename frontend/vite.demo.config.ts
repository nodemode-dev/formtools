import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const DEMO_PORT = 5243;
const FIRST = 'photos';
const PAGES: Record<string, { out: string; title: string }> = {
  photos: { out: '../demo', title: 'formtools demo: A photo shoot' },
  family: { out: '../demos/family', title: 'formtools demo: A shelf of Form files' },
  bench: { out: '../demos/bench', title: 'formtools demo: 3D and media bench' },
};
const PDF_WORKER = 'pdfjs-dist/build/pdf.worker.min.mjs?url';
const WORKER_ID = '\0formtools-demo-pdf-worker';

const pdfWorker = (): Plugin => ({
  name: 'formtools-demo-pdf-worker',
  enforce: 'pre',
  resolveId(id) { return id === PDF_WORKER ? WORKER_ID : null; },
  load(id) {
    if (id !== WORKER_ID) return null;
    const file = fileURLToPath(new URL('./node_modules/pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url));
    return `import ${JSON.stringify(file)};\nexport default 'pdf.worker.min.mjs';\n`;
  },
});

const brandBase = (): Plugin => ({
  name: 'formtools-demo-brand-base',
  enforce: 'pre',
  transform(code, id) {
    if (!id.endsWith('/src/ui/brand.ts')) return null;
    return { code: code.split('import.meta.env.BASE_URL').join("(document.documentElement.dataset.demoBase ?? '')"), map: null };
  },
});

const demoPage = (mode: string): Plugin => ({
  name: 'formtools-demo-page',
  transformIndexHtml: {
    order: 'pre',
    handler(html) {
      return html
        .replace('<script type="module" src="/src/main.ts"></script>', '<script type="module" src="../demo/src/main.ts"></script>')
        .replace(/\s*<link rel="(?:icon|apple-touch-icon|preload|manifest)"[^>]*>/g, '')
        .replace(/<html([^>]*)>/, `<html$1 data-demo="building" data-demo-id="${mode}" data-demo-base="${mode === FIRST ? '' : '../../demo/'}assets/">`)
        .replace('</head>', '  <style>html[data-demo="building"] #app, html[data-demo="building"] #toast-root { visibility: hidden !important; } html[data-demo="building"]::before { content: "Starting formtools"; position: fixed; left: 0; right: 0; top: calc(50% - 30px); font: 13px -apple-system, "Segoe UI", system-ui, sans-serif; color: var(--text-muted); text-align: center; } html[data-demo="building"]::after { content: ""; position: fixed; left: calc(50% - 90px); top: calc(50% - 2px); width: 180px; height: 3px; border-radius: 2px; background: linear-gradient(90deg, var(--accent-color), var(--accent-color)) 0 0 / 60px 3px no-repeat var(--bg-tertiary); animation: demo-start 1.4s ease-in-out infinite alternate; } @keyframes demo-start { to { background-position: 120px 0; } }</style>\n</head>')
        .replace(/<title>[^<]*<\/title>/, `<title>${PAGES[mode].title}</title>`);
    },
  },
});

const classicScript = (mode: string): Plugin => ({
  name: 'formtools-demo-classic-script',
  enforce: 'post',
  transformIndexHtml(html) {
    const tag = /<script type="module" crossorigin src="([^"]+)"><\/script>\s*/;
    const found = html.match(tag);
    if (!found) return html;
    const shared = (s: string): string => (mode === FIRST ? s : s.replace(/^\.?\/?assets\//, '../../demo/assets/'));
    return html
      .replace(tag, '')
      .replace(/(<link rel="stylesheet"[^>]*href=")([^"]+)"/g, (_all, head: string, href: string) => `${head}${shared(href)}"`)
      .replace('</body>', `<script defer src="assets/recording.js"></script>\n<script defer src="${shared(found[1])}"></script>\n</body>`)
      .replace(/ crossorigin(?=[ >])/g, '');
  },
});

const sharedBundle = (mode: string): Plugin => ({
  name: 'formtools-demo-shared-bundle',
  enforce: 'post',
  generateBundle(_options, bundle) {
    if (mode === FIRST) {
      this.emitFile({ type: 'asset', fileName: 'assets/favicon.png', source: readFileSync(fileURLToPath(new URL('./public/favicon.png', import.meta.url))) });
      return;
    }
    for (const name of Object.keys(bundle)) if (!name.endsWith('.html')) delete bundle[name];
  },
});

const symbol = (cp: number): boolean => (cp >= 0x2600 && cp <= 0x27bf) || (cp >= 0x1f000 && cp <= 0x1faff);
const unit = (n: number): string => `\\u${n.toString(16).toUpperCase().padStart(4, '0')}`;
const escapeSymbols = (): Plugin => ({
  name: 'formtools-demo-escape-symbols',
  enforce: 'post',
  generateBundle(_options, bundle) {
    for (const file of Object.values(bundle)) {
      if (file.type !== 'chunk') continue;
      let out = '';
      for (const ch of file.code) {
        const cp = ch.codePointAt(0) ?? 0;
        out += !symbol(cp) ? ch : cp > 0xffff ? unit(0xd800 + ((cp - 0x10000) >> 10)) + unit(0xdc00 + ((cp - 0x10000) & 0x3ff)) : unit(cp);
      }
      file.code = out;
    }
  },
});

export default defineConfig(({ mode }) => {
  const id = PAGES[mode] ? mode : FIRST;
  return {
    root: fileURLToPath(new URL('.', import.meta.url)),
    base: './',
    publicDir: false,
    plugins: [pdfWorker(), brandBase(), demoPage(id), classicScript(id), escapeSymbols(), sharedBundle(id)],
    server: { host: false, port: DEMO_PORT, strictPort: true, fs: { allow: ['..'] } },
    preview: { host: false, port: DEMO_PORT + 1, strictPort: true },
    build: {
      outDir: fileURLToPath(new URL(PAGES[id].out, import.meta.url)),
      emptyOutDir: false,
      target: 'es2022',
      sourcemap: false,
      cssCodeSplit: false,
      assetsInlineLimit: 0,
      modulePreload: false,
      chunkSizeWarningLimit: 20000,
      rollupOptions: {
        output: {
          format: 'iife' as const,
          inlineDynamicImports: true,
          entryFileNames: 'assets/demo.js',
          assetFileNames: (info: { names?: string[] }) => (info.names?.some((n) => n.endsWith('.css')) ? 'assets/demo.css' : 'assets/[name][extname]'),
        },
      },
    },
  };
});

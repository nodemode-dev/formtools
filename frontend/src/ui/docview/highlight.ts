import type { HLJSApi, LanguageFn } from 'highlight.js';

type Loader = () => Promise<{ default: LanguageFn }>;

const LOADERS: Record<string, Loader> = {
  javascript: () => import('highlight.js/lib/languages/javascript'),
  typescript: () => import('highlight.js/lib/languages/typescript'),
  json: () => import('highlight.js/lib/languages/json'),
  xml: () => import('highlight.js/lib/languages/xml'),
  css: () => import('highlight.js/lib/languages/css'),
  scss: () => import('highlight.js/lib/languages/scss'),
  less: () => import('highlight.js/lib/languages/less'),
  markdown: () => import('highlight.js/lib/languages/markdown'),
  yaml: () => import('highlight.js/lib/languages/yaml'),
  ini: () => import('highlight.js/lib/languages/ini'),
  bash: () => import('highlight.js/lib/languages/bash'),
  powershell: () => import('highlight.js/lib/languages/powershell'),
  c: () => import('highlight.js/lib/languages/c'),
  cpp: () => import('highlight.js/lib/languages/cpp'),
  csharp: () => import('highlight.js/lib/languages/csharp'),
  java: () => import('highlight.js/lib/languages/java'),
  kotlin: () => import('highlight.js/lib/languages/kotlin'),
  swift: () => import('highlight.js/lib/languages/swift'),
  go: () => import('highlight.js/lib/languages/go'),
  rust: () => import('highlight.js/lib/languages/rust'),
  ruby: () => import('highlight.js/lib/languages/ruby'),
  php: () => import('highlight.js/lib/languages/php'),
  sql: () => import('highlight.js/lib/languages/sql'),
  lua: () => import('highlight.js/lib/languages/lua'),
  perl: () => import('highlight.js/lib/languages/perl'),
  r: () => import('highlight.js/lib/languages/r'),
  diff: () => import('highlight.js/lib/languages/diff'),
  dockerfile: () => import('highlight.js/lib/languages/dockerfile'),
  makefile: () => import('highlight.js/lib/languages/makefile'),
  python: () => import('highlight.js/lib/languages/python'),
  objectivec: () => import('highlight.js/lib/languages/objectivec'),
  dart: () => import('highlight.js/lib/languages/dart'),
  scala: () => import('highlight.js/lib/languages/scala'),
  haskell: () => import('highlight.js/lib/languages/haskell'),
  latex: () => import('highlight.js/lib/languages/latex'),
  vbnet: () => import('highlight.js/lib/languages/vbnet'),
  properties: () => import('highlight.js/lib/languages/properties'),
  nginx: () => import('highlight.js/lib/languages/nginx'),
  graphql: () => import('highlight.js/lib/languages/graphql'),
  shell: () => import('highlight.js/lib/languages/shell'),
  cmake: () => import('highlight.js/lib/languages/cmake'),
  gradle: () => import('highlight.js/lib/languages/gradle'),
  groovy: () => import('highlight.js/lib/languages/groovy'),
  elixir: () => import('highlight.js/lib/languages/elixir'),
  erlang: () => import('highlight.js/lib/languages/erlang'),
  clojure: () => import('highlight.js/lib/languages/clojure'),
  ocaml: () => import('highlight.js/lib/languages/ocaml'),
  fsharp: () => import('highlight.js/lib/languages/fsharp'),
  julia: () => import('highlight.js/lib/languages/julia'),
  matlab: () => import('highlight.js/lib/languages/matlab'),
  protobuf: () => import('highlight.js/lib/languages/protobuf'),
  apache: () => import('highlight.js/lib/languages/apache'),
  http: () => import('highlight.js/lib/languages/http'),
  handlebars: () => import('highlight.js/lib/languages/handlebars'),
  twig: () => import('highlight.js/lib/languages/twig'),
  django: () => import('highlight.js/lib/languages/django'),
};

const ALIASES: Record<string, string> = {
  html: 'xml', htm: 'xml', svg: 'xml', xhtml: 'xml', plist: 'xml', vue: 'xml', xsl: 'xml', rss: 'xml',
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  ts: 'typescript', tsx: 'typescript',
  py: 'python', sh: 'bash', zsh: 'bash', yml: 'yaml', toml: 'ini', conf: 'ini', cfg: 'ini',
  cs: 'csharp', rs: 'rust', rb: 'ruby', md: 'markdown', h: 'c', hpp: 'cpp', cc: 'cpp',
  ps1: 'powershell', kt: 'kotlin', objc: 'objectivec', tex: 'latex', golang: 'go', pl: 'perl',
  docker: 'dockerfile', make: 'makefile', mk: 'makefile', vb: 'vbnet', jsonc: 'json', json5: 'json',
  gql: 'graphql', hs: 'haskell', ex: 'elixir', exs: 'elixir', erl: 'erlang', clj: 'clojure', ml: 'ocaml', fs: 'fsharp',
};

let core: Promise<HLJSApi> | null = null;
const loaded = new Map<string, Promise<boolean>>();

export function highlighter(): Promise<HLJSApi> {
  if (!core) core = import('highlight.js/lib/core').then((m) => m.default);
  return core;
}

export async function ensureLanguage(name: string | null | undefined): Promise<string | null> {
  if (!name) return null;
  const key = name.toLowerCase();
  const canon = LOADERS[key] ? key : ALIASES[key];
  if (!canon || !LOADERS[canon]) return null;
  const hl = await highlighter();
  let p = loaded.get(canon);
  if (!p) {
    p = LOADERS[canon]().then((m) => { hl.registerLanguage(canon, m.default); return true; }).catch(() => false);
    loaded.set(canon, p);
  }
  return (await p) ? canon : null;
}

export function splitHighlighted(html: string): string[] {
  const out: string[] = [];
  const stack: string[] = [];
  let cur = '';
  const re = /<span[^>]*>|<\/span>|\n|[^<\n]+|</g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const t = m[0];
    if (t === '\n') {
      cur += '</span>'.repeat(stack.length);
      out.push(cur);
      cur = stack.join('');
    } else if (t === '</span>') {
      stack.pop();
      cur += t;
    } else if (t.startsWith('<span')) {
      stack.push(t);
      cur += t;
    } else cur += t;
  }
  out.push(cur);
  return out;
}

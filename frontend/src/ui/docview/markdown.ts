import type MarkdownIt from 'markdown-it';
import type { Entry } from '../../io/api';
import { docApi } from '../../io/doc-api';
import { el, escapeHtml, q, setClass, setHidden, setText } from '../dom';
import { icon } from '../icons';
import './icons';
import { Seq, busy, copyText, dirName, errText } from './common';
import { ensureLanguage, highlighter } from './highlight';
import { TextView } from './text';
import type { DocDeps, DocKind } from './types';

type Md = InstanceType<typeof MarkdownIt>;

let engine: Promise<Md> | null = null;

function resolveImage(src: string, dir: string): string | null {
  if (!src || /^[a-z][a-z0-9+.-]*:/i.test(src) || src.startsWith('//')) return null;
  let rel = src.split(/[?#]/)[0];
  try { rel = decodeURIComponent(rel); } catch { rel = src; }
  const sep = dir.includes('\\') && !dir.includes('/') ? '\\' : '/';
  const parts = dir.split(/[\\/]/);
  for (const seg of rel.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') { if (parts.length > 1) parts.pop(); } else parts.push(seg);
  }
  return docApi.rawUrl(parts.join(sep));
}

function markdownEngine(): Promise<Md> {
  if (!engine) {
    engine = Promise.all([import('markdown-it'), highlighter()]).then(([mod, hl]) => {
      const md = new mod.default({
        html: false,
        linkify: true,
        highlight: (str, lang) => {
          if (lang && hl.getLanguage(lang)) {
            try { return `<pre class="dv-hl"><code class="hljs">${hl.highlight(str, { language: lang, ignoreIllegals: true }).value}</code></pre>`; } catch { return ''; }
          }
          return '';
        },
      });
      md.renderer.rules.image = (tokens, idx, _o, env: unknown) => {
        const t = tokens[idx];
        const url = resolveImage(String(t.attrGet('src') ?? ''), (env as { dir?: string } | undefined)?.dir ?? '');
        const alt = escapeHtml(t.content);
        if (!url) return `<span class="dv-md-noimg">${alt || 'image'}</span>`;
        return `<img class="dv-md-img" src="${escapeHtml(url)}" alt="${alt}" loading="lazy">`;
      };
      return md;
    });
  }
  return engine;
}

export class MarkdownView implements DocKind {
  readonly root = el<HTMLElement>(`<section class="dv-panel dv-md-panel" hidden>
      <div class="dv-bar">
        <span class="ft-seg" role="tablist">
          <button class="ft-seg-btn is-on" type="button" data-m="rendered">${icon('dvDoc', 14)}Rendered</button>
          <button class="ft-seg-btn" type="button" data-m="source">${icon('ftCode', 14)}Source</button>
        </span>
        <span class="dv-gap"></span>
        <span class="dv-note"></span>
        <span class="ft-busy dv-spin"></span>
      </div>
      <div class="dv-md-scroll"><article class="dv-md"></article></div>
    </section>`);
  private readonly source: TextView;
  private readonly scroll = q(this.root, '.dv-md-scroll');
  private readonly article = q(this.root, '.dv-md');
  private readonly spin = q(this.root, '.dv-spin');
  private readonly seq = new Seq();
  private mode: 'rendered' | 'source' = 'rendered';

  constructor(private readonly deps: DocDeps) {
    this.source = new TextView(deps, true);
    this.root.appendChild(this.source.root);
    this.apply();
    this.root.querySelector('.dv-bar')?.addEventListener('click', (e) => {
      const b = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-m]') : null;
      if (b) { this.mode = b.dataset.m === 'source' ? 'source' : 'rendered'; this.apply(); }
    });
    this.article.addEventListener('click', (e) => {
      const a = e.target instanceof Element ? e.target.closest('a') : null;
      if (!a) return;
      e.preventDefault();
      const href = a.getAttribute('href') ?? '';
      void copyText(href).then((ok) => this.deps.status(ok ? `Link copied: ${href}` : 'Could not copy the link.'));
    });
  }

  async open(entry: Entry): Promise<void> {
    const my = this.seq.next();
    setClass(this.root, 'is-loading', true);
    const stop = busy(this.spin);
    try {
      const data = await docApi.text(entry.path);
      if (!this.seq.is(my)) return;
      const langs = new Set<string>();
      for (const m of data.text.matchAll(/^[ \t]*(?:```|~~~)[ \t]*([\w+#-]+)/gm)) langs.add(m[1]);
      await Promise.all([...langs].map((l) => ensureLanguage(l)));
      const md = await markdownEngine();
      if (!this.seq.is(my)) return;
      const html = md.render(data.text, { dir: dirName(entry.path) });
      this.article.innerHTML = html;
      this.scroll.scrollTop = 0;
      setText(q(this.root, '.dv-note'), data.truncated ? 'The file is longer than the first 2 MB, which is what is shown.' : '');
      await this.source.show(entry, data);
    } catch (err) {
      if (this.seq.is(my)) {
        this.source.close();
        this.article.replaceChildren();
        setText(q(this.root, '.dv-note'), errText(err));
      }
    } finally {
      stop();
      if (this.seq.is(my)) setClass(this.root, 'is-loading', false);
    }
  }

  close(): void {
    this.seq.bump();
    this.source.close();
    this.article.replaceChildren();
  }

  key(e: KeyboardEvent): boolean {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
      this.mode = 'source';
      this.apply();
      this.source.focusFind();
      e.preventDefault();
      return true;
    }
    return this.mode === 'source' ? this.source.key(e) : false;
  }

  private apply(): void {
    const src = this.mode === 'source';
    setHidden(this.scroll, src);
    setHidden(this.source.root, !src);
    this.root.querySelectorAll<HTMLElement>('[data-m]').forEach((b) => setClass(b, 'is-on', (b.dataset.m === 'source') === src));
  }
}

import type { Entry } from '../../io/api';
import { docApi, type TextDoc } from '../../io/doc-api';
import { el, q, setClass, setText } from '../dom';
import { icon } from '../icons';
import './icons';
import { Seq, busy, copyText, errText, fmtBytes, fmtInt, typeOnly } from './common';
import { ensureLanguage, highlighter, splitHighlighted } from './highlight';
import type { DocDeps, DocKind } from './types';

const CHUNK = 400;
const HIGHLIGHT_LIMIT = 20000;
const MAX_HITS = 5000;

interface Hit { line: number; col: number }

type HighlightRegistry = { set(name: string, h: unknown): void; delete(name: string): void };
const registry = (): HighlightRegistry | null => (CSS as unknown as { highlights?: HighlightRegistry }).highlights ?? null;
const HighlightCtor = (): (new (...r: Range[]) => unknown) | null => (window as unknown as { Highlight?: new (...r: Range[]) => unknown }).Highlight ?? null;

export class TextView implements DocKind {
  readonly root = el<HTMLElement>(`<section class="dv-panel dv-text" hidden>
      <div class="dv-bar">
        <button class="cv-tt-btn" type="button" data-t="wrap" title="Wrap long lines" aria-label="Wrap long lines">${icon('dvWrap', 16)}</button>
        <button class="cv-tt-btn" type="button" data-t="case" title="Match case" aria-label="Match case">${icon('dvCaseUp', 16)}</button>
        <input class="ft-input dv-find" type="text" placeholder="Find" spellcheck="false" aria-label="Find in text">
        <button class="cv-tt-btn" type="button" data-t="prev" title="Previous match (Shift+Enter)" aria-label="Previous match">${icon('dvUp', 16)}</button>
        <button class="cv-tt-btn" type="button" data-t="next" title="Next match (Enter)" aria-label="Next match">${icon('dvDown', 16)}</button>
        <span class="dv-count"></span>
        <span class="dv-gap"></span>
        <span class="dv-note"></span>
        <span class="dv-info"></span>
        <span class="ft-busy dv-spin"></span>
      </div>
      <div class="dv-codewrap"><div class="dv-code"></div></div>
    </section>`);
  private readonly wrap = q(this.root, '.dv-codewrap');
  private readonly code = q(this.root, '.dv-code');
  private readonly find = q<HTMLInputElement>(this.root, '.dv-find');
  private readonly spin = q(this.root, '.dv-spin');
  private readonly seq = new Seq();
  private lines: string[] = [];
  private lower: string[] = [];
  private lineEls: HTMLElement[] = [];
  private hits: Hit[] = [];
  private cur = -1;
  private matchCase = false;
  private marked: HTMLElement | null = null;
  private entry: Entry | null = null;

  constructor(private readonly deps: DocDeps, embedded = false) {
    if (embedded) this.root.classList.add('is-embedded');
    this.root.addEventListener('click', (e) => {
      const b = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-t]') : null;
      if (!b) return;
      const t = b.dataset.t;
      if (t === 'wrap') { const on = !this.code.classList.contains('is-wrap'); setClass(this.code, 'is-wrap', on); setClass(b, 'is-on', on); }
      else if (t === 'case') { this.matchCase = !this.matchCase; setClass(b, 'is-on', this.matchCase); this.search(); }
      else if (t === 'next') this.step(1);
      else if (t === 'prev') this.step(-1);
    });
    this.find.addEventListener('input', () => this.search());
    this.find.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this.step(e.shiftKey ? -1 : 1); }
      else if (e.key === 'Escape') { this.find.value = ''; this.search(); this.find.blur(); e.stopPropagation(); }
    });
  }

  async open(entry: Entry): Promise<void> {
    const my = this.seq.next();
    this.entry = entry;
    setClass(this.root, 'is-loading', true);
    const stop = busy(this.spin);
    try {
      const data = await docApi.text(entry.path);
      if (!this.seq.is(my)) return;
      await this.show(entry, data, my);
    } catch (err) {
      if (this.seq.is(my)) {
        this.clear();
        setText(q(this.root, '.dv-note'), errText(err));
        setText(q(this.root, '.dv-info'), '');
      }
    } finally {
      stop();
      if (this.seq.is(my)) setClass(this.root, 'is-loading', false);
    }
  }

  async show(entry: Entry, data: TextDoc, token = this.seq.next()): Promise<void> {
    this.entry = entry;
    const hlOn = data.lines <= HIGHLIGHT_LIMIT;
    let html: string[] | null = null;
    let lang: string | null = null;
    if (hlOn) {
      lang = await ensureLanguage(data.language);
      if (!this.seq.is(token)) return;
      if (lang) {
        const hl = await highlighter();
        if (!this.seq.is(token)) return;
        try { html = splitHighlighted(hl.highlight(data.text, { language: lang, ignoreIllegals: true }).value); } catch { html = null; }
      }
    }
    const plain = data.text.split(/\r\n|\r|\n/);
    if (plain.length > 1 && plain[plain.length - 1] === '') plain.pop();
    if (html && html.length > plain.length) html.length = plain.length;
    this.lines = plain;
    this.lower = [];
    this.lineEls = new Array<HTMLElement>(plain.length);
    const digits = String(plain.length).length;
    this.code.style.setProperty('--gut', `${digits + 2}ch`);
    const frag = document.createDocumentFragment();
    for (let i = 0; i < plain.length; i += CHUNK) {
      const chunk = document.createElement('div');
      chunk.className = 'dv-chunk';
      const end = Math.min(plain.length, i + CHUNK);
      chunk.style.setProperty('--n', String(end - i));
      for (let j = i; j < end; j++) {
        const ln = document.createElement('div');
        ln.className = 'dv-ln';
        ln.dataset.n = String(j + 1);
        if (html) ln.innerHTML = html[j] ?? '';
        else ln.textContent = plain[j];
        this.lineEls[j] = ln;
        chunk.appendChild(ln);
      }
      frag.appendChild(chunk);
    }
    this.marked = null;
    this.code.replaceChildren(frag);
    this.wrap.scrollTop = 0;
    this.wrap.scrollLeft = 0;
    const notes: string[] = [];
    if (!hlOn) notes.push(`Highlighting is off: the file has more than ${fmtInt(HIGHLIGHT_LIMIT)} lines.`);
    else if (!lang) notes.push(data.language ? 'Highlighting is not available for this language.' : 'No highlighting for this file type.');
    if (data.truncated) notes.push(`Showing the first ${fmtBytes(new Blob([data.text]).size)} of the file.`);
    setText(q(this.root, '.dv-note'), notes.join(' '));
    const eol = { lf: 'LF', crlf: 'CRLF', cr: 'CR', mixed: 'Mixed line endings' }[data.eol];
    setText(q(this.root, '.dv-info'), [data.encoding + (data.bom ? ' with BOM' : ''), eol, `${fmtInt(data.lines)} lines`, lang ?? ''].filter(Boolean).join(' · '));
    this.search();
  }

  close(): void {
    this.seq.bump();
    this.clear();
    this.entry = null;
  }

  key(e: KeyboardEvent): boolean {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); this.focusFind(); return true; }
    if (e.key === 'F3') { e.preventDefault(); this.step(e.shiftKey ? -1 : 1); return true; }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c' && !typeOnly(e) && !window.getSelection()?.toString() && this.entry) {
      void copyText(this.lines.join('\n')).then((ok) => this.deps.status(ok ? 'Copied the whole text.' : 'Could not copy.'));
      return true;
    }
    return false;
  }

  focusFind(): void { this.find.focus(); this.find.select(); }

  private clear(): void {
    this.lines = [];
    this.lower = [];
    this.lineEls = [];
    this.hits = [];
    this.cur = -1;
    this.marked = null;
    this.code.replaceChildren();
    registry()?.delete('dv-hit');
    setText(q(this.root, '.dv-count'), '');
  }

  private search(): void {
    const needle = this.matchCase ? this.find.value : this.find.value.toLowerCase();
    this.hits = [];
    this.cur = -1;
    if (needle) {
      if (!this.matchCase && this.lower.length !== this.lines.length) this.lower = this.lines.map((l) => l.toLowerCase());
      const hay = this.matchCase ? this.lines : this.lower;
      outer: for (let i = 0; i < hay.length; i++) {
        let at = hay[i].indexOf(needle);
        while (at >= 0) {
          this.hits.push({ line: i, col: at });
          if (this.hits.length >= MAX_HITS) break outer;
          at = hay[i].indexOf(needle, at + needle.length);
        }
      }
    }
    if (this.hits.length) {
      const top = this.wrap.scrollTop;
      let k = this.hits.findIndex((h) => (this.lineEls[h.line]?.offsetTop ?? 0) >= top);
      if (k < 0) k = 0;
      this.go(k);
    } else this.go(-1);
  }

  private step(dir: number): void {
    if (!this.hits.length) return;
    this.go((this.cur + dir + this.hits.length) % this.hits.length);
  }

  private go(k: number): void {
    this.cur = k;
    if (this.marked) { this.marked.classList.remove('is-hit'); this.marked = null; }
    registry()?.delete('dv-hit');
    const count = q(this.root, '.dv-count');
    if (k < 0) {
      setText(count, this.find.value ? 'No matches' : '');
      return;
    }
    const hit = this.hits[k];
    const ln = this.lineEls[hit.line];
    setText(count, `${k + 1} of ${fmtInt(this.hits.length)}${this.hits.length >= MAX_HITS ? '+' : ''}`);
    if (!ln) return;
    ln.classList.add('is-hit');
    this.marked = ln;
    ln.scrollIntoView({ block: 'center', inline: 'nearest' });
    const reg = registry(), H = HighlightCtor();
    if (reg && H) {
      const r = this.rangeIn(ln, hit.col, this.find.value.length);
      if (r) reg.set('dv-hit', new H(r));
    }
  }

  private rangeIn(line: HTMLElement, col: number, len: number): Range | null {
    const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
    let pos = 0;
    let startNode: Text | null = null, startOff = 0;
    const r = document.createRange();
    let n = walker.nextNode() as Text | null;
    while (n) {
      const l = n.data.length;
      if (!startNode && col < pos + l) { startNode = n; startOff = col - pos; }
      if (startNode && col + len <= pos + l) {
        r.setStart(startNode, startOff);
        r.setEnd(n, col + len - pos);
        return r;
      }
      pos += l;
      n = walker.nextNode() as Text | null;
    }
    return null;
  }
}

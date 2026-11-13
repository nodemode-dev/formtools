import type { Entry } from '../../io/api';
import { docApi, type ArchiveEntry, type ExtractResult } from '../../io/doc-api';
import { delayedIndicator, el, patchList, q, setClass, setDisabled, setHidden, setText } from '../dom';
import { icon } from '../icons';
import './icons';
import { Seq, busy, errText, fmtBytes, fmtDate, fmtInt, typeOnly } from './common';
import type { DocDeps, DocKind } from './types';
import { VirtualList } from './vlist';

interface Node {
  name: string;
  path: string;
  dir: boolean;
  size: number;
  packed: number;
  mtime: number;
  encrypted: boolean;
  link: boolean;
  member: string | null;
  kids: Map<string, Node> | null;
  count: number;
}

const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'jpe', 'gif', 'webp', 'bmp', 'svg', 'avif', 'ico']);
const TEXT_EXT = new Set(['txt', 'md', 'markdown', 'json', 'csv', 'tsv', 'log', 'xml', 'html', 'htm', 'css', 'js', 'mjs', 'ts', 'tsx', 'jsx', 'py', 'rb', 'go', 'rs', 'c', 'h', 'cpp', 'hpp', 'java', 'kt', 'swift', 'sh', 'bat', 'ps1', 'yml', 'yaml', 'toml', 'ini', 'cfg', 'conf', 'sql', 'tex', 'rst', 'nfo', 'license', 'readme', 'gitignore', 'plist', 'srt', 'vtt']);
const MIME: Record<string, string> = { svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', jpe: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp', avif: 'image/avif', ico: 'image/x-icon' };
const PREVIEW_MAX = 64 * 1024 * 1024;
const TEXT_BYTES = 200000;
const ROW_H = 28;

const extOf = (name: string): string => { const i = name.lastIndexOf('.'); return i < 0 ? name.toLowerCase() : name.slice(i + 1).toLowerCase(); };

function newNode(name: string, path: string, dir: boolean): Node {
  return { name, path, dir, size: 0, packed: 0, mtime: 0, encrypted: false, link: false, member: null, kids: dir ? new Map() : null, count: 0 };
}

export class ArchiveView implements DocKind {
  readonly root = el<HTMLElement>(`<section class="dv-panel dv-archive" hidden>
      <div class="dv-bar">
        <button class="cv-tt-btn" type="button" data-a="up" title="Up one folder (Backspace)" aria-label="Up one folder">${icon('dvUp', 16)}</button>
        <nav class="dv-crumbs" aria-label="Folder"></nav>
        <input class="ft-input dv-find" type="text" placeholder="Filter this folder" spellcheck="false" aria-label="Filter this folder">
        <span class="dv-gap"></span>
        <span class="dv-note"></span>
        <span class="dv-info"></span>
        <span class="ft-busy dv-spin"></span>
        <button class="ft-btn" type="button" data-a="extract-sel" disabled>${icon('dvExtract', 14)}<span>Extract selected</span></button>
        <button class="ft-btn" type="button" data-a="extract-all">${icon('dvExtract', 14)}<span>Extract all</span></button>
      </div>
      <div class="dv-arc-body">
        <div class="dv-arc-list">
          <div class="dv-arc-head"><span></span><span>Name</span><span class="is-right">Size</span><span class="is-right">Packed</span><span>Modified</span></div>
          <div class="dv-arc-scroll" tabindex="0"></div>
        </div>
        <aside class="dv-arc-prev">
          <div class="dv-arc-prev-name"></div>
          <div class="dv-arc-prev-meta"></div>
          <div class="dv-arc-prev-box">
            <img class="dv-arc-prev-img" alt="" hidden>
            <pre class="dv-arc-prev-text" hidden></pre>
            <p class="dv-arc-prev-msg">Select a file to preview it.</p>
            <span class="ft-busy dv-arc-prev-spin"></span>
          </div>
        </aside>
      </div>
    </section>`);
  private readonly scroller = q(this.root, '.dv-arc-scroll');
  private readonly crumbs = q(this.root, '.dv-crumbs');
  private readonly filter = q<HTMLInputElement>(this.root, '.dv-find');
  private readonly spin = q(this.root, '.dv-spin');
  private readonly list: VirtualList;
  private readonly seq = new Seq();
  private entry: Entry | null = null;
  private tree: Node = newNode('', '', true);
  private all: ArchiveEntry[] = [];
  private cwd: Node = this.tree;
  private view: Node[] = [];
  private selected = new Set<string>();
  private anchor = -1;
  private focus = -1;
  private previewToken = 0;
  private previewUrl = '';
  private previewKey = '';

  constructor(private readonly deps: DocDeps) {
    this.list = new VirtualList(this.scroller, ROW_H, () => {
      const r = document.createElement('div');
      r.className = 'dv-ar';
      r.innerHTML = '<span class="dv-ar-ico"></span><span class="dv-ar-name"></span><span class="dv-ar-size is-right"></span><span class="dv-ar-packed is-right"></span><span class="dv-ar-date"></span>';
      return r;
    }, (n, i) => this.fill(n, i));
    this.scroller.addEventListener('click', (e) => {
      const row = e.target instanceof Element ? e.target.closest<HTMLElement>('.dv-ar') : null;
      if (!row || row.dataset.i === undefined) return;
      this.pick(Number(row.dataset.i), e.metaKey || e.ctrlKey, e.shiftKey);
    });
    this.scroller.addEventListener('dblclick', (e) => {
      const row = e.target instanceof Element ? e.target.closest<HTMLElement>('.dv-ar') : null;
      const node = row?.dataset.i !== undefined ? this.view[Number(row.dataset.i)] : null;
      if (node?.dir) this.enter(node);
    });
    this.root.addEventListener('click', (e) => {
      const b = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-a]') : null;
      const a = b?.dataset.a;
      if (a === 'up') this.up();
      else if (a === 'extract-all') void this.extract(false);
      else if (a === 'extract-sel') void this.extract(true);
    });
    this.crumbs.addEventListener('click', (e) => {
      const b = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-path]') : null;
      if (b?.dataset.path !== undefined) this.goPath(b.dataset.path);
    });
    this.filter.addEventListener('input', () => this.refreshView());
    this.filter.addEventListener('keydown', (e) => { if (e.key === 'Escape') { this.filter.value = ''; this.refreshView(); this.filter.blur(); e.stopPropagation(); } });
  }

  async open(entry: Entry): Promise<void> {
    const my = this.seq.next();
    this.entry = entry;
    setClass(this.root, 'is-loading', true);
    const stop = busy(this.spin);
    try {
      const res = await docApi.archiveList(entry.path);
      if (!this.seq.is(my)) return;
      this.all = res.entries;
      this.tree = this.buildTree(res.entries);
      this.cwd = this.tree;
      this.selected.clear();
      this.anchor = -1;
      this.filter.value = '';
      this.clearPreview();
      this.refreshView();
      this.scroller.scrollTop = 0;
      setText(q(this.root, '.dv-info'), `${res.format} · ${fmtInt(res.total)} entries · ${res.engine}`);
      setText(q(this.root, '.dv-note'), res.truncated ? `Showing the first ${fmtInt(res.entries.length)} of ${fmtInt(res.total)} entries.` : '');
    } catch (err) {
      if (this.seq.is(my)) {
        this.all = [];
        this.tree = newNode('', '', true);
        this.cwd = this.tree;
        this.refreshView();
        setText(q(this.root, '.dv-note'), errText(err));
        setText(q(this.root, '.dv-info'), '');
      }
    } finally {
      stop();
      if (this.seq.is(my)) setClass(this.root, 'is-loading', false);
    }
  }

  close(): void {
    this.seq.bump();
    this.previewToken++;
    this.clearPreview();
    this.all = [];
    this.tree = newNode('', '', true);
    this.cwd = this.tree;
    this.view = [];
    this.selected.clear();
    this.list.setCount(0);
    this.entry = null;
  }

  key(e: KeyboardEvent): boolean {
    if (typeOnly(e) || e.metaKey || e.ctrlKey || e.altKey) return false;
    const inList = this.scroller.contains(document.activeElement);
    if (e.key === 'Backspace') { this.up(); return true; }
    if (!inList) return false;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const next = Math.max(0, Math.min(this.view.length - 1, (this.anchor < 0 ? -1 : this.focus) + (e.key === 'ArrowDown' ? 1 : -1)));
      if (this.view.length) { this.pick(next, false, e.shiftKey); this.reveal(next); }
      return true;
    }
    if (e.key === 'Enter') {
      const node = this.anchor < 0 ? undefined : this.view[this.focus];
      if (node?.dir) this.enter(node);
      return true;
    }
    return false;
  }

  private buildTree(entries: ArchiveEntry[]): Node {
    const root = newNode('', '', true);
    for (const e of entries) {
      const parts = e.member.replace(/^(\.\/)+/, '').split('/').filter(Boolean);
      if (!parts.length) continue;
      let cur = root;
      const trail: Node[] = [root];
      for (let i = 0; i < parts.length; i++) {
        const last = i === parts.length - 1;
        const name = parts[i];
        const path = parts.slice(0, i + 1).join('/');
        const asDir = !last || e.dir;
        let child = cur.kids?.get(name);
        if (!child) {
          child = newNode(name, path, asDir);
          cur.kids?.set(name, child);
        }
        if (last) {
          child.member = e.member;
          child.mtime = e.mtime;
          child.encrypted = e.encrypted;
          child.link = e.link;
          if (!e.dir) { child.size = e.size; child.packed = e.packed; }
        }
        cur = child;
        trail.push(child);
      }
      if (!e.dir) for (const n of trail) { if (n.dir) { n.size += e.size; n.packed += e.packed; n.count++; if (e.mtime > n.mtime) n.mtime = e.mtime; } }
    }
    return root;
  }

  private refreshView(): void {
    const needle = this.filter.value.trim().toLowerCase();
    const kids = [...(this.cwd.kids?.values() ?? [])].filter((n) => !needle || n.name.toLowerCase().includes(needle));
    kids.sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }) : a.dir ? -1 : 1));
    this.view = kids;
    this.list.setCount(kids.length);
    this.renderCrumbs();
    this.syncSelection();
  }

  private renderCrumbs(): void {
    const parts = this.cwd.path ? this.cwd.path.split('/') : [];
    const items = [{ path: '', label: this.entry?.name ?? 'Archive' }, ...parts.map((p, i) => ({ path: parts.slice(0, i + 1).join('/'), label: p }))];
    patchList(this.crumbs, items, {
      key: (c) => `c:${c.path}`,
      create: (c) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'dv-crumb';
        b.dataset.path = c.path;
        b.textContent = c.label;
        return b;
      },
      update: (n, c) => setText(n, c.label),
    });
    this.crumbs.querySelectorAll<HTMLElement>('.dv-crumb').forEach((b, i, all) => setClass(b, 'is-last', i === all.length - 1));
    setDisabled(q<HTMLButtonElement>(this.root, '[data-a="up"]'), this.cwd === this.tree);
  }

  private goPath(path: string): void {
    let cur = this.tree;
    if (path) for (const part of path.split('/')) { const next = cur.kids?.get(part); if (!next) return; cur = next; }
    this.cwd = cur;
    this.selected.clear();
    this.anchor = -1;
    this.filter.value = '';
    this.scroller.scrollTop = 0;
    this.refreshView();
    this.clearPreview();
  }

  private enter(node: Node): void { this.goPath(node.path); }

  private up(): void {
    if (this.cwd === this.tree) return;
    const i = this.cwd.path.lastIndexOf('/');
    this.goPath(i < 0 ? '' : this.cwd.path.slice(0, i));
  }

  private pick(i: number, toggle: boolean, range: boolean): void {
    const node = this.view[i];
    if (!node) return;
    if (range && this.anchor >= 0) {
      const [a, b] = [Math.min(this.anchor, i), Math.max(this.anchor, i)];
      this.selected.clear();
      for (let k = a; k <= b; k++) this.selected.add(this.view[k].path);
    } else if (toggle) {
      if (this.selected.has(node.path)) this.selected.delete(node.path); else this.selected.add(node.path);
      this.anchor = i;
    } else {
      this.selected.clear();
      this.selected.add(node.path);
      this.anchor = i;
    }
    this.focus = i;
    this.syncSelection();
    this.list.refresh();
    const only = this.selected.size === 1 ? this.view.find((n) => this.selected.has(n.path)) : undefined;
    if (only && !only.dir) void this.preview(only); else this.clearPreview(only?.dir ? `${only.name}: ${fmtInt(only.count)} files, ${fmtBytes(only.size)}.` : undefined);
  }

  private reveal(i: number): void {
    const top = i * ROW_H, h = this.scroller.clientHeight;
    if (top < this.scroller.scrollTop) this.scroller.scrollTop = top;
    else if (top + ROW_H > this.scroller.scrollTop + h) this.scroller.scrollTop = top + ROW_H - h;
  }

  private syncSelection(): void {
    const n = this.selected.size;
    const b = q<HTMLButtonElement>(this.root, '[data-a="extract-sel"]');
    setDisabled(b, n === 0);
    setText(b.lastElementChild, n > 1 ? `Extract ${fmtInt(n)} selected` : 'Extract selected');
  }

  private fill(row: HTMLElement, i: number): void {
    const node = this.view[i];
    row.style.visibility = node ? '' : 'hidden';
    if (!node) { delete row.dataset.i; return; }
    row.dataset.i = String(i);
    setClass(row, 'is-sel', this.selected.has(node.path));
    const ico = row.children[0] as HTMLElement;
    const kind = node.dir ? 'dir' : node.encrypted ? 'lock' : node.link ? 'link' : 'file';
    if (ico.dataset.k !== kind) {
      ico.dataset.k = kind;
      ico.innerHTML = icon(kind === 'dir' ? 'dvFolder' : kind === 'lock' ? 'dvLock' : kind === 'link' ? 'dvLink' : 'dvFile', 16);
    }
    setText(row.children[1], node.name);
    row.children[1].setAttribute('title', node.path);
    setText(row.children[2], node.dir && !node.count ? '' : fmtBytes(node.size));
    setText(row.children[3], node.dir && !node.count ? '' : fmtBytes(node.packed));
    setText(row.children[4], fmtDate(node.mtime));
  }

  private membersOf(nodes: Node[]): string[] {
    const out = new Set<string>();
    const prefixes = nodes.filter((n) => n.dir).map((n) => `${n.path}/`);
    for (const n of nodes) if (!n.dir && n.member) out.add(n.member);
    if (prefixes.length) {
      for (const e of this.all) {
        const m = e.member.replace(/^(\.\/)+/, '');
        if (prefixes.some((p) => m.startsWith(p))) out.add(e.member);
      }
    }
    for (const n of nodes) if (n.dir && n.member) out.add(n.member);
    return [...out];
  }

  private async extract(selected: boolean): Promise<void> {
    const entry = this.entry;
    if (!entry) return;
    const members = selected ? this.membersOf(this.view.filter((n) => this.selected.has(n.path))) : undefined;
    if (selected && !members?.length) return;
    try {
      const job = await docApi.archiveExtract(entry.path, members);
      this.deps.status(selected ? 'Extracting the selected items...' : 'Extracting the archive...');
      this.deps.jobs.track(job, (j) => {
        if (j.state === 'done') {
          const r = j.result as ExtractResult | null;
          this.deps.status(r ? `Extracted ${fmtInt(r.written)} file${r.written === 1 ? '' : 's'} to ${r.dest}${r.skipped ? `, ${fmtInt(r.skipped)} skipped` : ''}.` : 'Extraction finished.');
        } else if (j.state === 'failed') this.deps.status(`Extraction failed: ${j.errors[0]?.error ?? 'unknown error'}.`);
      });
    } catch (err) {
      this.deps.status(errText(err));
    }
  }

  private clearPreview(message = 'Select a file to preview it.'): void {
    this.previewToken++;
    this.previewKey = '';
    this.showPreview({ name: '', meta: '', img: '', text: null, message });
  }

  private showPreview(p: { name: string; meta: string; img: string; text: string | null; message: string }): void {
    const img = q<HTMLImageElement>(this.root, '.dv-arc-prev-img');
    const pre = q(this.root, '.dv-arc-prev-text');
    const msg = q(this.root, '.dv-arc-prev-msg');
    setText(q(this.root, '.dv-arc-prev-name'), p.name);
    setText(q(this.root, '.dv-arc-prev-meta'), p.meta);
    if (this.previewUrl && this.previewUrl !== p.img) { URL.revokeObjectURL(this.previewUrl); this.previewUrl = ''; }
    if (p.img) { this.previewUrl = p.img; if (img.src !== p.img) img.src = p.img; } else if (img.getAttribute('src')) img.removeAttribute('src');
    setHidden(img, !p.img);
    if (p.text !== null) setText(pre, p.text);
    else setText(pre, '');
    setHidden(pre, p.text === null);
    setText(msg, p.message);
    setHidden(msg, !p.message);
  }

  private async preview(node: Node): Promise<void> {
    if (!this.entry || !node.member) return;
    const key = `${this.entry.path}|${node.member}`;
    if (key === this.previewKey) return;
    this.previewKey = key;
    const token = ++this.previewToken;
    const meta = `${fmtBytes(node.size)}${node.mtime ? ` · ${fmtDate(node.mtime)}` : ''}`;
    const ext = extOf(node.name);
    const isImg = IMAGE_EXT.has(ext), isText = TEXT_EXT.has(ext);
    if (!isImg && !isText) { this.showPreview({ name: node.name, meta, img: '', text: null, message: 'No preview for this kind of file. Extract it to open it.' }); return; }
    if (node.encrypted) { this.showPreview({ name: node.name, meta, img: '', text: null, message: 'This file is encrypted.' }); return; }
    if (node.size > PREVIEW_MAX) { this.showPreview({ name: node.name, meta, img: '', text: null, message: 'This file is too large to preview.' }); return; }
    const spin = q(this.root, '.dv-arc-prev-spin');
    const stop = delayedIndicator(() => spin.classList.add('is-on'), () => spin.classList.remove('is-on'));
    try {
      const blob = await docApi.archiveMember(this.entry.path, node.member);
      if (token !== this.previewToken) return;
      if (isImg) {
        const typed = new Blob([blob], { type: MIME[ext] ?? blob.type });
        this.showPreview({ name: node.name, meta, img: URL.createObjectURL(typed), text: null, message: '' });
      } else {
        const text = await blob.slice(0, TEXT_BYTES).text();
        if (token !== this.previewToken) return;
        this.showPreview({ name: node.name, meta, img: '', text: blob.size > TEXT_BYTES ? `${text}\n...` : text, message: '' });
      }
    } catch (err) {
      if (token === this.previewToken) this.showPreview({ name: node.name, meta, img: '', text: null, message: errText(err) });
    } finally {
      stop();
    }
  }
}

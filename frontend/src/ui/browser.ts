import { api, type Entry, type Label, type Listing, type Place, type Tag } from '../io/api';
import { delayedIndicator, el, escapeHtml, isMac, patchList, q, setClass, setHidden, setText, setValue, type Disposer } from './dom';
import { icon } from './icons';
import { loadPrefs, onPrefs, updatePrefs, type Prefs } from './prefs';
import { toast } from './toast';
import { FolderTree } from './tree';

export const LABEL_KEYS: Record<string, Label> = { '6': 'red', '7': 'yellow', '8': 'green', '9': 'blue' };

export interface BrowserDeps {
  openFile: (entries: Entry[], index: number) => void;
  quickLook: (entries: Entry[], index: number) => void;
  status: (text: string) => void;
  folderChanged: (path: string) => void;
}

const TYPE_ICON: Record<string, string> = {
  dir: 'folder', image: 'fileImage', video: 'ftMedia', audio: 'ftAudio', model: 'ftCube', text: 'ftText', archive: 'ftArchive', font: 'ftFont', pdf: 'ftText', family: 'ftFamily', other: 'newFile',
};
const THUMBABLE = new Set(['image', 'family', 'video', 'audio']);
const TAGGABLE = new Set(['image', 'family', 'video']);
const thumbFor = (e: Entry): string => e.type === 'video' || e.type === 'audio' ? api.mediaThumbUrl(e.path, 320, e.mtime) : api.thumbUrl(e.path, 320, e.mtime);
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`;
  const u = ['KB', 'MB', 'GB', 'TB'];
  let v = n / 1024, i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${u[i]}`;
}

const fmtDate = (s: number): string => new Date(s * 1000).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export class Browser {
  readonly root: HTMLElement;
  private readonly grid: HTMLElement;
  private readonly places: HTMLElement;
  private readonly pathInput: HTMLInputElement;
  private readonly filter: HTMLInputElement;
  private readonly sort: HTMLSelectElement;
  private readonly size: HTMLInputElement;
  private readonly empty: HTMLElement;
  private readonly bar: HTMLElement;
  private listing: Listing | null = null;
  private shown: Entry[] = [];
  private selected = -1;
  private readonly picked = new Set<string>();
  private anchor = -1;
  private readonly tags = new Map<string, Tag>();
  private tagTimer = 0;
  private readonly tree: FolderTree;
  private loadSeq = 0;
  private stopIndicator: Disposer | null = null;
  private readonly io: IntersectionObserver;

  constructor(private readonly deps: BrowserDeps) {
    const p = loadPrefs();
    this.root = el<HTMLElement>(`
      <section class="ft-browser ft-page" aria-label="Browser" data-page="browse" hidden>
        <aside class="ft-places" aria-label="Places"><div class="ft-places-title">Places</div><div class="ft-places-list"></div><div class="ft-places-title">Folders</div><div class="ft-tree-slot"></div></aside>
        <div class="ft-browser-main">
          <div class="ft-bbar">
            <button class="cv-tt-btn" type="button" data-act="up" title="Enclosing folder" aria-label="Enclosing folder">${icon('ftUp', 16)}</button>
            <button class="cv-tt-btn" type="button" data-act="refresh" title="Reload" aria-label="Reload">${icon('refresh', 16)}</button>
            <input class="ft-path" type="text" spellcheck="false" autocomplete="off" aria-label="Folder path" placeholder="Type a folder path and press Enter">
            <label class="cv-hf-filter">${icon('search', 14)}<input class="cv-hf-input ft-filter" type="search" placeholder="Filter" aria-label="Filter by name"></label>
            <select class="cv-hf-sort ft-sort" aria-label="Sort by">
              <option value="name">Name</option><option value="date">Date</option><option value="size">Size</option><option value="type">Type</option>
            </select>
            <button class="cv-tt-btn ft-sortdir" type="button" data-act="sortdir" title="Reverse order" aria-label="Reverse order">${icon('swap', 16)}</button>
            <input class="ft-size" type="range" min="96" max="320" step="8" aria-label="Thumbnail size">
            <div class="cv-hf-views">
              <button class="cv-hf-view" type="button" data-view="grid" title="Grid" aria-label="Grid">${icon('viewGrid', 16)}</button>
              <button class="cv-hf-view" type="button" data-view="list" title="List" aria-label="List">${icon('viewList', 16)}</button>
            </div>
            <span class="ft-bbar-busy" aria-hidden="true"></span>
          </div>
          <div class="ft-grid" role="listbox" tabindex="0" aria-label="Files"></div>
          <p class="cv-hf-empty ft-grid-empty" hidden></p>
        </div>
      </section>`);
    this.grid = q(this.root, '.ft-grid');
    this.places = q(this.root, '.ft-places-list');
    this.pathInput = q(this.root, '.ft-path');
    this.filter = q(this.root, '.ft-filter');
    this.sort = q(this.root, '.ft-sort');
    this.size = q(this.root, '.ft-size');
    this.empty = q(this.root, '.ft-grid-empty');
    this.bar = q(this.root, '.ft-bbar');
    this.tree = new FolderTree((path) => void this.open(path));
    q(this.root, '.ft-tree-slot').replaceWith(this.tree.root);
    this.io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) this.loadThumb(e.target as HTMLElement);
    }, { root: this.grid, rootMargin: '400px 0px' });
    this.syncPrefs(p);
    onPrefs((np) => this.syncPrefs(np));
    this.wire();
  }

  private wire(): void {
    this.bar.addEventListener('click', (e) => {
      const t = e.target instanceof Element ? e.target : null;
      const act = t?.closest<HTMLElement>('[data-act]')?.dataset.act;
      if (act === 'up') this.up();
      else if (act === 'refresh' && this.listing) void this.open(this.listing.path, true);
      else if (act === 'sortdir') updatePrefs({ sortDesc: !loadPrefs().sortDesc });
      const view = t?.closest<HTMLElement>('[data-view]')?.dataset.view;
      if (view === 'grid' || view === 'list') updatePrefs({ browserView: view });
    });
    this.pathInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); void this.open(this.pathInput.value.trim()); this.grid.focus(); }
      else if (e.key === 'Escape') { this.pathInput.value = this.listing?.path ?? ''; this.grid.focus(); }
    });
    this.filter.addEventListener('input', () => this.render());
    this.filter.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); this.grid.focus(); if (this.selected < 0 && this.shown.length) this.select(0); } });
    this.sort.addEventListener('change', () => updatePrefs({ sortBy: this.sort.value as Prefs['sortBy'] }));
    this.size.addEventListener('input', () => this.grid.style.setProperty('--ft-thumb', `${this.size.value}px`));
    this.size.addEventListener('change', () => updatePrefs({ thumbSize: Number(this.size.value) }));
    this.places.addEventListener('click', (e) => {
      const path = (e.target instanceof Element ? e.target.closest<HTMLElement>('[data-path]') : null)?.dataset.path;
      if (path) void this.open(path);
    });
    this.grid.addEventListener('click', (e) => {
      const item = e.target instanceof Element ? e.target.closest<HTMLElement>('.ft-item') : null;
      if (!item) return;
      const i = this.shown.findIndex((x) => x.path === item.dataset.key);
      const toggle = isMac ? e.metaKey : e.ctrlKey;
      if (e.shiftKey) this.select(i, 'range');
      else if (toggle) this.select(i, 'toggle');
      else this.select(i);
    });
    this.grid.addEventListener('dblclick', (e) => {
      const item = e.target instanceof Element ? e.target.closest<HTMLElement>('.ft-item') : null;
      if (item) this.activate(this.shown.findIndex((x) => x.path === item.dataset.key));
    });
    this.grid.addEventListener('keydown', (e) => this.key(e));
  }

  private syncPrefs(p: Prefs): void {
    setValue(this.sort, p.sortBy);
    setValue(this.size, String(p.thumbSize));
    this.grid.style.setProperty('--ft-thumb', `${p.thumbSize}px`);
    setClass(this.root, 'is-list', p.browserView === 'list');
    setClass(q(this.root, '.ft-sortdir'), 'is-on', p.sortDesc);
    for (const b of this.root.querySelectorAll<HTMLElement>('[data-view]')) setClass(b, 'is-active', b.dataset.view === p.browserView);
    if (this.listing) this.render();
  }

  async start(): Promise<void> {
    try {
      const home = await api.home();
      this.setPlaces(home.roots);
      const roots = home.roots.map((r) => ({ name: r.name, path: r.path, has_children: true }));
      if (home.home.startsWith('/') && !roots.some((r) => r.path === '/')) roots.push({ name: 'Computer', path: '/', has_children: true });
      this.tree.setRoots(roots);
      const last = loadPrefs().lastFolder;
      await this.open(last || home.home, false, home.home);
    } catch (e) {
      this.deps.status(e instanceof Error ? e.message : 'The engine is not answering.');
    }
  }

  private setPlaces(roots: Place[]): void {
    patchList(this.places, roots, {
      key: (r) => r.path,
      create: (r) => el<HTMLElement>(`<button class="ft-place" type="button" data-path="${escapeHtml(r.path)}" title="${escapeHtml(r.path)}">${icon('folder', 16)}<span>${escapeHtml(r.name)}</span></button>`),
      update: () => undefined,
    });
  }

  get path(): string { return this.listing?.path ?? ''; }

  async open(path: string, keepSelection = false, fallback?: string): Promise<void> {
    if (!path) return;
    const seq = ++this.loadSeq;
    this.stopIndicator?.();
    const busy = q(this.root, '.ft-bbar-busy');
    this.stopIndicator = delayedIndicator(() => setClass(busy, 'is-on', true), () => setClass(busy, 'is-on', false));
    try {
      const listing = await api.list(path, loadPrefs().showHidden);
      if (seq !== this.loadSeq) return;
      const prevPath = this.listing?.path;
      const keep = keepSelection && this.selected >= 0 ? this.shown[this.selected]?.path : (prevPath && listing.path !== prevPath && prevPath.startsWith(listing.path) ? prevPath : undefined);
      this.listing = listing;
      this.pathInput.value = listing.path;
      if (!keepSelection) { this.filter.value = ''; this.grid.scrollTop = 0; }
      if (!keepSelection || listing.path !== prevPath) { this.picked.clear(); this.anchor = -1; }
      this.selected = -1;
      this.render();
      if (keep) {
        const i = this.shown.findIndex((x) => x.path === keep);
        if (i >= 0) { if (keepSelection) this.markSelected(i); else this.select(i); }
      }
      updatePrefs({ lastFolder: listing.path });
      this.deps.folderChanged(listing.path);
      void this.tree.reveal(listing.path);
    } catch (e) {
      if (seq !== this.loadSeq) return;
      if (fallback && fallback !== path) { await this.open(fallback); return; }
      toast(e instanceof Error ? e.message : `Could not open ${path}.`, 'error');
      this.pathInput.value = this.listing?.path ?? '';
    } finally {
      if (seq === this.loadSeq) { this.stopIndicator?.(); this.stopIndicator = null; }
    }
  }

  private up(): void { if (this.listing?.parent) void this.open(this.listing.parent); }

  private sorted(list: Entry[]): Entry[] {
    const p = loadPrefs();
    const dir = p.sortDesc ? -1 : 1;
    const by = (a: Entry, b: Entry): number => {
      if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1;
      let c = 0;
      if (p.sortBy === 'date') c = a.mtime - b.mtime;
      else if (p.sortBy === 'size') c = a.size - b.size;
      else if (p.sortBy === 'type') c = collator.compare(a.ext, b.ext);
      return (c || collator.compare(a.name, b.name)) * dir;
    };
    return [...list].sort(by);
  }

  private render(): void {
    if (!this.listing) return;
    const f = this.filter.value.trim().toLowerCase();
    const prevKey = this.selected >= 0 ? this.shown[this.selected]?.path : undefined;
    const names = new Set(this.listing.entries.map((e) => e.name));
    const sidecar = (e: Entry): boolean => e.kind === 'file' && e.ext === 'xmp' && names.has(e.name.slice(0, -4));
    this.shown = this.sorted(this.listing.entries.filter((e) => !sidecar(e) && (!f || e.name.toLowerCase().includes(f))));
    const update = (node: HTMLElement, e: Entry): void => {
      setText(q(node, '.ft-item-name'), e.name);
      setText(q(node, '.ft-item-meta'), e.kind === 'dir' ? 'Folder' : `${e.ext.toUpperCase() || 'File'} · ${fmtSize(e.size)}`);
      setText(q(node, '.ft-item-date'), fmtDate(e.mtime));
      this.paintTag(node, this.tags.get(e.path));
      const stamp = String(e.mtime);
      if (node.dataset.stamp !== stamp) {
        node.dataset.stamp = stamp;
        const img = q<HTMLImageElement>(node, '.ft-item-img');
        if (img.dataset.src) { img.dataset.src = ''; delete node.dataset.loaded; this.io.unobserve(node); if (THUMBABLE.has(e.type)) this.io.observe(node); }
      }
    };
    patchList(this.grid, this.shown, {
      key: (e) => e.path,
      create: (e) => {
        const n = el<HTMLElement>(`<div class="ft-item" role="option" aria-selected="false" data-type="${e.kind === 'dir' ? 'dir' : e.type}">
          <div class="ft-item-thumb"><span class="ft-item-glyph">${icon(TYPE_ICON[e.kind === 'dir' ? 'dir' : e.type] ?? 'newFile', 28)}</span><img class="ft-item-img" alt="" decoding="async" hidden></div>
          <span class="ft-item-tag" aria-hidden="true"><span class="ft-item-stars"></span><i class="ft-item-label"></i></span>
          <span class="ft-item-name"></span><span class="ft-item-meta"></span><span class="ft-item-date"></span></div>`);
        n.dataset.stamp = String(e.mtime);
        update(n, e);
        if (e.kind === 'file' && THUMBABLE.has(e.type)) this.io.observe(n);
        return n;
      },
      update,
    });
    const msg = this.listing.entries.length === 0 ? 'This folder is empty.' : this.shown.length === 0 ? 'Nothing matches the filter.' : '';
    setText(this.empty, msg);
    setHidden(this.empty, !msg);
    const i = prevKey ? this.shown.findIndex((x) => x.path === prevKey) : -1;
    this.markSelected(i);
    this.report();
    this.queueTags();
  }

  private paintTag(node: HTMLElement, tag: Tag | undefined): void {
    const rating = tag?.rating ?? 0, label = tag?.label ?? null;
    const stars = q(node, '.ft-item-stars');
    if (stars.dataset.rating !== String(rating)) { stars.dataset.rating = String(rating); stars.innerHTML = icon('ftStarFill', 10).repeat(rating); }
    const dot = q(node, '.ft-item-label');
    if ((dot.dataset.label ?? '') !== (label ?? '')) { if (label) dot.dataset.label = label; else delete dot.dataset.label; }
    setClass(node, 'is-tagged', rating > 0 || !!label);
  }

  private queueTags(): void {
    window.clearTimeout(this.tagTimer);
    this.tagTimer = window.setTimeout(() => void this.loadTags(), 120);
  }

  private async loadTags(): Promise<void> {
    const want = this.shown.filter((e) => e.kind === 'file' && TAGGABLE.has(e.type) && !this.tags.has(e.path)).slice(0, 2000);
    if (!want.length) return;
    const folder = this.listing?.path;
    try {
      const r = await api.metaRead(want.map((e) => e.path));
      for (const e of want) this.tags.set(e.path, r.items[e.path] ?? { rating: 0, label: null });
      if (folder !== this.listing?.path) return;
      for (const node of Array.from(this.grid.children) as HTMLElement[]) { const t = this.tags.get(node.dataset.key ?? ''); if (t) this.paintTag(node, t); }
    } catch {
      for (const e of want) this.tags.set(e.path, { rating: 0, label: null });
    }
  }

  private async tag(change: Partial<Tag>): Promise<void> {
    const targets = this.selection().filter((e) => e.kind === 'file' && TAGGABLE.has(e.type));
    if (!targets.length) return;
    let failed = 0;
    await Promise.all(targets.map(async (e) => {
      try {
        const t = await api.metaWrite(e.path, change);
        this.tags.set(e.path, t);
        const node = Array.from(this.grid.children).find((n) => (n as HTMLElement).dataset.key === e.path) as HTMLElement | undefined;
        if (node) this.paintTag(node, t);
      } catch { failed++; }
    }));
    if (failed) toast(`${failed} file${failed === 1 ? '' : 's'} could not be tagged.`, 'error');
    else this.deps.status(change.rating !== undefined ? `${change.rating ? `${change.rating} star${change.rating === 1 ? '' : 's'}` : 'Rating cleared'} on ${targets.length} file${targets.length === 1 ? '' : 's'}` : `${change.label ? `Label ${change.label}` : 'Label cleared'} on ${targets.length} file${targets.length === 1 ? '' : 's'}`);
  }

  tagFor(path: string): Tag | undefined { return this.tags.get(path); }

  setTag(path: string, tag: Tag): void {
    this.tags.set(path, tag);
    const node = Array.from(this.grid.children).find((n) => (n as HTMLElement).dataset.key === path) as HTMLElement | undefined;
    if (node) this.paintTag(node, tag);
  }

  private loadThumb(node: HTMLElement): void {
    if (node.dataset.loaded) return;
    node.dataset.loaded = '1';
    this.io.unobserve(node);
    const entry = this.shown.find((x) => x.path === node.dataset.key);
    if (!entry) return;
    const img = q<HTMLImageElement>(node, '.ft-item-img');
    const src = thumbFor(entry);
    img.dataset.src = src;
    const probe = new Image();
    probe.decoding = 'async';
    probe.onload = () => {
      void (probe.decode ? probe.decode().catch(() => undefined) : Promise.resolve()).then(() => {
        if (img.dataset.src !== src) return;
        img.src = src;
        img.hidden = false;
        setClass(node, 'has-thumb', true);
      });
    };
    probe.src = src;
  }

  private markSelected(i: number): void {
    this.selected = i;
    const focusKey = i >= 0 ? this.shown[i]?.path : undefined;
    for (const node of Array.from(this.grid.children) as HTMLElement[]) {
      const key = node.dataset.key ?? '';
      const on = this.picked.has(key);
      setClass(node, 'is-selected', on);
      setClass(node, 'is-focus', key === focusKey);
      if (node.getAttribute('aria-selected') !== String(on)) node.setAttribute('aria-selected', String(on));
    }
  }

  private select(i: number, mode: 'one' | 'toggle' | 'range' = 'one'): void {
    if (i < 0 || i >= this.shown.length) return;
    const key = this.shown[i].path;
    if (mode === 'toggle') {
      if (this.picked.has(key)) this.picked.delete(key); else this.picked.add(key);
      this.anchor = i;
    } else if (mode === 'range' && this.anchor >= 0) {
      const [a, b] = this.anchor < i ? [this.anchor, i] : [i, this.anchor];
      this.picked.clear();
      for (let k = a; k <= b; k++) this.picked.add(this.shown[k].path);
    } else {
      this.picked.clear();
      this.picked.add(key);
      this.anchor = i;
    }
    this.markSelected(i);
    (this.grid.children[i] as HTMLElement | undefined)?.scrollIntoView({ block: 'nearest' });
    this.report();
  }

  selectAll(): void {
    this.picked.clear();
    for (const e of this.shown) this.picked.add(e.path);
    this.markSelected(this.selected < 0 ? 0 : this.selected);
    this.report();
  }

  selection(): Entry[] {
    const picked = this.shown.filter((e) => this.picked.has(e.path));
    if (picked.length) return picked;
    const cur = this.selected >= 0 ? this.shown[this.selected] : undefined;
    return cur ? [cur] : [];
  }

  selectedFiles(): Entry[] { return this.selection().filter((e) => e.kind === 'file'); }

  files(): Entry[] { return this.shown.filter((e) => e.kind === 'file'); }

  private report(): void {
    const files = this.shown.filter((e) => e.kind === 'file').length;
    const dirs = this.shown.length - files;
    const sel = this.selected >= 0 ? this.shown[this.selected] : null;
    const base = `${dirs} folder${dirs === 1 ? '' : 's'}, ${files} file${files === 1 ? '' : 's'}`;
    if (this.picked.size > 1) { this.deps.status(`${base} · ${this.picked.size} selected`); return; }
    this.deps.status(sel ? `${base} · ${sel.name}${sel.kind === 'file' ? ` · ${fmtSize(sel.size)}` : ''}` : base);
  }

  private columns(): number {
    if (this.root.classList.contains('is-list') || this.grid.children.length < 2) return 1;
    const first = (this.grid.children[0] as HTMLElement).offsetTop;
    let n = 0;
    for (const c of Array.from(this.grid.children)) { if ((c as HTMLElement).offsetTop !== first) break; n++; }
    return Math.max(1, n);
  }

  private activate(i: number): void {
    const e = this.shown[i];
    if (!e) return;
    if (e.kind === 'dir') { void this.open(e.path); return; }
    const files = this.shown.filter((x) => x.kind === 'file');
    this.deps.openFile(files, files.indexOf(e));
  }

  private key(e: KeyboardEvent): void {
    const n = this.shown.length;
    if (!n && e.key !== 'Backspace') return;
    const cols = this.columns();
    const at = this.selected;
    const go = (i: number): void => { e.preventDefault(); this.select(Math.max(0, Math.min(n - 1, i)), e.shiftKey ? 'range' : 'one'); };
    const mod = isMac ? e.metaKey : e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); this.selectAll(); return; }
    if (!mod && !e.altKey && /^[0-5]$/.test(e.key)) { e.preventDefault(); void this.tag({ rating: Number(e.key) }); return; }
    if (!mod && !e.altKey && LABEL_KEYS[e.key]) {
      e.preventDefault();
      const cur = this.selection()[0];
      const now = cur ? this.tags.get(cur.path)?.label : null;
      void this.tag({ label: now === LABEL_KEYS[e.key] ? null : LABEL_KEYS[e.key] });
      return;
    }
    switch (e.key) {
      case 'ArrowRight': go(at < 0 ? 0 : at + 1); break;
      case 'ArrowLeft': go(at < 0 ? 0 : at - 1); break;
      case 'ArrowDown': if (e.altKey || e.metaKey) { e.preventDefault(); this.activate(at); } else go(at < 0 ? 0 : at + cols); break;
      case 'ArrowUp': if (e.altKey || e.metaKey) { e.preventDefault(); this.up(); } else go(at < 0 ? 0 : at - cols); break;
      case 'Home': go(0); break;
      case 'End': go(n - 1); break;
      case 'PageDown': go(at + cols * 4); break;
      case 'PageUp': go(at - cols * 4); break;
      case 'Enter': e.preventDefault(); this.activate(at); break;
      case 'Backspace': e.preventDefault(); this.up(); break;
      case ' ': {
        e.preventDefault();
        const sel = this.shown[at];
        if (sel?.kind === 'file') { const files = this.shown.filter((x) => x.kind === 'file'); this.deps.quickLook(files, files.indexOf(sel)); }
        break;
      }
      default: break;
    }
  }

  focus(): void { this.grid.focus({ preventScroll: true }); }

  selectPath(path: string): void { const i = this.shown.findIndex((x) => x.path === path); if (i >= 0) this.select(i); }

  focusPath(): void { this.pathInput.focus(); this.pathInput.select(); }
}

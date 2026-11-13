import { api, ApiError, type Entry, type Job } from '../../io/api';
import { exifApi, type ExifGroup, type ExifRead, type ExifStatus, type ExifValue } from '../../io/exif-api';
import { el, patchList, q, setClass, setHidden, setText } from '../dom';
import { icon } from '../icons';
import { toast } from '../toast';
import './icons';

export interface MetaDeps { jobs: { track(job: Job, cb?: (job: Job) => void): void } }

type Mode = 'idle' | 'ready' | 'unavailable' | 'error' | 'empty';

interface RowItem { key: string; name: string; label: string; full: string; shown: string }
interface GroupItem { key: string; name: string; rows: RowItem[] }

const OPEN_KEY = 'formtools_meta_open';
const GROUPS_KEY = 'formtools_meta_groups';
const DEFAULT_OPEN = 2;
const SHOWN_MAX = 600;
const TITLE_MAX = 1500;
const HAY_MAX = 4000;
const CACHE_MAX = 8;
const SLOW_MS = 300;
const CLAMP_TITLE_AT = 90;

const keyOf = (e: Entry): string => `${e.path}\u0000${e.mtime}\u0000${e.size}`;

const textOf = (v: ExifValue): string => (v === null ? '' : typeof v === 'string' ? v : typeof v === 'object' ? JSON.stringify(v) : String(v));

const clip = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n)}…` : s);

const progressOf = (j: Job): string => j.current || (j.total ? `${Math.round((j.done / j.total) * 100)} percent` : j.title || 'Starting');

function readStore<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeStore(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    return;
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const prev = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.className = 'ft-meta-scratch';
    document.body.append(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    prev?.focus({ preventScroll: true });
    return ok;
  }
}

function itemsOf(groups: ExifGroup[]): GroupItem[] {
  const seenGroups = new Map<string, number>();
  return groups.map((g) => {
    const gn = (seenGroups.get(g.name) ?? 0) + 1;
    seenGroups.set(g.name, gn);
    const seen = new Map<string, number>();
    const rows = g.tags.map((t): RowItem => {
      const n = (seen.get(t.name) ?? 0) + 1;
      seen.set(t.name, n);
      const full = textOf(t.value);
      return { key: n > 1 ? `${t.name} (${n})` : t.name, name: t.name, label: t.label || t.name, full, shown: clip(full, SHOWN_MAX) };
    });
    return { key: gn > 1 ? `${g.name} (${gn})` : g.name, name: g.name, rows };
  });
}

function jsonOf(result: ExifRead, groups: GroupItem[]): string {
  const out: Record<string, Record<string, ExifValue>> = {};
  groups.forEach((g, gi) => {
    const tags: Record<string, ExifValue> = {};
    g.rows.forEach((r, ri) => { tags[r.key] = result.groups[gi].tags[ri].value; });
    out[g.key] = tags;
  });
  return JSON.stringify({ tool: result.tool, version: result.version, file: result.file, groups: out }, null, 2);
}

export class MetaPanel {
  readonly root: HTMLElement;
  private readonly toggleBtn: HTMLButtonElement;
  private readonly countEl: HTMLElement;
  private readonly copyAll: HTMLButtonElement;
  private readonly body: HTMLElement;
  private readonly filter: HTMLInputElement;
  private readonly stage: HTMLElement;
  private readonly groupsEl: HTMLElement;
  private readonly stateBox: HTMLElement;
  private readonly msgEl: HTMLElement;
  private readonly progEl: HTMLElement;
  private readonly getBtn: HTMLButtonElement;
  private readonly noMatch: HTMLElement;
  private readonly warnEl: HTMLElement;
  private readonly hay = new WeakMap<HTMLElement, string>();
  private readonly full = new WeakMap<HTMLElement, string>();
  private readonly cache = new Map<string, ExifRead>();
  private entry: Entry | null = null;
  private seq = 0;
  private abort: AbortController | null = null;
  private reading = false;
  private slowTimer = 0;
  private open: boolean;
  private opened: Set<string> | null;
  private mode: Mode = 'idle';
  private shownKey: string | null = null;
  private result: ExifRead | null = null;
  private groupItems: GroupItem[] = [];
  private message = '';
  private fetching = false;
  private fetchable = true;
  private jobId = '';
  private progress = '';
  private progressFailed = false;
  private filterTimer = 0;

  constructor(private readonly deps: MetaDeps) {
    this.root = el<HTMLElement>(`
      <section class="ft-meta" aria-label="All metadata">
        <div class="ft-meta-bar">
          <div class="ft-meta-head">
            <button class="ft-meta-toggle" type="button" data-act="toggle" aria-expanded="false" title="Show every tag ExifTool can read from this file">
              <span class="ft-meta-chev">${icon('metaChevron', 14)}</span>
              <span class="ft-meta-title">All metadata</span>
              <span class="ft-meta-count"></span>
            </button>
            <button class="cv-tt-btn ft-meta-copy" type="button" data-act="copy-all" title="Copy all as JSON" aria-label="Copy all as JSON" disabled>${icon('metaBraces', 16)}</button>
          </div>
          <label class="ft-meta-filter-box" hidden>
            <span class="ft-meta-filter-icon">${icon('search', 14)}</span>
            <input class="ft-meta-filter" type="text" placeholder="Filter tags and values" aria-label="Filter metadata" autocomplete="off" spellcheck="false" disabled>
          </label>
        </div>
        <div class="ft-meta-body" hidden>
          <div class="ft-meta-stage">
            <div class="ft-meta-groups"></div>
            <div class="ft-meta-state" hidden>
              <p class="ft-meta-msg"></p>
              <p class="ft-meta-progress"></p>
              <button class="ft-meta-get" type="button" data-act="get" hidden>Get ExifTool</button>
            </div>
            <p class="ft-meta-nomatch" hidden>No tag or value matches the filter.</p>
            <span class="ft-meta-pill" role="status">Reading</span>
          </div>
          <p class="ft-meta-warn" hidden></p>
        </div>
      </section>`);
    this.toggleBtn = q(this.root, '[data-act="toggle"]');
    this.countEl = q(this.root, '.ft-meta-count');
    this.copyAll = q(this.root, '[data-act="copy-all"]');
    this.body = q(this.root, '.ft-meta-body');
    this.filter = q(this.root, '.ft-meta-filter');
    this.stage = q(this.root, '.ft-meta-stage');
    this.groupsEl = q(this.root, '.ft-meta-groups');
    this.stateBox = q(this.root, '.ft-meta-state');
    this.msgEl = q(this.root, '.ft-meta-msg');
    this.progEl = q(this.root, '.ft-meta-progress');
    this.getBtn = q(this.root, '.ft-meta-get');
    this.noMatch = q(this.root, '.ft-meta-nomatch');
    this.warnEl = q(this.root, '.ft-meta-warn');
    const saved = readStore<string[]>(GROUPS_KEY);
    this.opened = Array.isArray(saved) ? new Set(saved.filter((s) => typeof s === 'string')) : null;
    this.open = readStore<boolean>(OPEN_KEY) === true;
    this.applyOpen();
    this.wire();
  }

  show(entry: Entry): void {
    this.entry = entry;
    if (entry.kind === 'dir') {
      this.clear();
      return;
    }
    const key = keyOf(entry);
    if (this.open) {
      void this.load();
      return;
    }
    if (this.shownKey !== key) this.invalidate();
  }

  clear(): void {
    this.entry = null;
    this.invalidate();
  }

  private wire(): void {
    this.root.addEventListener('click', (e) => {
      const t = e.target instanceof Element ? e.target : null;
      if (!t) return;
      const act = t.closest<HTMLElement>('[data-act]')?.dataset.act;
      if (act === 'toggle') { this.setOpen(!this.open); return; }
      if (act === 'copy-all') { void this.copyEverything(); return; }
      if (act === 'get') { void this.startFetch(); return; }
      const head = t.closest<HTMLElement>('.ft-meta-ghead');
      if (head) { this.toggleGroup(head.parentElement as HTMLElement); return; }
      const row = t.closest<HTMLElement>('.ft-meta-row');
      if (row) void this.copyRow(row);
    });
    this.root.addEventListener('keydown', (e) => {
      const t = e.target instanceof HTMLElement ? e.target : null;
      if (!t || (e.key !== 'Enter' && e.key !== ' ') || !t.classList.contains('ft-meta-row')) return;
      e.preventDefault();
      void this.copyRow(t);
    });
    this.filter.addEventListener('input', () => {
      window.clearTimeout(this.filterTimer);
      this.filterTimer = window.setTimeout(() => this.applyView(), 70);
    });
    this.filter.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key !== 'Escape') return;
      if (this.filter.value) {
        this.filter.value = '';
        this.applyView();
      } else {
        this.filter.blur();
      }
    });
  }

  private applyOpen(): void {
    if (this.toggleBtn.getAttribute('aria-expanded') !== String(this.open)) this.toggleBtn.setAttribute('aria-expanded', String(this.open));
    setClass(this.root, 'is-open', this.open);
    setHidden(this.body, !this.open);
    setHidden(q(this.root, '.ft-meta-filter-box'), !this.open);
  }

  private setOpen(on: boolean): void {
    if (this.open === on) return;
    this.open = on;
    writeStore(OPEN_KEY, on);
    this.applyOpen();
    if (on) {
      void this.load();
      return;
    }
    const e = this.entry;
    if (!e || this.shownKey !== keyOf(e)) this.invalidate();
    else this.settle();
  }

  private settle(): void {
    this.seq += 1;
    this.abort?.abort();
    this.abort = null;
    this.endBusy();
  }

  private invalidate(): void {
    this.settle();
    this.mode = 'idle';
    this.shownKey = null;
    this.result = null;
    this.groupItems = [];
    this.message = '';
    this.paintGroups([]);
    this.paintState();
    this.paintChrome();
    this.applyView();
  }

  private startBusy(): void {
    if (this.reading) return;
    this.reading = true;
    this.slowTimer = window.setTimeout(() => setClass(this.stage, 'is-slow', true), SLOW_MS);
    setClass(this.root, 'is-reading', true);
    this.paintChrome();
  }

  private endBusy(): void {
    if (!this.reading) return;
    window.clearTimeout(this.slowTimer);
    this.reading = false;
    setClass(this.stage, 'is-slow', false);
    setClass(this.root, 'is-reading', false);
    this.paintChrome();
  }

  private async load(): Promise<void> {
    const entry = this.entry;
    if (!entry || !this.open) return;
    const key = keyOf(entry);
    if (this.shownKey === key && this.mode === 'ready') { this.settle(); return; }
    const seq = ++this.seq;
    this.abort?.abort();
    this.abort = null;
    const cached = this.cache.get(key);
    if (cached) {
      this.endBusy();
      this.render(cached, key);
      return;
    }
    const ctl = new AbortController();
    this.abort = ctl;
    this.startBusy();
    try {
      const result = await exifApi.read(entry.path, { signal: ctl.signal });
      if (seq !== this.seq) return;
      this.cache.set(key, result);
      if (this.cache.size > CACHE_MAX) this.cache.delete(this.cache.keys().next().value as string);
      this.render(result, key);
    } catch (err) {
      if (seq !== this.seq) return;
      if (err instanceof ApiError && err.status === 415) {
        let status: ExifStatus | null = null;
        try { status = await exifApi.status(ctl.signal); } catch { status = null; }
        if (seq !== this.seq) return;
        this.fetchable = status === null || status.perl !== false;
        this.fail('unavailable', status?.error || err.message);
        if (status?.fetching) void this.resume(seq);
      } else {
        this.fail('error', err instanceof Error ? err.message : 'The metadata could not be read.');
      }
    } finally {
      if (seq === this.seq) this.endBusy();
    }
  }

  private fail(mode: 'unavailable' | 'error', message: string): void {
    this.mode = mode;
    this.shownKey = null;
    this.result = null;
    this.groupItems = [];
    this.message = message;
    this.paintGroups([]);
    this.paintState();
    this.paintChrome();
    this.applyView();
  }

  private render(result: ExifRead, key: string): void {
    const items = itemsOf(result.groups);
    const total = items.reduce((n, g) => n + g.rows.length, 0);
    this.result = result;
    this.groupItems = items;
    this.shownKey = key;
    this.message = total === 0 ? 'No metadata was found in this file.' : '';
    this.mode = total === 0 ? 'empty' : 'ready';
    this.paintGroups(total === 0 ? [] : items);
    const warning = result.warnings.find((w) => w) ?? '';
    setText(this.warnEl, warning);
    setHidden(this.warnEl, !warning);
    this.warnEl.title = clip(result.warnings.join('\n'), TITLE_MAX);
    this.paintState();
    this.paintChrome();
    this.applyView();
  }

  private paintGroups(items: GroupItem[]): void {
    const fillRows = (dl: HTMLElement, rows: RowItem[]): void => {
      patchList(dl, rows, {
        key: (r) => r.key,
        create: (r) => {
          const row = document.createElement('div');
          row.className = 'ft-meta-row';
          row.tabIndex = 0;
          row.setAttribute('role', 'button');
          row.append(document.createElement('dt'), document.createElement('dd'));
          this.fillRow(row, r);
          return row;
        },
        update: (row, r) => this.fillRow(row, r),
      });
    };
    patchList(this.groupsEl, items, {
      key: (g) => g.key,
      create: (g) => {
        const node = el<HTMLElement>(`<section class="ft-meta-group"><button class="ft-meta-ghead" type="button" aria-expanded="false"><span class="ft-meta-gchev">${icon('metaChevron', 12)}</span><span class="ft-meta-gname"></span><span class="ft-meta-gcount"></span></button><dl class="ft-meta-rows" hidden></dl></section>`);
        setText(q(node, '.ft-meta-gname'), g.name);
        fillRows(q(node, '.ft-meta-rows'), g.rows);
        return node;
      },
      update: (node, g) => {
        setText(q(node, '.ft-meta-gname'), g.name);
        fillRows(q(node, '.ft-meta-rows'), g.rows);
      },
    });
  }

  private fillRow(row: HTMLElement, r: RowItem): void {
    const dt = row.children[0], dd = row.children[1];
    setText(dt, r.label);
    setText(dd, r.shown);
    const title = r.full.length > CLAMP_TITLE_AT || r.label !== r.name ? `${r.name}\n${clip(r.full, TITLE_MAX)}` : r.name;
    if (row.title !== title) row.title = title;
    this.full.set(row, r.full);
    this.hay.set(row, `${r.label}\n${r.name}\n${clip(r.full, HAY_MAX)}`.toLowerCase());
  }

  private isOpen(key: string, index: number): boolean {
    return this.opened ? this.opened.has(key) : index < DEFAULT_OPEN;
  }

  private toggleGroup(node: HTMLElement): void {
    if (this.filter.value.trim()) return;
    const key = node.dataset.key ?? '';
    if (!this.opened) {
      this.opened = new Set(this.groupItems.filter((_, i) => i < DEFAULT_OPEN).map((g) => g.key));
    }
    if (this.opened.has(key)) this.opened.delete(key);
    else this.opened.add(key);
    writeStore(GROUPS_KEY, [...this.opened]);
    this.applyView();
  }

  private applyView(): void {
    const term = this.filter.value.trim().toLowerCase();
    const filtering = term !== '';
    let total = 0, shown = 0;
    const nodes = Array.from(this.groupsEl.children) as HTMLElement[];
    nodes.forEach((g, i) => {
      let vis = 0, all = 0;
      for (const r of Array.from(g.querySelectorAll<HTMLElement>('.ft-meta-row'))) {
        const hit = !filtering || (this.hay.get(r) ?? '').includes(term);
        setHidden(r, !hit);
        all += 1;
        if (hit) vis += 1;
      }
      total += all;
      shown += vis;
      const open = filtering ? vis > 0 : this.isOpen(g.dataset.key ?? '', i);
      setHidden(g, filtering && vis === 0);
      setHidden(q(g, '.ft-meta-rows'), !open);
      setClass(g, 'is-open', open);
      const head = q(g, '.ft-meta-ghead');
      if (head.getAttribute('aria-expanded') !== String(open)) head.setAttribute('aria-expanded', String(open));
      setText(q(g, '.ft-meta-gcount'), filtering ? `${vis} of ${all}` : String(all));
    });
    setClass(this.root, 'is-filtering', filtering);
    setText(this.countEl, this.mode === 'ready' ? (filtering ? `${shown} of ${total}` : String(total)) : '');
    setHidden(this.noMatch, !(this.mode === 'ready' && filtering && shown === 0));
  }

  private paintState(): void {
    const show = this.mode === 'unavailable' || this.mode === 'error' || this.mode === 'empty';
    setHidden(this.stateBox, !show);
    setHidden(this.groupsEl, this.mode !== 'ready');
    setText(this.msgEl, show ? this.message : '');
    setText(this.progEl, show && this.mode === 'unavailable' ? this.progress : '');
    setClass(this.progEl, 'is-error', this.progressFailed);
    setHidden(this.getBtn, this.mode !== 'unavailable');
    this.getBtn.disabled = this.fetching || !this.fetchable;
    this.getBtn.title = this.fetchable ? 'Download the official ExifTool into this computer’s data folder' : 'ExifTool needs Perl on this system';
    if (this.mode !== 'ready' && this.mode !== 'empty') setHidden(this.warnEl, true);
  }

  private paintChrome(): void {
    const ready = this.mode === 'ready' && !this.reading;
    this.copyAll.disabled = !ready;
    const canFilter = this.mode === 'ready';
    if (this.filter.disabled === canFilter) this.filter.disabled = !canFilter;
  }

  private async copyRow(row: HTMLElement): Promise<void> {
    if (this.reading || this.mode !== 'ready') return;
    const value = this.full.get(row) ?? '';
    const label = row.children[0]?.textContent ?? '';
    const ok = await copyText(value);
    if (ok) {
      setClass(row, 'is-copied', true);
      window.setTimeout(() => setClass(row, 'is-copied', false), 900);
    }
    toast(ok ? `Copied ${clip(label, 40)}.` : 'The value could not be copied.', ok ? 'info' : 'error', 1400);
  }

  private async copyEverything(): Promise<void> {
    if (this.reading || this.mode !== 'ready' || !this.result) return;
    const ok = await copyText(jsonOf(this.result, this.groupItems));
    toast(ok ? 'Copied all metadata as JSON.' : 'The metadata could not be copied.', ok ? 'info' : 'error', 1800);
  }

  private async startFetch(): Promise<void> {
    if (this.fetching || !this.fetchable) return;
    this.fetching = true;
    this.progressFailed = false;
    this.progress = 'Starting';
    this.paintState();
    try {
      const job = await exifApi.fetch();
      this.jobId = job.id;
      this.deps.jobs.track(job, (j) => this.onJob(j));
    } catch (err) {
      this.fetching = false;
      this.jobId = '';
      this.progressFailed = true;
      this.progress = err instanceof Error ? err.message : 'The download could not start.';
      this.paintState();
    }
  }

  private onJob(job: Job): void {
    if (job.id !== this.jobId) return;
    if (job.state === 'running') {
      this.progress = progressOf(job);
      this.progressFailed = false;
      this.paintState();
      return;
    }
    this.jobId = '';
    this.fetching = false;
    if (job.state === 'done') {
      this.progress = '';
      this.progressFailed = false;
      this.paintState();
      void this.load();
      return;
    }
    this.progressFailed = true;
    this.progress = job.state === 'failed' ? (job.errors[0]?.error ?? 'The ExifTool download failed.') : 'The ExifTool download was stopped.';
    this.paintState();
  }

  private async resume(seq: number): Promise<void> {
    if (this.fetching || this.jobId) return;
    try {
      const { jobs } = await api.jobs();
      if (seq !== this.seq || this.fetching || this.jobId) return;
      const job = jobs.find((j) => j.kind === 'exiftool-fetch' && j.state === 'running');
      if (!job) return;
      this.fetching = true;
      this.jobId = job.id;
      this.progress = progressOf(job);
      this.paintState();
      this.deps.jobs.track(job, (j) => this.onJob(j));
    } catch {
      return;
    }
  }
}

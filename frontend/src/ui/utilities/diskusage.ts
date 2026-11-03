import { api } from '../../io/api';
import { baseName, fmtBytes, utilApi, type UsageNode, type UsageResult } from '../../io/util-api';
import { el, escapeHtml, patchList, q, setClass, setHidden, setStyleVar, setText, setValue } from '../dom';
import { icon } from '../icons';
import { toast } from '../toast';
import { progressText, RunButton, track, type UtilDeps } from './common';
import { squarify } from './treemap';

interface Cell { node: UsageNode; key: string; share: number }

const keyOf = (n: UsageNode, i: number): string => n.path ?? `${n.name}#${i}`;

export class DiskUsageView {
  readonly root = el<HTMLElement>(`<div class="ft-util-view ft-du" data-util="disk" hidden>
      <div class="ft-du-bar">
        <input type="text" class="ft-input ft-du-path" spellcheck="false" placeholder="Folder to measure" aria-label="Folder to measure">
        <button class="ft-btn" type="button" data-du="here">Current folder</button>
        <label class="ft-du-hidden"><input type="checkbox" class="ft-check" data-du="hidden"> Hidden files</label>
        <span class="ft-run-state"></span>
        <button class="ft-btn is-primary" type="button" data-u="run" data-mode="run">${icon('ftScan', 14)} <span class="ft-u-run-label">Measure</span></button>
      </div>
      <nav class="ft-du-crumbs" aria-label="Folder path"></nav>
      <div class="ft-du-body">
        <div class="ft-du-map" role="img" aria-label="Treemap of folder sizes"><p class="ft-note ft-du-empty">Measure a folder to see what takes the space. Click a block to go inside it.</p></div>
        <section class="ft-panel ft-du-side">
          <header class="ft-panel-head"><span class="ft-panel-title ft-du-title">Largest items</span><span class="ft-panel-count ft-du-total"></span></header>
          <div class="ft-du-list" role="list"></div>
        </section>
      </div>
    </div>`);
  private tree: UsageResult | null = null;
  private trail: UsageNode[] = [];
  private cells: Cell[] = [];
  private readonly map = q(this.root, '.ft-du-map');
  private readonly run: RunButton;

  constructor(private readonly deps: UtilDeps) {
    this.run = new RunButton(this.root, 'Measure', (id) => void api.cancelJob(id).catch(() => undefined));
    const path = q<HTMLInputElement>(this.root, '.ft-du-path');
    path.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); void this.scan(); } });
    this.root.addEventListener('click', (e) => {
      const t = e.target instanceof Element ? e.target : null;
      if (t?.closest('[data-u="run"]')) { if (this.run.busy) this.run.stop(); else void this.scan(); return; }
      if (t?.closest('[data-du="here"]')) { path.value = this.deps.folder(); return; }
      const crumb = t?.closest<HTMLElement>('[data-crumb]')?.dataset.crumb;
      if (crumb !== undefined) { this.trail = this.trail.slice(0, Number(crumb) + 1); this.draw(); return; }
      const rev = t?.closest<HTMLElement>('[data-reveal]')?.dataset.reveal;
      if (rev) { this.deps.reveal(rev); return; }
      const cell = t?.closest<HTMLElement>('[data-cell]')?.dataset.cell;
      if (cell) this.enter(cell);
    });
    new ResizeObserver(() => this.layout()).observe(this.map);
  }

  show(inputs?: string[]): void {
    const p = q<HTMLInputElement>(this.root, '.ft-du-path');
    if (!p.value) setValue(p, inputs?.[0] ?? this.deps.folder());
  }

  private async scan(): Promise<void> {
    const root = q<HTMLInputElement>(this.root, '.ft-du-path').value.trim();
    if (!root) { toast('Type a folder path first.', 'error'); return; }
    const state = q(this.root, '.ft-run-state');
    try {
      const job = await utilApi.diskUsage(root, q<HTMLInputElement>(this.root, '[data-du="hidden"]').checked);
      this.run.start(job);
      const end = await track(this.deps.jobs, job, (j) => setText(state, progressText(j, 'items')));
      this.run.finish();
      if (end.state !== 'done') return;
      this.tree = end.result as UsageResult;
      this.trail = [this.tree];
      const errs = this.tree.errors ?? 0;
      setText(state, errs ? `${errs.toLocaleString()} folders could not be read` : '');
      this.draw();
    } catch (e) { this.run.finish(); toast(e instanceof Error ? e.message : 'The scan did not start.', 'error'); }
  }

  private enter(key: string): void {
    const cell = this.cells.find((c) => c.key === key);
    if (!cell || cell.node.other || !cell.node.children?.length) return;
    this.trail.push(cell.node);
    this.draw();
  }

  private draw(): void {
    const here = this.trail[this.trail.length - 1];
    setHidden(q(this.map, '.ft-du-empty'), !!here);
    if (!here) return;
    const last = this.trail.length - 1;
    patchList(q(this.root, '.ft-du-crumbs'), this.trail.map((n, i) => ({ n, i })), {
      key: ({ n, i }) => `${i}:${keyOf(n, i)}`,
      create: ({ n, i }) => { const b = el<HTMLElement>(`<button type="button" class="ft-du-crumb" data-crumb="${i}"></button>`); setText(b, i === 0 ? (n.path ?? n.name) : n.name); setClass(b, 'is-last', i === last); return b; },
      update: (b, { i }) => setClass(b, 'is-last', i === last),
    });
    const kids = [...(here.children ?? [])].filter((c) => c.size > 0).sort((a, b) => b.size - a.size);
    this.cells = kids.map((n, i) => ({ node: n, key: keyOf(n, i), share: here.size ? n.size / here.size : 0 }));
    setText(q(this.root, '.ft-du-title'), here.name || 'Largest items');
    setText(q(this.root, '.ft-du-total'), `${fmtBytes(here.size)}${here.files !== undefined ? ` · ${here.files.toLocaleString()} files` : ''}`);
    patchList(this.map, this.cells, {
      key: (c) => c.key,
      create: (c) => {
        const n = el<HTMLElement>(`<button type="button" class="ft-du-cell" data-cell="${escapeHtml(c.key)}"><span class="ft-du-cname"></span><span class="ft-du-csize"></span></button>`);
        this.paintCell(n, c);
        return n;
      },
      update: (n, c) => this.paintCell(n, c),
    });
    patchList(q(this.root, '.ft-du-list'), this.cells.slice(0, 200), {
      key: (c) => c.key,
      create: (c) => {
        const r = el<HTMLElement>(`<div class="ft-du-row" role="listitem"><button type="button" class="ft-du-rmain" data-cell="${escapeHtml(c.key)}"><span class="ft-du-rname"></span><span class="ft-du-rsize"></span><span class="ft-du-rbar"><i></i></span></button>${c.node.path && !c.node.other ? `<button class="cv-tt-btn" type="button" data-reveal="${escapeHtml(c.node.path)}" title="Show in folder" aria-label="Show in folder">${icon('folderOpen', 14)}</button>` : ''}</div>`);
        this.paintRow(r, c);
        return r;
      },
      update: (r, c) => this.paintRow(r, c),
    });
    this.layout();
  }

  private paintCell(n: HTMLElement, c: Cell): void {
    setText(q(n, '.ft-du-cname'), c.node.name || baseName(c.node.path ?? ''));
    setText(q(n, '.ft-du-csize'), fmtBytes(c.node.size));
    setClass(n, 'is-dir', !!c.node.children?.length);
    setClass(n, 'is-other', !!c.node.other);
    n.title = `${c.node.path ?? c.node.name}\n${fmtBytes(c.node.size)} · ${(c.share * 100).toFixed(1)}%`;
  }

  private paintRow(r: HTMLElement, c: Cell): void {
    setText(q(r, '.ft-du-rname'), c.node.name);
    setText(q(r, '.ft-du-rsize'), `${fmtBytes(c.node.size)} · ${(c.share * 100).toFixed(1)}%`);
    setStyleVar(q(r, '.ft-du-rbar'), '--share', `${Math.max(0.5, c.share * 100).toFixed(2)}%`);
    setClass(r, 'is-dir', !!c.node.children?.length);
  }

  private layout(): void {
    if (!this.cells.length) return;
    const w = this.map.clientWidth, h = this.map.clientHeight;
    const rects = squarify(this.cells.map((c) => c.node.size), { x: 0, y: 0, w, h });
    const nodes = this.map.querySelectorAll<HTMLElement>('.ft-du-cell');
    nodes.forEach((n, i) => {
      const r = rects[i];
      if (!r) return;
      setStyleVar(n, '--x', `${r.x.toFixed(1)}px`);
      setStyleVar(n, '--y', `${r.y.toFixed(1)}px`);
      setStyleVar(n, '--w', `${Math.max(0, r.w).toFixed(1)}px`);
      setStyleVar(n, '--h', `${Math.max(0, r.h).toFixed(1)}px`);
      setClass(n, 'is-tiny', r.w < 56 || r.h < 34);
    });
  }
}

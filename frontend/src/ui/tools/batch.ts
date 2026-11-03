import { api, type ActionDef, type ActionUse, type BatchInputs, type PlanItem, type Preset } from '../../io/api';
import { el, escapeHtml, patchList, q, setClass, setHidden, setText, setValue } from '../dom';
import { icon } from '../icons';
import { toast } from '../toast';
import type { Jobs } from '../jobs';
import { fieldFor, readFields } from './fields';
import { InputList } from './inputs';
import { OutputPanel } from './output';

interface Card { uid: string; def: ActionDef; node: HTMLElement }

const base = (p: string): string => p.split(/[\\/]/).pop() || p;
let uidSeq = 0;

export class BatchTool {
  readonly root = el<HTMLElement>(`<div class="ft-tool-page" data-tool="convert">
      <div class="ft-tool-col ft-tool-left"></div>
      <div class="ft-tool-col ft-tool-mid">
        <section class="ft-panel">
          <header class="ft-panel-head"><span class="ft-panel-title">Actions</span><span class="ft-panel-count ft-actions-count"></span></header>
          <div class="ft-row"><select class="cv-hf-sort ft-add-action" aria-label="Add an action"><option value="">Add an action...</option></select></div>
          <div class="ft-cards"></div>
          <p class="ft-note ft-cards-empty">No actions: files are only converted to the output format.</p>
        </section>
        <section class="ft-panel">
          <header class="ft-panel-head"><span class="ft-panel-title">Presets</span></header>
          <div class="ft-row"><select class="cv-hf-sort ft-presets" aria-label="Presets"><option value="">Choose a preset...</option></select>
            <span class="ft-row-btns"><button class="ft-btn" type="button" data-b="save-preset">Save as preset</button><button class="ft-btn" type="button" data-b="delete-preset">Delete</button></span></div>
        </section>
      </div>
      <div class="ft-tool-col ft-tool-right">
        <section class="ft-panel ft-preview">
          <header class="ft-panel-head"><span class="ft-panel-title">Preview</span><span class="ft-preview-name"></span>
            <span class="ft-seg"><button type="button" class="ft-seg-btn is-on" data-pv="after">After</button><button type="button" class="ft-seg-btn" data-pv="before">Before</button></span></header>
          <div class="ft-preview-box"><img class="ft-preview-img" alt="" hidden><span class="ft-preview-msg">Add files to see a preview.</span><span class="ft-busy ft-preview-busy"></span></div>
        </section>
        <div class="ft-output-slot"></div>
        <section class="ft-panel ft-plan" hidden>
          <header class="ft-panel-head"><span class="ft-panel-title">Plan</span><span class="ft-panel-count ft-plan-count"></span></header>
          <div class="ft-plan-rows"></div>
        </section>
        <div class="ft-run-bar"><button class="ft-btn" type="button" data-b="plan">Check names</button><button class="ft-btn is-primary" type="button" data-b="run">${icon('ftBatch', 14)} Convert</button><span class="ft-run-state"></span></div>
      </div>
    </div>`);
  readonly inputs: InputList;
  readonly output = new OutputPanel();
  private defs: ActionDef[] = [];
  private cards: Card[] = [];
  private previewTimer = 0;
  private previewSeq = 0;
  private previewUrl = '';
  private showBefore = false;
  private presets: Preset[] = [];

  constructor(fromSelection: () => string[], private readonly jobs: Jobs, private readonly done: () => void) {
    this.inputs = new InputList(fromSelection);
    q(this.root, '.ft-tool-left').appendChild(this.inputs.root);
    q(this.root, '.ft-output-slot').replaceWith(this.output.root);
    this.inputs.onChange(() => { this.queuePreview(); setHidden(q(this.root, '.ft-plan'), true); });
    this.output.onChange(() => setHidden(q(this.root, '.ft-plan'), true));
    q<HTMLSelectElement>(this.root, '.ft-add-action').addEventListener('change', (e) => {
      const s = e.target as HTMLSelectElement;
      const def = this.defs.find((d) => d.id === s.value);
      s.value = '';
      if (def) { this.addCard(def, {}); this.queuePreview(); }
    });
    q(this.root, '.ft-cards').addEventListener('click', (e) => {
      const t = e.target instanceof Element ? e.target : null;
      const btn = t?.closest<HTMLElement>('[data-card]');
      const card = btn ? this.cards.find((c) => c.uid === btn.closest<HTMLElement>('.ft-card')?.dataset.key) : null;
      if (!btn || !card) return;
      const i = this.cards.indexOf(card);
      if (btn.dataset.card === 'remove') this.cards.splice(i, 1);
      else if (btn.dataset.card === 'up' && i > 0) [this.cards[i - 1], this.cards[i]] = [this.cards[i], this.cards[i - 1]];
      else if (btn.dataset.card === 'down' && i < this.cards.length - 1) [this.cards[i + 1], this.cards[i]] = [this.cards[i], this.cards[i + 1]];
      this.paintCards();
      this.queuePreview();
    });
    q(this.root, '.ft-cards').addEventListener('input', () => this.queuePreview());
    q(this.root, '.ft-cards').addEventListener('change', () => this.queuePreview());
    q(this.root, '.ft-preview').addEventListener('click', (e) => {
      const pv = (e.target instanceof Element ? e.target.closest<HTMLElement>('[data-pv]') : null)?.dataset.pv;
      if (!pv) return;
      this.showBefore = pv === 'before';
      for (const b of this.root.querySelectorAll<HTMLElement>('[data-pv]')) setClass(b, 'is-on', b.dataset.pv === pv);
      this.queuePreview(0);
    });
    q<HTMLSelectElement>(this.root, '.ft-presets').addEventListener('change', (e) => this.loadPreset((e.target as HTMLSelectElement).value));
    this.root.addEventListener('click', (e) => {
      const b = (e.target instanceof Element ? e.target.closest<HTMLElement>('[data-b]') : null)?.dataset.b;
      if (b === 'plan') void this.plan();
      else if (b === 'run') void this.run();
      else if (b === 'save-preset') void this.savePreset();
      else if (b === 'delete-preset') void this.deletePreset();
    });
  }

  async start(): Promise<void> {
    if (this.defs.length) return;
    try {
      const r = await api.batchActions();
      this.defs = r.actions;
      const sel = q<HTMLSelectElement>(this.root, '.ft-add-action');
      const groups = [...new Set(this.defs.map((d) => d.group))];
      for (const g of groups) {
        const og = document.createElement('optgroup');
        og.label = g;
        for (const d of this.defs.filter((x) => x.group === g)) { const o = document.createElement('option'); o.value = d.id; o.textContent = d.label; og.appendChild(o); }
        sel.appendChild(og);
      }
      await this.refreshPresets();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'The batch tools are not available.', 'error');
    }
  }

  private addCard(def: ActionDef, params: Record<string, unknown>): void {
    const uid = `c${++uidSeq}`;
    const node = el<HTMLElement>(`<div class="ft-card"><header class="ft-card-head"><span class="ft-card-title">${escapeHtml(def.label)}</span>
        <button class="ft-icon-x" type="button" data-card="up" aria-label="Move up">${icon('chevronUp', 12)}</button>
        <button class="ft-icon-x" type="button" data-card="down" aria-label="Move down">${icon('chevronDown', 12)}</button>
        <button class="ft-icon-x" type="button" data-card="remove" aria-label="Remove">${icon('close', 12)}</button></header><div class="ft-card-body"></div></div>`);
    const body = q(node, '.ft-card-body');
    for (const p of def.params) body.appendChild(fieldFor(p, params[p.key]));
    node.dataset.key = uid;
    this.cards.push({ uid, def, node });
    this.paintCards();
  }

  private paintCards(): void {
    patchList(q(this.root, '.ft-cards'), this.cards, { key: (c) => c.uid, create: (c) => c.node, update: () => undefined });
    setText(q(this.root, '.ft-actions-count'), this.cards.length ? String(this.cards.length) : '');
    setHidden(q(this.root, '.ft-cards-empty'), this.cards.length > 0);
  }

  private get actions(): ActionUse[] { return this.cards.map((c) => ({ id: c.def.id, params: readFields(q(c.node, '.ft-card-body')) })); }

  private get batchInputs(): BatchInputs { return { inputs: this.inputs.value, recursive: this.inputs.recursive, extensions: [] }; }

  private queuePreview(delay = 400): void {
    window.clearTimeout(this.previewTimer);
    this.previewTimer = window.setTimeout(() => void this.preview(), delay);
  }

  private async preview(): Promise<void> {
    const seq = ++this.previewSeq;
    const img = q<HTMLImageElement>(this.root, '.ft-preview-img');
    const msg = q(this.root, '.ft-preview-msg');
    const busy = q(this.root, '.ft-preview-busy');
    let first = this.inputs.value[0];
    if (first) {
      try { const l = await api.list(first); first = l.entries.find((e) => e.kind === 'file' && (e.type === 'image' || e.type === 'family'))?.path ?? ''; } catch { }
    }
    if (seq !== this.previewSeq) return;
    if (!first) { setHidden(img, true); setText(msg, 'Add files to see a preview.'); setHidden(msg, false); return; }
    setText(q(this.root, '.ft-preview-name'), base(first));
    setClass(busy, 'is-on', true);
    try {
      const url = await api.batchPreviewUrl(first, this.showBefore ? [] : this.actions, 900);
      if (seq !== this.previewSeq) { URL.revokeObjectURL(url); return; }
      const probe = new Image();
      probe.onload = () => {
        if (seq !== this.previewSeq) { URL.revokeObjectURL(url); return; }
        const old = this.previewUrl;
        img.src = url;
        this.previewUrl = url;
        if (old) URL.revokeObjectURL(old);
        setHidden(img, false);
        setHidden(msg, true);
        setClass(busy, 'is-on', false);
      };
      probe.src = url;
    } catch (e) {
      if (seq !== this.previewSeq) return;
      setText(msg, e instanceof Error ? e.message : 'No preview.');
      setHidden(msg, false);
      setClass(busy, 'is-on', false);
    }
  }

  private async plan(): Promise<PlanItem[] | null> {
    if (!this.inputs.value.length) { toast('Add files or a folder first.', 'error'); return null; }
    try {
      const r = await api.batchPlan(this.batchInputs, this.output.value, this.actions);
      const panel = q(this.root, '.ft-plan');
      const bad = r.items.filter((i) => i.conflict !== 'none').length;
      setText(q(this.root, '.ft-plan-count'), `${r.items.length} files${bad ? `, ${bad} name conflicts` : ''}${r.skipped.length ? `, ${r.skipped.length} skipped` : ''}`);
      const update = (n: HTMLElement, i: PlanItem): void => {
        setText(q(n, '.ft-plan-src'), base(i.src));
        setText(q(n, '.ft-plan-dst'), i.dst);
        n.dataset.conflict = i.conflict;
      };
      patchList(q(this.root, '.ft-plan-rows'), r.items.slice(0, 200), {
        key: (i) => i.src,
        create: (i) => { const n = el<HTMLElement>(`<div class="ft-plan-row"><span class="ft-plan-src"></span>${icon('chevronRight', 12)}<span class="ft-plan-dst"></span></div>`); update(n, i); return n; },
        update,
      });
      setHidden(panel, false);
      return r.items;
    } catch (e) {
      toast(e instanceof Error ? e.message : 'The plan failed.', 'error');
      return null;
    }
  }

  private async run(): Promise<void> {
    if (!this.inputs.value.length) { toast('Add files or a folder first.', 'error'); return; }
    const state = q(this.root, '.ft-run-state');
    const btn = q<HTMLButtonElement>(this.root, '[data-b="run"]');
    try {
      btn.disabled = true;
      const job = await api.batchRun(this.batchInputs, this.actions, this.output.value);
      this.jobs.track(job, (j) => {
        setText(state, j.state === 'running' ? `${j.done} of ${j.total}` : j.state === 'done' ? `Done: ${j.done} files${j.errors.length ? `, ${j.errors.length} errors` : ''}` : j.state === 'failed' ? 'Failed' : 'Stopped');
        if (j.state !== 'running') { btn.disabled = false; this.done(); }
      });
    } catch (e) {
      btn.disabled = false;
      toast(e instanceof Error ? e.message : 'The conversion did not start.', 'error');
    }
  }

  private async refreshPresets(): Promise<void> {
    const r = await api.presets();
    this.presets = r.presets;
    const sel = q<HTMLSelectElement>(this.root, '.ft-presets');
    while (sel.options.length > 1) sel.remove(1);
    for (const p of this.presets) { const o = document.createElement('option'); o.value = p.name; o.textContent = p.name; sel.appendChild(o); }
  }

  private loadPreset(name: string): void {
    const p = this.presets.find((x) => x.name === name);
    if (!p) return;
    this.cards = [];
    for (const a of p.actions) { const def = this.defs.find((d) => d.id === a.id); if (def) this.addCard(def, a.params); }
    this.paintCards();
    this.output.set(p.output);
    this.queuePreview(0);
  }

  private async savePreset(): Promise<void> {
    const name = window.prompt('Preset name', q<HTMLSelectElement>(this.root, '.ft-presets').value || '')?.trim();
    if (!name) return;
    try {
      await api.savePreset(name, this.actions, this.output.value);
      await this.refreshPresets();
      setValue(q(this.root, '.ft-presets'), name);
      toast(`Saved the preset ${name}.`);
    } catch (e) { toast(e instanceof Error ? e.message : 'The preset was not saved.', 'error'); }
  }

  private async deletePreset(): Promise<void> {
    const name = q<HTMLSelectElement>(this.root, '.ft-presets').value;
    if (!name) return;
    try { await api.deletePreset(name); await this.refreshPresets(); toast(`Deleted the preset ${name}.`); } catch (e) { toast(e instanceof Error ? e.message : 'The preset was not deleted.', 'error'); }
  }

  useActions(actions: ActionUse[]): void {
    this.cards = [];
    for (const a of actions) { const def = this.defs.find((d) => d.id === a.id); if (def) this.addCard(def, a.params); }
    this.paintCards();
    this.queuePreview(0);
  }
}

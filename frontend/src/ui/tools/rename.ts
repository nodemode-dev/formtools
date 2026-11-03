import { api, type PlanItem, type RenameRule } from '../../io/api';
import { el, escapeHtml, patchList, q, setHidden, setText } from '../dom';
import { icon } from '../icons';
import { toast } from '../toast';
import { fieldFor, readFields } from './fields';
import { InputList } from './inputs';
import type { ActionParam } from '../../io/api';

const POS: Array<[string, string]> = [['start', 'At the start'], ['end', 'At the end']];

const RULES: Record<string, { label: string; params: ActionParam[] }> = {
  replace: { label: 'Find and replace', params: [
    { key: 'find', label: 'Find', type: 'text', default: '' }, { key: 'replace', label: 'Replace with', type: 'text', default: '' },
    { key: 'regex', label: 'Regular expression', type: 'bool', default: false }, { key: 'case', label: 'Match case', type: 'bool', default: false },
    { key: 'all', label: 'Every match', type: 'bool', default: true },
    { key: 'scope', label: 'Apply to', type: 'choice', default: 'name', options: [['name', 'Name'], ['ext', 'Extension'], ['both', 'Name and extension']] },
  ] },
  case: { label: 'Change case', params: [{ key: 'mode', label: 'Case', type: 'choice', default: 'lower', options: [['lower', 'lower case'], ['upper', 'UPPER CASE'], ['title', 'Title Case'], ['sentence', 'Sentence case']] }] },
  insert: { label: 'Insert text', params: [{ key: 'text', label: 'Text', type: 'text', default: '' }, { key: 'position', label: 'Where', type: 'choice', default: 'end', options: POS }] },
  remove: { label: 'Remove characters', params: [{ key: 'from', label: 'From position', type: 'int', min: 0, default: 0 }, { key: 'count', label: 'Count', type: 'int', min: 1, default: 1 }] },
  counter: { label: 'Number', params: [
    { key: 'start', label: 'Start at', type: 'int', default: 1 }, { key: 'step', label: 'Step', type: 'int', default: 1 }, { key: 'pad', label: 'Digits', type: 'int', min: 1, max: 9, default: 3 },
    { key: 'position', label: 'Where', type: 'choice', default: 'end', options: POS }, { key: 'separator', label: 'Separator', type: 'text', default: '_' },
  ] },
  date: { label: 'Date', params: [
    { key: 'source', label: 'From', type: 'choice', default: 'exif', options: [['exif', 'Date taken (EXIF)'], ['mtime', 'Date modified']] },
    { key: 'format', label: 'Format', type: 'text', default: '%Y-%m-%d' }, { key: 'position', label: 'Where', type: 'choice', default: 'start', options: POS }, { key: 'separator', label: 'Separator', type: 'text', default: ' ' },
  ] },
  trim: { label: 'Tidy spaces and separators', params: [] },
  extension: { label: 'Extension', params: [{ key: 'mode', label: 'Change', type: 'choice', default: 'lower', options: [['lower', 'to lower case'], ['upper', 'to upper case'], ['set', 'to a new one']] }, { key: 'value', label: 'New extension', type: 'text', default: '' }] },
};

interface Card { uid: string; type: string; node: HTMLElement }
let uidSeq = 0;
const base = (p: string): string => p.split(/[\\/]/).pop() || p;

export class RenameTool {
  readonly root = el<HTMLElement>(`<div class="ft-tool-page" data-tool="rename">
      <div class="ft-tool-col ft-tool-left"></div>
      <div class="ft-tool-col ft-tool-mid">
        <section class="ft-panel">
          <header class="ft-panel-head"><span class="ft-panel-title">Rules</span></header>
          <div class="ft-row"><select class="cv-hf-sort ft-add-rule" aria-label="Add a rule"><option value="">Add a rule...</option>${Object.entries(RULES).map(([k, r]) => `<option value="${k}">${r.label}</option>`).join('')}</select></div>
          <div class="ft-cards"></div>
          <p class="ft-note ft-cards-empty">Add a rule; the new names appear on the right as you type.</p>
        </section>
      </div>
      <div class="ft-tool-col ft-tool-right">
        <section class="ft-panel ft-plan">
          <header class="ft-panel-head"><span class="ft-panel-title">New names</span><span class="ft-panel-count ft-plan-count"></span></header>
          <div class="ft-plan-rows"></div>
        </section>
        <div class="ft-run-bar"><button class="ft-btn" type="button" data-n="undo" disabled>${icon('ftUndo', 14)} Undo the last rename</button><button class="ft-btn is-primary" type="button" data-n="apply">${icon('ftRename', 14)} Rename</button><span class="ft-run-state"></span></div>
      </div>
    </div>`);
  readonly inputs: InputList;
  private cards: Card[] = [];
  private timer = 0;
  private seq = 0;
  private items: PlanItem[] = [];
  private undo = '';
  private applied: Array<[string, string]> = [];

  constructor(fromSelection: () => string[], private readonly done: () => void) {
    this.inputs = new InputList(fromSelection, false);
    q(this.root, '.ft-tool-left').appendChild(this.inputs.root);
    this.inputs.onChange(() => this.queue());
    q<HTMLSelectElement>(this.root, '.ft-add-rule').addEventListener('change', (e) => {
      const s = e.target as HTMLSelectElement;
      if (s.value) this.addCard(s.value);
      s.value = '';
      this.queue();
    });
    const cards = q(this.root, '.ft-cards');
    cards.addEventListener('input', () => this.queue());
    cards.addEventListener('change', () => this.queue());
    cards.addEventListener('click', (e) => {
      const btn = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-card]') : null;
      const card = btn ? this.cards.find((c) => c.uid === btn.closest<HTMLElement>('.ft-card')?.dataset.key) : null;
      if (!btn || !card) return;
      const i = this.cards.indexOf(card);
      if (btn.dataset.card === 'remove') this.cards.splice(i, 1);
      else if (btn.dataset.card === 'up' && i > 0) [this.cards[i - 1], this.cards[i]] = [this.cards[i], this.cards[i - 1]];
      else if (btn.dataset.card === 'down' && i < this.cards.length - 1) [this.cards[i + 1], this.cards[i]] = [this.cards[i], this.cards[i + 1]];
      this.paint();
      this.queue();
    });
    this.root.addEventListener('click', (e) => {
      const n = (e.target instanceof Element ? e.target.closest<HTMLElement>('[data-n]') : null)?.dataset.n;
      if (n === 'apply') void this.apply();
      else if (n === 'undo') void this.revert();
    });
  }

  private addCard(type: string): void {
    const spec = RULES[type];
    const uid = `r${++uidSeq}`;
    const node = el<HTMLElement>(`<div class="ft-card"><header class="ft-card-head"><span class="ft-card-title">${escapeHtml(spec.label)}</span>
        <button class="ft-icon-x" type="button" data-card="up" aria-label="Move up">${icon('chevronUp', 12)}</button>
        <button class="ft-icon-x" type="button" data-card="down" aria-label="Move down">${icon('chevronDown', 12)}</button>
        <button class="ft-icon-x" type="button" data-card="remove" aria-label="Remove">${icon('close', 12)}</button></header><div class="ft-card-body"></div></div>`);
    for (const p of spec.params) q(node, '.ft-card-body').appendChild(fieldFor(p, undefined));
    node.dataset.key = uid;
    this.cards.push({ uid, type, node });
    this.paint();
  }

  private paint(): void {
    patchList(q(this.root, '.ft-cards'), this.cards, { key: (c) => c.uid, create: (c) => c.node, update: () => undefined });
    setHidden(q(this.root, '.ft-cards-empty'), this.cards.length > 0);
  }

  private get rules(): RenameRule[] { return this.cards.map((c) => ({ type: c.type, ...readFields(q(c.node, '.ft-card-body')) })); }

  private queue(): void {
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.plan(), 200);
  }

  private async plan(): Promise<void> {
    const seq = ++this.seq;
    const paths = this.inputs.value;
    if (!paths.length) { this.items = []; this.renderPlan(); return; }
    try {
      const r = await api.renamePlan(paths, this.rules);
      if (seq !== this.seq) return;
      this.items = r.items;
      this.renderPlan();
    } catch (e) {
      if (seq !== this.seq) return;
      setText(q(this.root, '.ft-plan-count'), e instanceof Error ? e.message : 'The rules have an error.');
    }
  }

  private renderPlan(): void {
    const changed = this.items.filter((i) => i.changed).length;
    const bad = this.items.filter((i) => i.conflict !== 'none').length;
    setText(q(this.root, '.ft-plan-count'), this.items.length ? `${changed} of ${this.items.length} change${bad ? `, ${bad} conflicts` : ''}` : '');
    const update = (n: HTMLElement, i: PlanItem): void => {
      setText(q(n, '.ft-plan-src'), base(i.src));
      setText(q(n, '.ft-plan-dst'), base(i.dst));
      n.dataset.conflict = i.conflict;
      n.dataset.changed = String(!!i.changed);
    };
    patchList(q(this.root, '.ft-plan-rows'), this.items.slice(0, 500), {
      key: (i) => i.src,
      create: (i) => { const n = el<HTMLElement>(`<div class="ft-plan-row"><span class="ft-plan-src"></span>${icon('chevronRight', 12)}<span class="ft-plan-dst"></span></div>`); update(n, i); return n; },
      update,
    });
    q<HTMLButtonElement>(this.root, '[data-n="apply"]').disabled = !changed || bad > 0;
  }

  private async apply(): Promise<void> {
    try {
      const r = await api.renameApply(this.inputs.value, this.rules);
      this.undo = r.undo;
      q<HTMLButtonElement>(this.root, '[data-n="undo"]').disabled = false;
      toast(`Renamed ${r.renamed} item${r.renamed === 1 ? '' : 's'}.`);
      this.applied = this.items.map((i) => [i.src, i.dst]);
      const map = new Map(this.applied);
      this.inputs.set(this.inputs.value.map((p) => map.get(p) ?? p));
      this.cards = [];
      this.paint();
      this.done();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nothing was renamed.', 'error');
    }
  }

  private async revert(): Promise<void> {
    if (!this.undo) return;
    try {
      await api.renameUndo(this.undo);
      const back = new Map(this.applied.map(([src, dst]) => [dst, src]));
      this.inputs.set(this.inputs.value.map((p) => back.get(p) ?? p));
      this.undo = '';
      q<HTMLButtonElement>(this.root, '[data-n="undo"]').disabled = true;
      toast('The rename was undone.');
      this.done();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'The rename could not be undone.', 'error');
    }
  }
}

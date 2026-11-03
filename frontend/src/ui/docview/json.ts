import type { Entry } from '../../io/api';
import { docApi } from '../../io/doc-api';
import { el, q, setClass, setHidden, setText } from '../dom';
import { icon } from '../icons';
import './icons';
import { Seq, busy, copyText, errText, fmtInt } from './common';
import { TextView } from './text';
import type { DocDeps, DocKind } from './types';

const PAGE = 100;
const IDENT = /^[A-Za-z_$][\w$]*$/;

interface NodeInfo { value: unknown; path: string; shown: number; open: boolean }

const isContainer = (v: unknown): v is object => typeof v === 'object' && v !== null;
const sizeOf = (v: object): number => (Array.isArray(v) ? v.length : Object.keys(v).length);
const childPath = (path: string, key: string | number): string =>
  typeof key === 'number' ? `${path}[${key}]` : IDENT.test(key) ? `${path}.${key}` : `${path}[${JSON.stringify(key)}]`;

function preview(v: unknown): { text: string; cls: string } {
  if (v === null) return { text: 'null', cls: 'is-null' };
  if (Array.isArray(v)) return { text: v.length ? `[ ${fmtInt(v.length)} item${v.length === 1 ? '' : 's'} ]` : '[ ]', cls: 'is-meta' };
  if (typeof v === 'object') { const n = Object.keys(v as object).length; return { text: n ? `{ ${fmtInt(n)} key${n === 1 ? '' : 's'} }` : '{ }', cls: 'is-meta' }; }
  if (typeof v === 'string') return { text: JSON.stringify(v.length > 240 ? `${v.slice(0, 240)}...` : v), cls: 'is-str' };
  if (typeof v === 'number') return { text: String(v), cls: 'is-num' };
  return { text: String(v), cls: 'is-bool' };
}

export class JsonView implements DocKind {
  readonly root = el<HTMLElement>(`<section class="dv-panel dv-json" hidden>
      <div class="dv-bar">
        <span class="ft-seg" role="tablist">
          <button class="ft-seg-btn is-on" type="button" data-j="tree">${icon('dvTree', 14)}Tree</button>
          <button class="ft-seg-btn" type="button" data-j="text">${icon('ftCode', 14)}Text</button>
        </span>
        <button class="cv-tt-btn" type="button" data-j="expand" title="Expand the first levels" aria-label="Expand">${icon('dvExpand', 16)}</button>
        <button class="cv-tt-btn" type="button" data-j="collapse" title="Collapse all" aria-label="Collapse all">${icon('dvCollapse', 16)}</button>
        <input class="ft-input ft-mono dv-path" type="text" readonly aria-label="Selected path" placeholder="Select a node to see its path">
        <button class="cv-tt-btn" type="button" data-j="copy-path" title="Copy the path" aria-label="Copy the path">${icon('dvCopy', 16)}</button>
        <button class="cv-tt-btn" type="button" data-j="copy-value" title="Copy the value as JSON" aria-label="Copy the value">${icon('ftText', 16)}</button>
        <span class="dv-gap"></span>
        <span class="dv-note"></span>
        <span class="dv-info"></span>
        <span class="ft-busy dv-spin"></span>
      </div>
      <div class="dv-jscroll"><div class="dv-jtree" role="tree"></div></div>
    </section>`);
  private readonly text: TextView;
  private readonly tree = q(this.root, '.dv-jtree');
  private readonly scroll = q(this.root, '.dv-jscroll');
  private readonly pathBox = q<HTMLInputElement>(this.root, '.dv-path');
  private readonly spin = q(this.root, '.dv-spin');
  private readonly seq = new Seq();
  private readonly nodes = new WeakMap<HTMLElement, NodeInfo>();
  private want: 'tree' | 'text' = 'tree';
  private selected: HTMLElement | null = null;
  private hasTree = false;

  constructor(private readonly deps: DocDeps) {
    this.text = new TextView(deps, true);
    this.root.appendChild(this.text.root);
    this.apply();
    this.root.querySelector('.dv-bar')?.addEventListener('click', (e) => {
      const b = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-j]') : null;
      if (!b) return;
      const a = b.dataset.j;
      if (a === 'tree' || a === 'text') { this.want = a; this.apply(); }
      else if (a === 'expand') this.expandAll();
      else if (a === 'collapse') this.collapseAll();
      else if (a === 'copy-path') void copyText(this.pathBox.value).then((ok) => this.deps.status(ok ? 'Path copied.' : 'Could not copy.'));
      else if (a === 'copy-value') this.copyValue();
    });
    this.tree.addEventListener('click', (e) => {
      const t = e.target instanceof Element ? e.target : null;
      const more = t?.closest<HTMLElement>('.dv-jmore');
      if (more) { const n = more.closest<HTMLElement>('.dv-jn'); if (n) this.more(n); return; }
      const row = t?.closest<HTMLElement>('.dv-jrow');
      const node = row?.parentElement;
      if (!row || !node) return;
      this.select(node);
      if (t?.closest('.dv-jcaret')) this.toggle(node);
    });
    this.tree.addEventListener('dblclick', (e) => {
      const node = (e.target instanceof Element ? e.target.closest<HTMLElement>('.dv-jrow') : null)?.parentElement;
      if (node) this.toggle(node);
    });
  }

  async open(entry: Entry): Promise<void> {
    const my = this.seq.next();
    setClass(this.root, 'is-loading', true);
    const stop = busy(this.spin);
    try {
      const data = await docApi.text(entry.path);
      if (!this.seq.is(my)) return;
      await this.text.show(entry, data);
      let parsed: unknown = null;
      let failure = '';
      if (data.truncated) failure = 'The file is larger than 2 MB, so the tree is not available.';
      else {
        try {
          if (entry.ext === 'jsonl' || entry.ext === 'ndjson') {
            const out: unknown[] = [];
            const lines = data.text.split(/\r?\n/);
            for (let i = 0; i < lines.length; i++) {
              if (!lines[i].trim()) continue;
              try { out.push(JSON.parse(lines[i])); } catch (err) { throw new Error(`Line ${i + 1}: ${errText(err)}`); }
            }
            parsed = out;
          } else parsed = JSON.parse(data.text);
        } catch (err) { failure = errText(err); }
      }
      if (!this.seq.is(my)) return;
      this.selected = null;
      this.pathBox.value = '';
      if (failure) {
        this.hasTree = false;
        this.tree.replaceChildren();
        setText(q(this.root, '.dv-note'), failure);
        setText(q(this.root, '.dv-info'), '');
      } else {
        this.hasTree = true;
        const root = this.build(null, parsed, '$');
        this.tree.replaceChildren(root);
        this.scroll.scrollTop = 0;
        this.setOpen(root, true);
        setText(q(this.root, '.dv-note'), '');
        setText(q(this.root, '.dv-info'), isContainer(parsed) ? `${fmtInt(sizeOf(parsed))} ${Array.isArray(parsed) ? 'items' : 'keys'} at the top level` : 'A single value');
      }
      this.apply();
    } catch (err) {
      if (this.seq.is(my)) setText(q(this.root, '.dv-note'), errText(err));
    } finally {
      stop();
      if (this.seq.is(my)) setClass(this.root, 'is-loading', false);
    }
  }

  close(): void {
    this.seq.bump();
    this.text.close();
    this.tree.replaceChildren();
    this.selected = null;
    this.hasTree = false;
  }

  key(e: KeyboardEvent): boolean {
    if (this.want === 'text' || !this.hasTree) return this.text.key(e);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const rows = Array.from(this.tree.querySelectorAll<HTMLElement>('.dv-jrow')).filter((r) => r.offsetParent !== null);
      if (!rows.length) return false;
      const cur = this.selected ? rows.indexOf(this.selected.firstElementChild as HTMLElement) : -1;
      const next = rows[Math.max(0, Math.min(rows.length - 1, cur + (e.key === 'ArrowDown' ? 1 : -1)))];
      const node = next.parentElement;
      if (node) { this.select(node); next.scrollIntoView({ block: 'nearest' }); }
      e.preventDefault();
      return true;
    }
    if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'Enter') && this.selected) {
      const info = this.nodes.get(this.selected);
      if (info && isContainer(info.value)) {
        if (e.key === 'Enter') this.toggle(this.selected);
        else this.setOpen(this.selected, e.key === 'ArrowRight');
        e.preventDefault();
        return true;
      }
    }
    return false;
  }

  private apply(): void {
    const treeMode = this.want === 'tree' && this.hasTree;
    setHidden(this.scroll, !treeMode);
    setHidden(this.text.root, treeMode);
    this.root.querySelectorAll<HTMLButtonElement>('[data-j="tree"]').forEach((b) => { b.disabled = !this.hasTree; });
    for (const b of this.root.querySelectorAll<HTMLElement>('[data-j="tree"],[data-j="text"]')) setClass(b, 'is-on', (b.dataset.j === 'tree') === treeMode);
    for (const b of this.root.querySelectorAll<HTMLElement>('[data-j="expand"],[data-j="collapse"],[data-j="copy-path"],[data-j="copy-value"],.dv-path')) setClass(b, 'is-off', !treeMode);
  }

  private build(key: string | number | null, value: unknown, path: string): HTMLElement {
    const node = document.createElement('div');
    node.className = 'dv-jn';
    node.setAttribute('role', 'treeitem');
    const row = document.createElement('div');
    row.className = 'dv-jrow';
    const caret = document.createElement('span');
    caret.className = 'dv-jcaret';
    if (isContainer(value) && sizeOf(value) > 0) caret.innerHTML = icon('chevronRight', 12);
    row.appendChild(caret);
    if (key !== null) {
      const k = document.createElement('span');
      k.className = 'dv-jk';
      k.textContent = String(key);
      row.appendChild(k);
      const c = document.createElement('span');
      c.className = 'dv-jc';
      c.textContent = ':';
      row.appendChild(c);
    }
    const p = preview(value);
    const v = document.createElement('span');
    v.className = `dv-jv ${p.cls}`;
    v.textContent = p.text;
    row.appendChild(v);
    node.appendChild(row);
    this.nodes.set(node, { value, path, shown: 0, open: false });
    return node;
  }

  private setOpen(node: HTMLElement, open: boolean): void {
    const info = this.nodes.get(node);
    if (!info || !isContainer(info.value) || sizeOf(info.value) === 0) return;
    if (open && !node.querySelector(':scope > .dv-jkids')) {
      const kids = document.createElement('div');
      kids.className = 'dv-jkids';
      node.appendChild(kids);
      this.fillKids(node, info);
    }
    info.open = open;
    setClass(node, 'is-open', open);
  }

  private toggle(node: HTMLElement): void {
    const info = this.nodes.get(node);
    if (info) this.setOpen(node, !info.open);
  }

  private fillKids(node: HTMLElement, info: NodeInfo): void {
    const kids = node.querySelector(':scope > .dv-jkids');
    if (!kids || !isContainer(info.value)) return;
    const entries: Array<[string | number, unknown]> = Array.isArray(info.value) ? info.value.map((v, i) => [i, v]) : Object.entries(info.value);
    const upto = Math.min(entries.length, info.shown + PAGE);
    kids.querySelector(':scope > .dv-jmorebox')?.remove();
    const frag = document.createDocumentFragment();
    for (let i = info.shown; i < upto; i++) frag.appendChild(this.build(entries[i][0], entries[i][1], childPath(info.path, entries[i][0])));
    info.shown = upto;
    if (upto < entries.length) {
      const box = document.createElement('div');
      box.className = 'dv-jmorebox';
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'dv-jmore ft-btn';
      b.textContent = `Show ${Math.min(PAGE, entries.length - upto)} more of ${fmtInt(entries.length - upto)} left`;
      box.appendChild(b);
      frag.appendChild(box);
    }
    kids.appendChild(frag);
  }

  private more(node: HTMLElement): void {
    const info = this.nodes.get(node);
    if (info) this.fillKids(node, info);
  }

  private select(node: HTMLElement): void {
    if (this.selected) this.selected.firstElementChild?.classList.remove('is-sel');
    this.selected = node;
    node.firstElementChild?.classList.add('is-sel');
    const info = this.nodes.get(node);
    if (info) this.pathBox.value = info.path;
  }

  private copyValue(): void {
    const info = this.selected ? this.nodes.get(this.selected) : null;
    if (!info) return;
    void copyText(JSON.stringify(info.value, null, 2)).then((ok) => this.deps.status(ok ? 'Value copied.' : 'Could not copy.'));
  }

  private expandAll(): void {
    const walk = (node: HTMLElement, depth: number): void => {
      const info = this.nodes.get(node);
      if (!info || !isContainer(info.value) || depth > 3 || sizeOf(info.value) > 200) return;
      this.setOpen(node, true);
      node.querySelectorAll<HTMLElement>(':scope > .dv-jkids > .dv-jn').forEach((c) => walk(c, depth + 1));
    };
    const root = this.tree.firstElementChild as HTMLElement | null;
    if (root) walk(root, 0);
  }

  private collapseAll(): void {
    this.tree.querySelectorAll<HTMLElement>('.dv-jn.is-open').forEach((n) => {
      const info = this.nodes.get(n);
      if (info) info.open = false;
      n.classList.remove('is-open');
    });
    const root = this.tree.firstElementChild as HTMLElement | null;
    if (root) this.setOpen(root, true);
  }
}

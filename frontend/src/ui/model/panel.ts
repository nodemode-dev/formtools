import type { ModelInfo } from '../../io/model-api';
import { el, patchList, q, setClass, setHidden, setStyleVar, setText } from '../dom';
import { icon } from '../icons';
import './icons';
import type { MaterialRow, NodeRow, SceneDump, StatsData } from './types';

export interface PanelHooks {
  select: (id: string | null) => void;
  visible: (id: string, on: boolean) => void;
}

type Tab = 'scene' | 'materials' | 'stats';
interface Pair { key: string; label: string; value: string }

const num = (n: number): string => n.toLocaleString('en-US');
const dim = (n: number): string => (Math.abs(n) >= 100 ? n.toFixed(1) : Math.abs(n) >= 1 ? n.toFixed(3) : n.toPrecision(3)).replace(/\.?0+$/, '');

function div(cls: string, text = ''): HTMLElement {
  const n = document.createElement('div');
  n.className = cls;
  if (text) n.textContent = text;
  return n;
}

function span(cls: string, text = ''): HTMLElement {
  const n = document.createElement('span');
  n.className = cls;
  if (text) n.textContent = text;
  return n;
}

function button(cls: string, act: string, label: string, inner: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = cls;
  b.dataset.act = act;
  b.setAttribute('aria-label', label);
  b.title = label;
  b.insertAdjacentHTML('beforeend', inner);
  return b;
}

function pairRow(p: Pair): HTMLElement {
  const row = div('ft-info-row');
  row.appendChild(Object.assign(document.createElement('dt'), { textContent: p.label }));
  row.appendChild(Object.assign(document.createElement('dd'), { textContent: p.value }));
  return row;
}

function pairUpdate(row: HTMLElement, p: Pair): void {
  setText(row.children[0], p.label);
  setText(row.children[1], p.value);
}

export class ScenePanel {
  readonly root = el<HTMLElement>(`<aside class="ft-mv-panel" aria-label="Scene" hidden>
      <div class="ft-mv-tabs ft-seg" role="tablist">
        <button class="ft-seg-btn is-on" type="button" data-tab="scene" role="tab">Scene</button>
        <button class="ft-seg-btn" type="button" data-tab="materials" role="tab">Materials</button>
        <button class="ft-seg-btn" type="button" data-tab="stats" role="tab">Stats</button>
      </div>
      <div class="ft-mv-tab" data-pane="scene">
        <div class="ft-mv-list" data-list="nodes"></div>
        <p class="ft-mv-empty" hidden></p>
      </div>
      <div class="ft-mv-tab" data-pane="materials" hidden>
        <div class="ft-mv-list" data-list="materials"></div>
        <p class="ft-mv-empty" hidden></p>
      </div>
      <div class="ft-mv-tab" data-pane="stats" hidden>
        <div class="ft-info-title">View</div>
        <dl class="ft-info-rows" data-list="live"></dl>
        <div class="ft-info-title ft-mv-file-title" hidden>File</div>
        <dl class="ft-info-rows" data-list="file"></dl>
      </div>
    </aside>`);
  private readonly nodeList = q(this.root, '[data-list="nodes"]');
  private readonly matList = q(this.root, '[data-list="materials"]');
  private readonly liveList = q(this.root, '[data-list="live"]');
  private readonly fileList = q(this.root, '[data-list="file"]');
  private readonly fileTitle = q(this.root, '.ft-mv-file-title');
  private nodes: NodeRow[] = [];
  private materials: MaterialRow[] = [];
  private collapsed = new Set<string>();
  private selected: string | null = null;
  private tab: Tab = 'scene';
  private stats: StatsData | null = null;
  private gridCell = 0;
  private info: ModelInfo | null = null;
  private truncated = false;

  constructor(private readonly hooks: PanelHooks) {
    this.root.addEventListener('click', (e) => {
      const t = e.target instanceof Element ? e.target : null;
      if (!t) return;
      const tab = t.closest<HTMLElement>('[data-tab]')?.dataset.tab as Tab | undefined;
      if (tab) { this.setTab(tab); return; }
      const row = t.closest<HTMLElement>('.ft-mv-node');
      if (!row) return;
      const id = row.dataset.key ?? '';
      const act = t.closest<HTMLElement>('[data-act]')?.dataset.act;
      if (act === 'twist') {
        if (this.collapsed.has(id)) this.collapsed.delete(id); else this.collapsed.add(id);
        this.renderNodes();
      } else if (act === 'eye') {
        const n = this.nodes.find((x) => x.id === id);
        if (n) { n.visible = !n.visible; this.hooks.visible(id, n.visible); this.renderNodes(); }
      } else {
        this.hooks.select(this.selected === id ? null : id);
      }
    });
  }

  private setTab(tab: Tab): void {
    this.tab = tab;
    this.root.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => setClass(b, 'is-on', b.dataset.tab === tab));
    this.root.querySelectorAll<HTMLElement>('[data-pane]').forEach((p) => setHidden(p, p.dataset.pane !== tab));
    this.renderStats();
  }

  setDump(d: SceneDump): void {
    this.nodes = d.nodes;
    this.materials = d.materials;
    this.truncated = d.truncated;
    this.collapsed = new Set(d.nodes.filter((n) => n.children > 0 && n.depth >= 2).map((n) => n.id));
    this.renderNodes();
    this.renderMaterials();
  }

  clear(): void {
    this.setDump({ nodes: [], materials: [], truncated: false });
    this.info = null;
    this.renderStats();
  }

  setSelected(id: string | null): void {
    this.selected = id;
    this.renderNodes();
  }

  setInfo(info: ModelInfo | null): void {
    this.info = info;
    this.renderStats();
  }

  setGridCell(cell: number): void {
    this.gridCell = cell;
    this.renderStats();
  }

  setStats(s: StatsData): void {
    this.stats = s;
    if (!this.root.hidden && this.tab === 'stats') this.renderStats();
  }

  private renderNodes(): void {
    const rows: NodeRow[] = [];
    let skip = -1;
    for (const n of this.nodes) {
      if (skip >= 0 && n.depth > skip) continue;
      skip = -1;
      rows.push(n);
      if (n.children > 0 && this.collapsed.has(n.id)) skip = n.depth;
    }
    patchList(this.nodeList, rows, {
      key: (n) => n.id,
      create: (n) => {
        const row = div('ft-mv-node');
        row.appendChild(button('ft-mv-twist', 'twist', 'Expand or collapse', `<span class="ft-mv-twist-on">${icon('mvChevronDown', 12)}</span><span class="ft-mv-twist-off">${icon('mvChevronRight', 12)}</span>`));
        row.appendChild(span('ft-mv-kind'));
        row.appendChild(span('ft-mv-name'));
        row.appendChild(span('ft-mv-count'));
        row.appendChild(button('ft-mv-eye', 'eye', 'Show or hide', `<span class="ft-mv-eye-on">${icon('mvEye', 14)}</span><span class="ft-mv-eye-off">${icon('mvEyeOff', 14)}</span>`));
        this.paintNode(row, n);
        return row;
      },
      update: (row, n) => this.paintNode(row, n),
    });
    const empty = q(this.root, '[data-pane="scene"] .ft-mv-empty');
    setText(empty, this.truncated ? 'Only the first nodes are listed.' : '');
    setHidden(empty, !this.truncated);
  }

  private paintNode(row: HTMLElement, n: NodeRow): void {
    setStyleVar(row, '--depth', String(n.depth));
    row.dataset.kind = n.kind;
    setClass(row, 'is-selected', this.selected === n.id);
    setClass(row, 'is-hidden', !n.visible);
    setClass(row, 'is-leaf', n.children === 0);
    setClass(row, 'is-collapsed', this.collapsed.has(n.id));
    setText(row.children[2], n.name || `(${n.kind})`);
    setText(row.children[3], n.triangles ? num(n.triangles) : n.children ? String(n.children) : '');
  }

  private renderMaterials(): void {
    patchList(this.matList, this.materials, {
      key: (m) => m.id,
      create: (m) => {
        const row = div('ft-mv-mat');
        const head = div('ft-mv-mat-head');
        head.appendChild(span('ft-mv-swatch'));
        head.appendChild(span('ft-mv-name'));
        head.appendChild(span('ft-mv-count'));
        row.appendChild(head);
        row.appendChild(div('ft-mv-texes'));
        this.paintMaterial(row, m);
        return row;
      },
      update: (row, m) => this.paintMaterial(row, m),
    });
    const empty = q(this.root, '[data-pane="materials"] .ft-mv-empty');
    setText(empty, this.materials.length ? '' : 'No materials.');
    setHidden(empty, this.materials.length > 0);
  }

  private paintMaterial(row: HTMLElement, m: MaterialRow): void {
    const head = row.children[0] as HTMLElement;
    setStyleVar(head.children[0] as HTMLElement, '--sw', m.color || 'transparent');
    setClass(head.children[0], 'is-none', !m.color);
    setText(head.children[1], m.name || m.type);
    setText(head.children[2], `${m.type} x ${m.uses}`);
    patchList(row.children[1] as HTMLElement, m.textures, {
      key: (t) => t.slot,
      create: (t) => {
        const r = div('ft-mv-tex');
        r.appendChild(span('ft-mv-tex-slot'));
        r.appendChild(span('ft-mv-tex-size'));
        this.paintTexture(r, t);
        return r;
      },
      update: (r, t) => this.paintTexture(r, t),
    });
  }

  private paintTexture(r: HTMLElement, t: MaterialRow['textures'][number]): void {
    setText(r.children[0], t.name ? `${t.slot}: ${t.name}` : t.slot);
    setText(r.children[1], t.width ? `${t.width} x ${t.height}` : '');
  }

  private renderStats(): void {
    if (this.tab !== 'stats') return;
    const s = this.stats;
    const live: Pair[] = [];
    if (s) {
      live.push({ key: 'tri', label: 'Triangles', value: num(s.triangles) });
      live.push({ key: 'vert', label: 'Vertices', value: num(s.vertices) });
      live.push({ key: 'mesh', label: 'Meshes', value: num(s.meshes) });
      live.push({ key: 'calls', label: 'Draw calls', value: num(s.calls) });
      live.push({ key: 'tex', label: 'GPU textures', value: num(s.textures) });
      live.push({ key: 'geo', label: 'GPU geometries', value: num(s.geometries) });
    }
    if (this.gridCell > 0) live.push({ key: 'cell', label: 'Grid cell', value: dim(this.gridCell) + (this.info?.units ? ` ${this.info.units}` : '') });
    const opts = { key: (p: Pair) => p.key, create: pairRow, update: pairUpdate };
    patchList(this.liveList, live, opts);
    const file: Pair[] = [];
    const i = this.info;
    if (i) {
      file.push({ key: 'format', label: 'Format', value: i.format.toUpperCase() });
      file.push({ key: 'meshes', label: 'Meshes', value: num(i.meshes) });
      file.push({ key: 'vertices', label: 'Vertices', value: num(i.vertices) });
      file.push({ key: 'triangles', label: 'Triangles', value: num(i.triangles) });
      file.push({ key: 'materials', label: 'Materials', value: num(i.materials) });
      file.push({ key: 'textures', label: 'Textures', value: num(i.textures) });
      file.push({ key: 'animations', label: 'Animations', value: num(i.animations) });
      file.push({ key: 'nodes', label: 'Nodes', value: num(i.nodes) });
      const d = i.bbox.max.map((v, k) => v - i.bbox.min[k]);
      file.push({ key: 'size', label: 'Size', value: `${d.map(dim).join(' x ')}${i.units ? ` ${i.units}` : ''}` });
      file.push({ key: 'units', label: 'Units', value: i.units ?? 'not stated' });
      i.notes.forEach((n, k) => file.push({ key: `note${k}`, label: 'Note', value: n }));
    }
    patchList(this.fileList, file, opts);
    setHidden(this.fileTitle, file.length === 0);
  }

  toggle(): boolean {
    const on = this.root.hidden === true;
    setHidden(this.root, !on);
    if (on) this.renderStats();
    return on;
  }
}

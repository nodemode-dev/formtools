import { patchList, setClass, setText } from '../dom';
import { icon } from '../icons';
import { VirtualList } from './vlist';

export interface GridCol { label: string; sub?: string; width: number; right?: boolean }
export type CellOut = string | null | undefined;

const ROW_H = 26;

export class VGrid {
  readonly root: HTMLElement;
  readonly list: VirtualList;
  onSort: ((col: number) => void) | null = null;
  cell: (row: number, col: number) => CellOut = () => undefined;
  private readonly head: HTMLElement;
  private cols: GridCol[] = [];

  constructor() {
    this.root = document.createElement('div');
    this.root.className = 'dv-grid';
    this.root.tabIndex = 0;
    this.head = document.createElement('div');
    this.head.className = 'dv-grid-head';
    this.root.appendChild(this.head);
    this.head.addEventListener('click', (e) => {
      const c = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-col]') : null;
      if (c && this.onSort) this.onSort(Number(c.dataset.col));
    });
    this.list = new VirtualList(this.root, ROW_H, () => this.buildRow(), (n, i) => this.fillRow(n, i));
  }

  setColumns(cols: GridCol[]): void {
    this.cols = cols;
    const tpl = `56px ${cols.map((c) => `${c.width}px`).join(' ')}`;
    const total = 56 + cols.reduce((a, c) => a + c.width, 0);
    this.root.style.setProperty('--cols', tpl);
    this.root.style.setProperty('--w', `${total}px`);
    patchList(this.head, [{ i: -1 }, ...cols.map((_, i) => ({ i }))], {
      key: (x) => `c${x.i}`,
      create: (x) => {
        const n = document.createElement('div');
        n.className = x.i < 0 ? 'dv-gh dv-gh-gutter' : 'dv-gh';
        if (x.i >= 0) {
          n.dataset.col = String(x.i);
          n.innerHTML = `<span class="dv-gh-label"></span><span class="dv-gh-sub"></span><span class="dv-gh-sort">${icon('dvSortUp', 12)}</span>`;
        } else n.textContent = '#';
        return n;
      },
      update: () => undefined,
    });
    cols.forEach((c, i) => {
      const n = this.head.children[i + 1] as HTMLElement;
      setText(n.children[0], c.label);
      setText(n.children[1], c.sub ?? '');
      setClass(n, 'is-right', !!c.right);
    });
    this.list.refresh();
  }

  setSort(col: number, dir: 1 | -1 | 0): void {
    for (let i = 0; i < this.cols.length; i++) {
      const n = this.head.children[i + 1] as HTMLElement;
      setClass(n, 'is-sorted', i === col && dir !== 0);
      setClass(n, 'is-desc', i === col && dir === -1);
    }
  }

  setCount(n: number): void { this.list.setCount(n); }

  scrollHome(): void { this.root.scrollTop = 0; this.root.scrollLeft = 0; }

  private buildRow(): HTMLElement {
    const r = document.createElement('div');
    r.className = 'dv-grid-row';
    return r;
  }

  private fillRow(node: HTMLElement, i: number): void {
    const want = this.cols.length + 1;
    while (node.children.length < want) node.appendChild(document.createElement('span'));
    while (node.children.length > want) node.lastElementChild?.remove();
    const visible = i < this.list.total;
    setClass(node, 'is-odd', i % 2 === 1);
    node.style.visibility = visible ? '' : 'hidden';
    if (!visible) return;
    const g = node.children[0] as HTMLElement;
    g.className = 'dv-gc dv-gc-gutter';
    setText(g, String(i + 1));
    for (let c = 0; c < this.cols.length; c++) {
      const s = node.children[c + 1] as HTMLElement;
      const v = this.cell(i, c);
      const cls = v === null ? 'dv-gc is-null' : v === undefined ? 'dv-gc is-pending' : this.cols[c].right ? 'dv-gc is-right' : 'dv-gc';
      if (s.className !== cls) s.className = cls;
      setText(s, v === null ? 'NULL' : v ?? '');
    }
  }
}

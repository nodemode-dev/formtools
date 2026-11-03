import { api, type Dir } from '../io/api';
import { el, escapeHtml, patchList, q, setClass } from './dom';
import { icon } from './icons';
import { loadPrefs } from './prefs';

interface NodeState { loaded: boolean; open: boolean }

const norm = (p: string): string => p.replace(/[\\/]+$/, '') || p;
const isUnder = (child: string, parent: string): boolean => {
  const c = norm(child), p = norm(parent);
  return c === p || c.startsWith(p.endsWith('/') || p.endsWith('\\') ? p : p + '/') || c.startsWith(p + '\\');
};

export class FolderTree {
  readonly root = el<HTMLElement>('<div class="ft-tree" role="tree" aria-label="Folders"></div>');
  private readonly state = new Map<string, NodeState>();
  private current = '';

  constructor(private readonly open: (path: string) => void) {
    this.root.addEventListener('click', (e) => {
      const t = e.target instanceof Element ? e.target : null;
      const row = t?.closest<HTMLElement>('.ft-tree-row');
      if (!row) return;
      const path = row.parentElement?.dataset.key;
      if (!path) return;
      if (t?.closest('.ft-tree-twisty')) void this.toggle(path);
      else this.open(path);
    });
  }

  setRoots(roots: Dir[]): void { this.fill(this.root, roots, 0); }

  private fill(container: HTMLElement, dirs: Dir[], depth: number): void {
    const update = (n: HTMLElement, d: Dir): void => {
      setClass(n, 'has-children', d.has_children);
      setClass(n, 'is-current', norm(d.path) === norm(this.current));
    };
    patchList(container, dirs, {
      key: (d) => d.path,
      create: (d) => {
        const n = el<HTMLElement>(`<div class="ft-tree-node" role="treeitem" aria-expanded="false" style="--depth:${depth}">
            <div class="ft-tree-row" title="${escapeHtml(d.path)}"><span class="ft-tree-twisty">${icon('chevronRight', 12)}</span>${icon('folder', 14)}<span class="ft-tree-name">${escapeHtml(d.name)}</span></div>
            <div class="ft-tree-kids" role="group" hidden></div></div>`);
        update(n, d);
        return n;
      },
      update,
    });
  }

  private nodeFor(path: string): HTMLElement | null {
    for (const n of this.root.querySelectorAll<HTMLElement>('.ft-tree-node')) if (n.dataset.key === path) return n;
    return null;
  }

  private async expand(path: string, open = true): Promise<void> {
    const node = this.nodeFor(path);
    if (!node) return;
    const st = this.state.get(path) ?? { loaded: false, open: false };
    const kids = q(node, '.ft-tree-kids');
    if (open && !st.loaded) {
      try {
        const r = await api.dirs(path, loadPrefs().showHidden);
        const depth = Number(node.style.getPropertyValue('--depth') || 0) + 1;
        this.fill(kids, r.dirs, depth);
        st.loaded = true;
      } catch {
        return;
      }
    }
    st.open = open;
    this.state.set(path, st);
    kids.hidden = !open;
    node.setAttribute('aria-expanded', String(open));
    setClass(node, 'is-open', open);
  }

  private async toggle(path: string): Promise<void> { await this.expand(path, !(this.state.get(path)?.open ?? false)); }

  async reveal(path: string): Promise<void> {
    this.current = path;
    let prevCurrent = this.root.querySelector<HTMLElement>('.ft-tree-node.is-current');
    for (;;) {
      const nodes = Array.from(this.root.querySelectorAll<HTMLElement>('.ft-tree-node'));
      const exact = nodes.find((n) => norm(n.dataset.key ?? '') === norm(path));
      if (exact) {
        if (prevCurrent && prevCurrent !== exact) setClass(prevCurrent, 'is-current', false);
        setClass(exact, 'is-current', true);
        prevCurrent = exact;
        q(exact, '.ft-tree-row').scrollIntoView({ block: 'nearest' });
        return;
      }
      const ancestors = nodes.filter((n) => n.dataset.key && isUnder(path, n.dataset.key) && !(this.state.get(n.dataset.key)?.open));
      if (!ancestors.length) { if (prevCurrent) setClass(prevCurrent, 'is-current', false); return; }
      ancestors.sort((a, b) => (b.dataset.key ?? '').length - (a.dataset.key ?? '').length);
      const before = this.root.querySelectorAll('.ft-tree-node').length;
      await this.expand(ancestors[0].dataset.key!, true);
      if (this.root.querySelectorAll('.ft-tree-node').length === before && !this.state.get(ancestors[0].dataset.key!)?.loaded) return;
    }
  }
}

import { api, type Entry, type Listing } from '../../io/api';
import { inDesktop } from '../../io/host';
import { el, escapeHtml, q, setClass, setText } from '../dom';
import { icon } from '../icons';
import { countTypes, extOf, suggestTools, TYPE_LABELS, typeOfName, type DropType, type Suggestion } from './suggest';

export interface DropDeps {
  runWith: (command: string, paths: string[]) => void;
  run: (command: string) => void;
}

const MAX_PATHS = 400;
const NAMES_SHOWN = 6;

const baseName = (p: string): string => p.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || p;
const parentOf = (p: string): string => p.replace(/[\\/]+$/, '').replace(/[\\/][^\\/]+$/, '') || p;
const plain = (name: string, path: string, kind: 'dir' | 'file'): Entry => ({ name, path, kind, ext: kind === 'file' ? extOf(name) : '', size: 0, mtime: 0, type: kind === 'file' ? typeOfName(name) : 'other' });

export async function classifyPaths(paths: string[]): Promise<Entry[]> {
  const lists = new Map<string, Promise<Listing | null>>();
  const listOf = (p: string): Promise<Listing | null> => {
    let l = lists.get(p);
    if (!l) { l = api.list(p).catch(() => null); lists.set(p, l); }
    return l;
  };
  const unique = [...new Set(paths)].slice(0, MAX_PATHS);
  return Promise.all(unique.map(async (p) => {
    const trimmed = p.replace(/[\\/]+$/, '') || p;
    const listing = await listOf(parentOf(trimmed));
    const hit = listing?.entries.find((e) => e.path === p || e.path === trimmed);
    if (hit) return hit;
    const dir = await listOf(trimmed);
    return dir ? plain(baseName(trimmed), dir.path, 'dir') : plain(baseName(trimmed), p, 'file');
  }));
}

export function entriesFromTransfer(dt: DataTransfer): Entry[] {
  const out: Entry[] = [];
  const items = dt.items ? [...dt.items].filter((i) => i.kind === 'file') : [];
  if (items.length) {
    for (const it of items) {
      const entry = typeof it.webkitGetAsEntry === 'function' ? it.webkitGetAsEntry() : null;
      if (entry?.isDirectory) { out.push(plain(entry.name, '', 'dir')); continue; }
      const f = it.getAsFile();
      if (f) out.push({ ...plain(f.name, '', 'file'), size: f.size });
    }
    if (out.length) return out;
  }
  for (const f of dt.files ? [...dt.files] : []) out.push({ ...plain(f.name, '', 'file'), size: f.size });
  return out;
}

const hasFiles = (e: DragEvent): boolean => !!e.dataTransfer && [...(e.dataTransfer.types ?? [])].includes('Files');

export class HomeDrop {
  private readonly overlay: HTMLElement;
  private readonly scrim: HTMLElement;
  private readonly sheet: HTMLElement;
  private readonly title: HTMLElement;
  private readonly sub: HTMLElement;
  private readonly chips: HTMLElement;
  private readonly names: HTMLElement;
  private readonly note: HTMLElement;
  private readonly groups: HTMLElement;
  private depth = 0;
  private opener: HTMLElement | null = null;
  private token = 0;

  constructor(private readonly zone: HTMLElement, private readonly deps: DropDeps) {
    this.overlay = el<HTMLElement>(`
      <div class="ft-drop-overlay" aria-hidden="true">
        <div class="ft-drop-card">
          <span class="ft-drop-card-icon">${icon('ftViewer', 28)}</span>
          <span class="ft-drop-card-title">Drop to see what you can do with it</span>
          <span class="ft-drop-card-sub">Files and folders stay on this computer</span>
        </div>
      </div>`);
    this.scrim = el<HTMLElement>(`
      <div class="ft-sheet-scrim" hidden>
        <div class="ft-sheet" role="dialog" aria-modal="true" aria-labelledby="ft-sheet-title" tabindex="-1">
          <div class="ft-sheet-head">
            <div class="ft-sheet-headtext"><h2 class="ft-sheet-title" id="ft-sheet-title"></h2><p class="ft-sheet-sub"></p></div>
            <button class="cv-tt-btn ft-sheet-close" type="button" data-sheet="close" title="Close (Escape)" aria-label="Close">${icon('close', 16)}</button>
          </div>
          <div class="ft-sheet-chips"></div>
          <ul class="ft-sheet-names"></ul>
          <p class="ft-sheet-note" hidden></p>
          <div class="ft-sheet-groups"></div>
        </div>
      </div>`);
    this.zone.append(this.overlay, this.scrim);
    this.sheet = q(this.scrim, '.ft-sheet');
    this.title = q(this.scrim, '.ft-sheet-title');
    this.sub = q(this.scrim, '.ft-sheet-sub');
    this.chips = q(this.scrim, '.ft-sheet-chips');
    this.names = q(this.scrim, '.ft-sheet-names');
    this.note = q(this.scrim, '.ft-sheet-note');
    this.groups = q(this.scrim, '.ft-sheet-groups');
    this.bind();
  }

  get isOpen(): boolean { return !this.scrim.hidden; }

  private bind(): void {
    const z = this.zone;
    z.addEventListener('dragenter', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      this.depth += 1;
      setClass(z, 'is-over', true);
    });
    z.addEventListener('dragover', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      setClass(z, 'is-over', true);
    });
    z.addEventListener('dragleave', (e) => {
      if (!hasFiles(e)) return;
      this.depth = Math.max(0, this.depth - 1);
      if (this.depth === 0) setClass(z, 'is-over', false);
    });
    z.addEventListener('drop', (e) => {
      if (!e.dataTransfer || !hasFiles(e)) return;
      e.preventDefault();
      e.stopPropagation();
      this.depth = 0;
      setClass(z, 'is-over', false);
      if (inDesktop()) return;
      const entries = entriesFromTransfer(e.dataTransfer);
      if (entries.length) this.present(entries, true);
    });
    window.addEventListener('dragend', () => { this.depth = 0; setClass(z, 'is-over', false); });

    this.scrim.addEventListener('pointerdown', (e) => { if (e.target === this.scrim) this.close(true); });
    this.scrim.addEventListener('click', (e) => {
      const t = e.target instanceof Element ? e.target : null;
      if (t?.closest('[data-sheet="close"]')) { this.close(true); return; }
      const cmd = t?.closest<HTMLElement>('[data-run]');
      if (!cmd || cmd.getAttribute('aria-disabled') === 'true') return;
      const paths = (cmd.dataset.paths ?? '').split('\n').filter(Boolean);
      const command = cmd.dataset.run ?? '';
      this.close(false);
      if (command === 'go-browse') this.deps.run(command);
      else this.deps.runWith(command, paths);
    });
    this.scrim.addEventListener('keydown', (e) => this.key(e));
  }

  async receive(paths: string[]): Promise<void> {
    if (!paths.length) return;
    const token = ++this.token;
    const entries = await classifyPaths(paths);
    if (token !== this.token) return;
    this.present(entries, false);
  }

  present(entries: Entry[], browserTab: boolean): void {
    const wasOpen = this.isOpen;
    if (!wasOpen) this.opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const counts = countTypes(entries);
    const total = entries.length;
    setText(this.title, total === 1 ? `Dropped ${entries[0].name}` : `Dropped ${total} items`);
    setText(this.sub, browserTab ? 'This is a browser tab, so the files have no path on this computer.' : 'Pick what to do with them.');

    this.chips.replaceChildren(...counts.map(([t, n]) => {
      const c = el<HTMLElement>('<span class="ft-sheet-chip"></span>');
      c.textContent = `${n} ${TYPE_LABELS[t][n === 1 ? 0 : 1]}`;
      return c;
    }));

    const shown = entries.slice(0, NAMES_SHOWN).map((e) => {
      const li = el<HTMLElement>(`<li class="ft-sheet-name">${icon(e.kind === 'dir' ? 'folder' : 'fileImage', 14)}<span></span></li>`);
      q(li, 'span:last-child').textContent = e.name;
      return li;
    });
    if (total > NAMES_SHOWN) {
      const more = el<HTMLElement>('<li class="ft-sheet-name is-more"><span></span></li>');
      q(more, 'span').textContent = `and ${total - NAMES_SHOWN} more`;
      shown.push(more);
    }
    this.names.replaceChildren(...shown);

    const noPaths = entries.every((e) => !e.path);
    if (noPaths) {
      this.note.hidden = false;
      this.note.textContent = 'The tools need real paths. Use the desktop app, or open Browse and type the folder path.';
    } else this.note.hidden = true;

    this.renderSuggestions(suggestTools(entries), noPaths);
    this.scrim.hidden = false;
    this.zone.classList.add('has-sheet');
    if (!wasOpen) {
      const first = this.sheet.querySelector<HTMLElement>('.ft-sg:not([aria-disabled="true"])') ?? q(this.sheet, '[data-sheet="close"]');
      first.focus({ preventScroll: true });
    }
  }

  private renderSuggestions(list: Suggestion[], noPaths: boolean): void {
    const order: Array<Suggestion['group']> = [];
    for (const s of list) if (!order.includes(s.group)) order.push(s.group);
    const blocks = order.map((g) => {
      const items = list.filter((s) => s.group === g);
      const block = el<HTMLElement>('<section class="ft-sheet-group"><h3 class="ft-sheet-gtitle"></h3><div class="ft-sheet-grid"></div></section>');
      const first = items[0];
      const label = g === 'any' ? 'Works on everything dropped' : first.types.length === 1 ? `For ${first.count} ${TYPE_LABELS[first.types[0] as DropType][first.count === 1 ? 0 : 1]}` : `For ${first.count} files`;
      q(block, '.ft-sheet-gtitle').textContent = label;
      const grid = q(block, '.ft-sheet-grid');
      for (const s of items) {
        const b = el<HTMLButtonElement>(`<button class="ft-sg${s.primary ? ' is-primary' : ''}" type="button" data-run="${escapeHtml(s.command)}">${icon(s.icon, 18)}<span class="ft-sg-text"><span class="ft-sg-label"></span><span class="ft-sg-hint"></span></span></button>`);
        q(b, '.ft-sg-label').textContent = s.label;
        q(b, '.ft-sg-hint').textContent = s.hint;
        b.dataset.paths = s.paths.join('\n');
        const off = noPaths || s.paths.length === 0;
        if (off) { b.setAttribute('aria-disabled', 'true'); b.title = 'Needs the desktop app or a typed path'; }
        else b.title = `${s.label}: ${s.hint}`;
        grid.appendChild(b);
      }
      return block;
    });
    if (noPaths) {
      const b = el<HTMLButtonElement>(`<button class="ft-sg is-primary" type="button" data-run="go-browse">${icon('ftBrowse', 18)}<span class="ft-sg-text"><span class="ft-sg-label">Open Browse</span><span class="ft-sg-hint">Type a folder path in the path bar</span></span></button>`);
      const block = el<HTMLElement>('<section class="ft-sheet-group"><h3 class="ft-sheet-gtitle">Instead</h3><div class="ft-sheet-grid"></div></section>');
      q(block, '.ft-sheet-grid').appendChild(b);
      blocks.unshift(block);
    }
    this.groups.replaceChildren(...blocks);
  }

  close(restore: boolean): void {
    if (!this.isOpen) return;
    this.token += 1;
    this.scrim.hidden = true;
    this.zone.classList.remove('has-sheet');
    const back = this.opener;
    this.opener = null;
    if (restore && back && back.isConnected) back.focus({ preventScroll: true });
  }

  private key(e: KeyboardEvent): void {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.close(true); return; }
    const items = [...this.sheet.querySelectorAll<HTMLElement>('[data-sheet="close"], .ft-sg')];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Tab') {
      if (!items.length) return;
      const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : (i === items.length - 1 ? 0 : i + 1);
      e.preventDefault();
      items[next].focus();
      return;
    }
    if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key) && i >= 0) {
      const fwd = e.key === 'ArrowRight' || e.key === 'ArrowDown';
      e.preventDefault();
      items[Math.min(items.length - 1, Math.max(0, i + (fwd ? 1 : -1)))].focus();
    }
  }
}

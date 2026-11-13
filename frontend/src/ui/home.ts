import { el, escapeHtml, patchList, q, setHidden, setText } from './dom';
import { icon } from './icons';
import { loadPrefs, onPrefs } from './prefs';
import { HomeNav } from './home/nav';
import { HomeDrop } from './home/drop';
import { applyTips, COLUMNS, groupInfos, toolAttrs, type GroupInfo } from './home/model';

export interface HomeDeps {
  run: (cmd: string) => void;
  openPath: (path: string) => void;
  runWith: (command: string, paths: string[]) => void;
  keyOf?: (command: string) => string;
}

const RECENT_LIMIT = 6;
const NAV_RECENT_LIMIT = 8;
const FORMATS = ['JPEG', 'PNG', 'WebP', 'AVIF', 'TIFF', 'RAW', 'PSD', 'EXR', 'SVG', 'GIF', 'MP4', 'FVD'];
const HINT_DEFAULT = 'Point at a tool to see what it does.';

const baseName = (p: string): string => p.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || p;
const dirName = (p: string): string => { const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\')); return i > 0 ? p.slice(0, i) : p; };
const greeting = (): string => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };

function columnsOf(groups: GroupInfo[]): GroupInfo[][] {
  const byId = new Map(groups.map((g) => [g.id, g]));
  const used = new Set<string>();
  const cols = COLUMNS.map((ids) => ids.map((id) => byId.get(id)).filter((g): g is GroupInfo => !!g)).filter((c) => c.length > 0);
  for (const c of cols) for (const g of c) used.add(g.id);
  const rest = groups.filter((g) => !used.has(g.id));
  if (rest.length) { if (cols.length) cols[cols.length - 1].push(...rest); else cols.push(rest); }
  return cols;
}

export class HomeScreen {
  readonly root: HTMLElement;
  private readonly recent: HTMLElement;
  private readonly recentEmpty: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly title: HTMLElement;
  private readonly nav: HomeNav;
  private readonly drop: HomeDrop;

  constructor(private readonly deps: HomeDeps) {
    const groups = groupInfos();
    const columns = columnsOf(groups).map((col) => `<div class="ft-col">${col.map((g) => `
        <section class="cv-home-section ft-group" data-group="${g.id}">
          <h2 class="ft-group-title">${icon(g.icon, 14)}<span>${escapeHtml(g.label)}</span></h2>
          <div class="ft-tools">${g.tiles.map((t) => `
            <button class="ft-tool${t.off ? ' is-planned' : ''}" type="button" data-tip="${escapeHtml(t.def.name)}: ${escapeHtml(t.def.summary)}"${toolAttrs(t)}>
              <span class="ft-tool-icon">${icon(t.def.icon, 16)}</span><span class="ft-tool-name">${escapeHtml(t.def.name)}</span>${t.badge ? `<span class="ft-tool-badge">${escapeHtml(t.badge)}</span>` : ''}
            </button>`).join('')}
          </div>
        </section>`).join('')}</div>`).join('');

    this.root = el<HTMLElement>(`
      <section class="cv-home ft-page" aria-label="Home" data-page="home">
        <div class="cv-home-main">
         <div class="ft-home-scroll">
          <div class="ft-home-narrow">
            <button class="ft-narrow-item" type="button" data-cmd="go-browse">${icon('ftBrowse', 14)}<span>Browse</span></button>
            <button class="ft-narrow-item" type="button" data-cmd="terminal-toggle">${icon('terminal', 14)}<span>Terminal</span></button>
            <button class="ft-narrow-item" type="button" data-cmd="claude-code">${icon('agent', 14)}<span>Claude Code</span></button>
            <button class="ft-narrow-item" type="button" data-cmd="settings">${icon('settings', 14)}<span>Preferences</span></button>
          </div>
          <header class="cv-home-head">
            <div class="cv-home-headtext"><h1 class="cv-home-title">${greeting()}</h1><p class="cv-home-sub">Open anything the Form apps make: view, convert and inspect files, folders and Form projects.</p></div>
          </header>
          <div class="cv-home-hero ft-drop">
            <span class="cv-home-hero-icon">${icon('ftViewer', 26)}</span>
            <div class="cv-home-hero-text">
              <span class="cv-home-hero-title">Drop files or a folder anywhere on this screen</span>
              <span class="cv-home-hero-sub">The tools that fit what you drop are suggested. Nothing is uploaded: every file stays on this computer.</span>
              <div class="cv-home-formats" aria-label="Some formats it opens">${FORMATS.map((f) => `<span class="cv-home-format">${f}</span>`).join('')}</div>
            </div>
            <div class="cv-home-actions">
              <button class="cv-home-action is-primary" type="button" data-cmd="open-files" data-tip="Open files">${icon('fileImage', 16)}<span class="cv-home-label">Open files</span><span class="ft-key"></span></button>
              <button class="cv-home-action" type="button" data-cmd="open-folder" data-tip="Open a folder">${icon('folderOpen', 16)}<span class="cv-home-label">Open folder</span><span class="ft-key"></span></button>
              <button class="cv-home-action" type="button" data-cmd="go-browse" data-tip="Browse this computer">${icon('ftBrowse', 16)}<span class="cv-home-label">Browse</span><span class="ft-key"></span></button>
            </div>
          </div>
          <section class="cv-home-section ft-home-recent" aria-label="Recent">
            <div class="cv-home-section-head"><h2 class="cv-home-section-title">Recent</h2></div>
            <div class="ft-recent-box">
              <div class="ft-recent" role="list"></div>
              <p class="cv-hf-empty ft-recent-empty">Files and folders you open appear here.</p>
            </div>
          </section>
          <section class="cv-home-section ft-home-tools" aria-label="Tools">
            <div class="cv-home-section-head"><h2 class="cv-home-section-title">Tools</h2><p class="ft-home-hint" aria-live="polite">${HINT_DEFAULT}</p></div>
            <div class="ft-cols">${columns}</div>
          </section>
         </div>
        </div>
      </section>`);

    this.nav = new HomeNav(this.root, groups);
    this.root.prepend(this.nav.root);
    const main = q(this.root, '.cv-home-main');
    this.drop = new HomeDrop(main, { runWith: (c, p) => deps.runWith(c, p), run: (c) => deps.run(c) });
    this.recent = q(this.root, '.ft-recent');
    this.recentEmpty = q(this.root, '.ft-recent-empty');
    this.hint = q(this.root, '.ft-home-hint');
    this.title = q(this.root, '.cv-home-title');

    this.root.addEventListener('click', (e) => {
      const t = e.target instanceof Element ? e.target : null;
      const cmd = t?.closest<HTMLElement>('[data-cmd]')?.dataset.cmd;
      if (cmd) { deps.run(cmd); return; }
      const path = t?.closest<HTMLElement>('[data-path]')?.dataset.path;
      if (path) deps.openPath(path);
    });
    const tools = q(this.root, '.ft-cols');
    const show = (e: Event): void => {
      const tool = e.target instanceof Element ? e.target.closest<HTMLElement>('.ft-tool') : null;
      setText(this.hint, tool ? tool.title : HINT_DEFAULT);
    };
    tools.addEventListener('pointerover', show);
    tools.addEventListener('focusin', show);
    tools.addEventListener('pointerleave', () => setText(this.hint, HINT_DEFAULT));
    tools.addEventListener('focusout', () => setText(this.hint, HINT_DEFAULT));
    this.root.addEventListener('pointerover', () => this.syncTips(), { once: true });
    this.root.addEventListener('focusin', () => this.syncTips(), { once: true });

    this.syncRecent();
    onPrefs(() => this.syncRecent());
    queueMicrotask(() => this.syncTips());
  }

  receive(paths: string[]): void { void this.drop.receive(paths); }

  private syncTips(): void {
    const keyOf = this.deps.keyOf ?? ((): string => '');
    applyTips(this.root, keyOf);
  }

  private syncRecent(): void {
    const all = loadPrefs().recent;
    this.nav.setRecent(all.slice(0, NAV_RECENT_LIMIT));
    const list = all.slice(0, RECENT_LIMIT);
    setHidden(this.recentEmpty, list.length > 0);
    const update = (node: HTMLElement, p: string): void => {
      setText(q(node, '.ft-recent-name'), baseName(p));
      setText(q(node, '.ft-recent-dir'), dirName(p));
      if (node.title !== p) node.title = p;
    };
    patchList(this.recent, list, {
      key: (p) => p,
      create: (p) => { const n = el<HTMLElement>(`<button class="ft-recent-item" role="listitem" type="button" data-path="${escapeHtml(p)}">${icon('folder', 16)}<span class="ft-recent-name"></span><span class="ft-recent-dir"></span></button>`); update(n, p); return n; },
      update,
    });
  }

  applySupport(supported: (needs: string) => boolean): void {
    for (const card of this.root.querySelectorAll<HTMLElement>('.ft-tool[data-needs]')) {
      const on = supported(card.dataset.needs ?? '');
      if (card.hidden === on) card.hidden = !on;
    }
    this.nav.applySupport(supported);
  }

  setActive(page: string): void {
    this.nav.setActive(page);
    if (page === 'home') setText(this.title, greeting());
    else this.drop.close(false);
  }
}

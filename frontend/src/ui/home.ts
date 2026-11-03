import { el, escapeHtml, patchList, q, setHidden, setText } from './dom';
import { icon } from './icons';
import { GROUPS, toolsIn } from '../extensions/registry';
import { loadPrefs, onPrefs } from './prefs';
import { VERSION } from '../version';

export interface HomeDeps {
  run: (cmd: string) => void;
  openPath: (path: string) => void;
}

const baseName = (p: string): string => p.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || p;
const dirName = (p: string): string => { const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\')); return i > 0 ? p.slice(0, i) : p; };

export class HomeScreen {
  readonly root: HTMLElement;
  private readonly recent: HTMLElement;
  private readonly recentEmpty: HTMLElement;

  constructor(deps: HomeDeps) {
    const groups = GROUPS.map((g) => {
      const tools = toolsIn(g.id);
      if (!tools.length) return '';
      const cards = tools.map((t) => `
        <button class="ft-tool${t.status === 'planned' ? ' is-planned' : ''}" type="button" ${t.command && t.status === 'ready' ? `data-cmd="${t.command}"` : 'aria-disabled="true"'}>
          <span class="ft-tool-icon">${icon(t.icon, 20)}</span>
          <span class="ft-tool-text"><span class="ft-tool-name">${escapeHtml(t.name)}</span><span class="ft-tool-sum">${escapeHtml(t.summary)}</span></span>
          ${t.status === 'planned' ? `<span class="ft-tool-badge">${escapeHtml(t.phase ?? 'Planned')}</span>` : ''}
        </button>`).join('');
      return `<section class="cv-home-section" data-group="${g.id}"><div class="cv-home-section-head"><h2 class="cv-home-section-title">${escapeHtml(g.label)}</h2></div><div class="ft-tools">${cards}</div></section>`;
    }).join('');

    this.root = el<HTMLElement>(`
      <section class="cv-home ft-page" aria-label="Home" data-page="home">
        <nav class="cv-home-nav">
          <div class="cv-home-brand">formtools <span>${VERSION}</span></div>
          <button class="cv-home-nav-item is-active" type="button" data-cmd="go-home">${icon('ftHome', 16)}<span>Home</span></button>
          <button class="cv-home-nav-item" type="button" data-cmd="go-browse">${icon('ftBrowse', 16)}<span>Browse</span></button>
          <div class="cv-home-nav-title">Tools</div>
          ${GROUPS.filter((g) => toolsIn(g.id).length).map((g) => `<button class="cv-home-nav-item" type="button" data-jump="${g.id}">${icon(toolsIn(g.id)[0].icon, 16)}<span>${escapeHtml(g.label)}</span></button>`).join('')}
          <div class="cv-home-nav-foot">
            <button class="cv-home-nav-item" type="button" data-cmd="settings">${icon('settings', 16)}<span>Preferences</span></button>
          </div>
        </nav>
        <div class="cv-home-main">
          <div class="cv-home-head">
            <div><h1 class="cv-home-title">Open anything the Form apps make</h1><p class="cv-home-sub">View, convert and inspect files, folders and Form projects.</p></div>
          </div>
          <div class="cv-home-hero ft-drop">
            <span class="cv-home-hero-icon">${icon('ftViewer', 28)}</span>
            <div class="cv-home-hero-text">
              <span class="cv-home-hero-title">Drop files or a folder here</span>
              <span class="cv-home-hero-sub">Images, RAW, HDR, PSD, video, audio and formvis projects open in place. Nothing is uploaded: every file stays on this computer.</span>
              <div class="cv-home-formats">${['JPEG', 'PNG', 'WebP', 'AVIF', 'TIFF', 'RAW', 'PSD', 'EXR', 'SVG', 'GIF', 'MP4', 'FVD'].map((f) => `<span class="cv-home-format">${f}</span>`).join('')}</div>
            </div>
            <div class="cv-home-hero-actions">
              <button class="cv-home-action is-primary" type="button" data-cmd="open-folder">${icon('folderOpen', 16)}<span class="cv-home-label">Open folder</span></button>
              <button class="cv-home-action" type="button" data-cmd="open-files">${icon('fileImage', 16)}<span class="cv-home-label">Open files</span></button>
              <button class="cv-home-action is-ghost" type="button" data-cmd="go-browse">${icon('ftBrowse', 16)}<span class="cv-home-label">Browse this computer</span></button>
            </div>
          </div>
          <section class="cv-home-section">
            <div class="cv-home-section-head"><h2 class="cv-home-section-title">Recent</h2></div>
            <div class="ft-recent" role="list"></div>
            <p class="cv-hf-empty ft-recent-empty">Files and folders you open appear here.</p>
          </section>
          ${groups}
        </div>
      </section>`);
    this.recent = q(this.root, '.ft-recent');
    this.recentEmpty = q(this.root, '.ft-recent-empty');
    this.root.addEventListener('click', (e) => {
      const t = e.target instanceof Element ? e.target : null;
      const cmd = t?.closest<HTMLElement>('[data-cmd]')?.dataset.cmd;
      if (cmd) { deps.run(cmd); return; }
      const jump = t?.closest<HTMLElement>('[data-jump]')?.dataset.jump;
      if (jump) { this.root.querySelector(`[data-group="${jump}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }); return; }
      const path = t?.closest<HTMLElement>('[data-path]')?.dataset.path;
      if (path) deps.openPath(path);
    });
    this.syncRecent();
    onPrefs(() => this.syncRecent());
  }

  private syncRecent(): void {
    const list = loadPrefs().recent.slice(0, 8);
    setHidden(this.recentEmpty, list.length > 0);
    const update = (node: HTMLElement, p: string): void => {
      setText(q(node, '.ft-recent-name'), baseName(p));
      setText(q(node, '.ft-recent-dir'), dirName(p));
    };
    patchList(this.recent, list, {
      key: (p) => p,
      create: (p) => { const n = el<HTMLElement>(`<button class="ft-recent-item" role="listitem" type="button" data-path="${escapeHtml(p)}">${icon('folder', 16)}<span class="ft-recent-name"></span><span class="ft-recent-dir"></span></button>`); update(n, p); return n; },
      update,
    });
  }

  setActive(page: string): void {
    for (const b of this.root.querySelectorAll<HTMLElement>('.cv-home-nav-item[data-cmd]')) b.classList.toggle('is-active', b.dataset.cmd === `go-${page}`);
  }
}

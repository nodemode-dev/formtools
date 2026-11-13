import { el, escapeHtml, isMac, patchList, q, setClass, setHidden, setText, setTitle } from '../dom';
import { icon } from '../icons';
import { brandMark } from '../brand';
import { readStore, toolAttrs, writeStore, type GroupInfo } from './model';

export const NAV_MIN = 200;
export const NAV_MAX = 520;
export const NAV_DEFAULT = 256;
const NAV_COLLAPSE = 120;
const KEY_WIDTH = 'formtools.home.navW';
const KEY_HIDDEN = 'formtools.home.rail';
const KEY_GROUPS = 'formtools.home.groups';
const DEFAULT_OPEN = ['view', 'batch'];
const SECTIONS = ['agents', 'recent'];
const AGENTS: ReadonlyArray<readonly [string, string, string, string]> = [
  ['terminal-toggle', 'terminal', 'Terminal', 'Show or hide the terminal'],
  ['claude-code', 'agent', 'Claude Code', 'Open Claude Code in the terminal'],
  ['claude-chat', 'agentChat', 'Chat with Claude', 'Show the Chat tab in the terminal dock'],
];

export const TOGGLE_KEY = isMac ? '⌘\\' : 'Ctrl+\\';

const clampWidth = (n: number): number => Math.min(NAV_MAX, Math.max(NAV_MIN, Math.round(n)));
const baseName = (p: string): string => p.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || p;

function readWidth(): number {
  const n = Number(readStore(KEY_WIDTH));
  return Number.isFinite(n) && n > 0 ? clampWidth(n) : NAV_DEFAULT;
}

function readOpen(): Set<string> {
  const raw = readStore(KEY_GROUPS);
  let list: string[] = DEFAULT_OPEN;
  if (raw !== null) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) list = parsed.filter((x): x is string => typeof x === 'string');
    } catch { list = DEFAULT_OPEN; }
  }
  const open = new Set(list.filter((x) => !x.startsWith('!')));
  for (const id of SECTIONS) if (!list.includes(`!${id}`)) open.add(id);
  return open;
}

const section = (id: string, label: string, open: boolean, body: string): string => `
      <div class="ft-ng${open ? ' is-open' : ''}" data-group="${id}">
        <button class="ft-ng-head" type="button" data-ng="${id}" aria-expanded="${open}" aria-controls="ft-ngb-${id}">
          <span class="ft-ng-chev">${icon('chevronDown', 12)}</span><span class="ft-nav-text">${escapeHtml(label)}</span>
        </button>
        <div class="ft-ng-body" id="ft-ngb-${id}"${open ? '' : ' inert'}>
          <div class="ft-ng-inner">${body}</div>
        </div>
      </div>`;

export class HomeNav {
  readonly root: HTMLElement;
  private readonly nav: HTMLElement;
  private readonly grip: HTMLElement;
  private readonly recent: HTMLElement;
  private readonly recentEmpty: HTMLElement;
  private width: number;
  private hidden: boolean;
  private readonly open: Set<string>;

  constructor(private readonly home: HTMLElement, groups: GroupInfo[]) {
    this.width = readWidth();
    this.hidden = readStore(KEY_HIDDEN) === '1';
    this.open = readOpen();
    home.style.setProperty('--ft-nav-w', `${this.width}px`);
    if (this.hidden) home.classList.add('is-nav-hidden');

    const agents = AGENTS.map(([cmd, ic, label, tip]) => `
            <button class="ft-ni" type="button" data-cmd="${cmd}" data-tip="${escapeHtml(tip)}">${icon(ic, 14)}<span class="ft-ni-name">${escapeHtml(label)}</span></button>`).join('');
    const groupHtml = groups.map((g) => section(g.id, g.label, this.open.has(g.id), g.tiles.map((t) => `
            <button class="ft-ni${t.off ? ' is-planned' : ''}" type="button" data-tip="${escapeHtml(t.def.name)}: ${escapeHtml(t.def.summary)}"${toolAttrs(t)}>
              ${icon(t.def.icon, 14)}<span class="ft-ni-name">${escapeHtml(t.def.name)}</span>${t.badge ? `<span class="ft-ni-badge">${escapeHtml(t.badge)}</span>` : ''}
            </button>`).join(''))).join('');

    this.root = el<HTMLElement>(`
      <div class="ft-nav-wrap">
        <nav class="cv-home-nav" aria-label="Home navigation">
          <div class="ft-nav-head">
            <div class="cv-home-brand">${brandMark(22)}<span class="ft-brand-name">formtools</span><span class="ft-brand-by" translate="no">by nodemode.ai</span></div>
          </div>
          <div class="ft-nav-main">
            <button class="cv-home-nav-item is-active" type="button" data-cmd="go-home" data-tip="Home">${icon('ftHome', 16)}<span class="ft-nav-text">Home</span></button>
            <button class="cv-home-nav-item" type="button" data-cmd="go-browse" data-tip="Browse this computer">${icon('ftBrowse', 16)}<span class="ft-nav-text">Browse</span></button>
          </div>
          <div class="ft-nav-groups">
            ${section('agents', 'Agents', this.open.has('agents'), agents)}
            ${section('recent', 'Recent', this.open.has('recent'), '<div class="ft-nav-recent" role="list"></div><p class="ft-nav-empty">Files and folders you open appear here.</p>')}
            ${groupHtml}
          </div>
          <div class="cv-home-nav-foot">
            <button class="cv-home-nav-item" type="button" data-cmd="settings" data-tip="Preferences">${icon('settings', 16)}<span class="ft-nav-text">Preferences</span></button>
          </div>
        </nav>
        <div class="ft-nav-rsz" role="separator" aria-orientation="vertical" aria-label="Resize the side panel" aria-valuemin="${NAV_MIN}" aria-valuemax="${NAV_MAX}" aria-valuenow="${this.width}" tabindex="0" title="Drag to resize, double-click to reset"></div>
        <button class="ft-nav-hide" type="button" data-nav="hide" title="Hide the side panel (${TOGGLE_KEY})" aria-label="Hide the side panel">${icon('chevronLeft', 14)}</button>
        <button class="ft-nav-show" type="button" data-nav="show" title="Show the side panel (${TOGGLE_KEY})" aria-label="Show the side panel">${icon('chevronRight', 14)}</button>
      </div>`);
    this.nav = q(this.root, '.cv-home-nav');
    this.grip = q(this.root, '.ft-nav-rsz');
    this.recent = q(this.root, '.ft-nav-recent');
    this.recentEmpty = q(this.root, '.ft-nav-empty');

    this.root.addEventListener('click', (e) => {
      const t = e.target instanceof Element ? e.target : null;
      const toggle = t?.closest<HTMLElement>('[data-nav]')?.dataset.nav;
      if (toggle) { this.setNavHidden(toggle === 'hide'); return; }
      const head = t?.closest<HTMLElement>('[data-ng]');
      if (head) this.setGroup(head.dataset.ng ?? '', !this.open.has(head.dataset.ng ?? ''));
    });
    this.nav.addEventListener('keydown', (e) => this.navKey(e));
    this.bindGrip();

    window.addEventListener('keydown', (e) => {
      if (e.key !== '\\' || !(isMac ? e.metaKey : e.ctrlKey) || e.altKey || e.shiftKey || e.defaultPrevented) return;
      if (this.home.hidden) return;
      const tgt = e.target;
      if (tgt instanceof HTMLInputElement || tgt instanceof HTMLTextAreaElement || tgt instanceof HTMLSelectElement) return;
      e.preventDefault();
      this.setNavHidden(!this.hidden);
    });
  }

  get isHidden(): boolean { return this.hidden; }

  setNavHidden(on: boolean): void {
    if (on === this.hidden) return;
    this.hidden = on;
    setClass(this.home, 'is-nav-hidden', on);
    writeStore(KEY_HIDDEN, on ? '1' : '0');
  }

  setWidth(w: number, persist: boolean): void {
    const next = clampWidth(w);
    if (next !== this.width) {
      this.width = next;
      this.home.style.setProperty('--ft-nav-w', `${next}px`);
      this.grip.setAttribute('aria-valuenow', String(next));
    }
    if (persist) writeStore(KEY_WIDTH, String(this.width));
  }

  setActive(page: string): void {
    for (const b of this.nav.querySelectorAll<HTMLElement>('.cv-home-nav-item[data-cmd]')) setClass(b, 'is-active', b.dataset.cmd === `go-${page}`);
  }

  setRecent(list: string[]): void {
    setHidden(this.recentEmpty, list.length > 0);
    const update = (node: HTMLElement, p: string): void => {
      setText(q(node, '.ft-ni-name'), baseName(p));
      setTitle(node, p);
    };
    patchList(this.recent, list, {
      key: (p) => p,
      create: (p) => { const n = el<HTMLElement>(`<button class="ft-ni" role="listitem" type="button" data-path="${escapeHtml(p)}">${icon('folder', 14)}<span class="ft-ni-name"></span></button>`); update(n, p); return n; },
      update,
    });
  }

  applySupport(supported: (needs: string) => boolean): void {
    for (const n of this.nav.querySelectorAll<HTMLElement>('[data-needs]')) setHidden(n, !supported(n.dataset.needs ?? ''));
  }

  private setGroup(id: string, on: boolean): void {
    const group = q(this.nav, `.ft-ng[data-group="${id}"]`);
    if (on) this.open.add(id); else this.open.delete(id);
    setClass(group, 'is-open', on);
    q(group, '.ft-ng-head').setAttribute('aria-expanded', String(on));
    q(group, '.ft-ng-body').toggleAttribute('inert', !on);
    writeStore(KEY_GROUPS, JSON.stringify([...this.open, ...SECTIONS.filter((s) => !this.open.has(s)).map((s) => `!${s}`)]));
  }

  private navKey(e: KeyboardEvent): void {
    const t = e.target instanceof HTMLElement ? e.target : null;
    if (!t) return;
    const head = t.closest<HTMLElement>('[data-ng]');
    if (head && e.key === 'ArrowRight') {
      e.preventDefault();
      const id = head.dataset.ng ?? '';
      if (!this.open.has(id)) this.setGroup(id, true);
      else this.nav.querySelector<HTMLElement>(`.ft-ng[data-group="${id}"] .ft-ni:not([hidden])`)?.focus();
      return;
    }
    if (head && e.key === 'ArrowLeft' && this.open.has(head.dataset.ng ?? '')) { e.preventDefault(); this.setGroup(head.dataset.ng ?? '', false); return; }
    if (t.classList.contains('ft-ni') && e.key === 'ArrowLeft') {
      e.preventDefault();
      t.closest('.ft-ng')?.querySelector<HTMLElement>('.ft-ng-head')?.focus();
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    const list = [...this.nav.querySelectorAll<HTMLElement>('.cv-home-nav-item, .ft-ng-head, .ft-ni')].filter((n) => !n.hidden && !n.closest('[inert]') && n.offsetParent !== null);
    const i = list.indexOf(t);
    if (i < 0) return;
    e.preventDefault();
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? list.length - 1 : Math.min(list.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)));
    list[next]?.focus();
  }

  private bindGrip(): void {
    const g = this.grip;
    g.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      g.setPointerCapture(e.pointerId);
      const left = this.nav.getBoundingClientRect().left;
      this.home.classList.add('is-resizing');
      const move = (ev: PointerEvent): void => {
        const raw = ev.clientX - left;
        if (raw < NAV_COLLAPSE) { end(); this.setNavHidden(true); return; }
        this.setWidth(raw, false);
      };
      const end = (): void => {
        g.removeEventListener('pointermove', move);
        g.removeEventListener('pointerup', end);
        g.removeEventListener('pointercancel', end);
        this.home.classList.remove('is-resizing');
        this.setWidth(this.width, true);
      };
      g.addEventListener('pointermove', move);
      g.addEventListener('pointerup', end);
      g.addEventListener('pointercancel', end);
    });
    g.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 32 : 8;
      let w = this.width;
      if (e.key === 'ArrowRight') w += step;
      else if (e.key === 'ArrowLeft') w -= step;
      else if (e.key === 'Home') w = NAV_MIN;
      else if (e.key === 'End') w = NAV_MAX;
      else if (e.key === 'Enter') w = NAV_DEFAULT;
      else return;
      e.preventDefault();
      this.setWidth(w, true);
    });
    g.addEventListener('dblclick', () => this.setWidth(NAV_DEFAULT, true));
  }
}

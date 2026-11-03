import { el, escapeHtml, isMac, q, setClass, setHidden } from '../dom';
import { icon } from '../icons';
import { VERSION } from '../../version';
import { readStore, toolAttrs, writeStore, type GroupInfo } from './model';

export const NAV_MIN = 200;
export const NAV_MAX = 360;
export const NAV_DEFAULT = 240;
const KEY_WIDTH = 'formtools.home.navW';
const KEY_RAIL = 'formtools.home.rail';
const KEY_GROUPS = 'formtools.home.groups';
const DEFAULT_OPEN = ['view', 'batch'];

export const TOGGLE_KEY = isMac ? '⌘\\' : 'Ctrl+\\';

const clampWidth = (n: number): number => Math.min(NAV_MAX, Math.max(NAV_MIN, Math.round(n)));

function readWidth(): number {
  const n = Number(readStore(KEY_WIDTH));
  return Number.isFinite(n) && n > 0 ? clampWidth(n) : NAV_DEFAULT;
}

function readOpen(): Set<string> {
  const raw = readStore(KEY_GROUPS);
  if (raw === null) return new Set(DEFAULT_OPEN);
  try {
    const list: unknown = JSON.parse(raw);
    return new Set(Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : DEFAULT_OPEN);
  } catch { return new Set(DEFAULT_OPEN); }
}

export class HomeNav {
  readonly root: HTMLElement;
  readonly flyouts = new Map<string, HTMLElement>();
  private readonly nav: HTMLElement;
  private readonly grip: HTMLElement;
  private readonly toggleBtn: HTMLButtonElement;
  private width: number;
  private rail: boolean;
  private readonly open: Set<string>;
  private flying: { id: string; head: HTMLElement } | null = null;

  constructor(private readonly home: HTMLElement, groups: GroupInfo[], private readonly run: (cmd: string) => void) {
    this.width = readWidth();
    this.rail = readStore(KEY_RAIL) === '1';
    this.open = readOpen();
    home.style.setProperty('--ft-nav-w', `${this.width}px`);
    if (this.rail) home.classList.add('is-rail');

    const groupHtml = groups.map((g) => `
      <div class="ft-ng${this.open.has(g.id) ? ' is-open' : ''}" data-group="${g.id}">
        <button class="ft-ng-head" type="button" data-ng="${g.id}" aria-expanded="${this.open.has(g.id)}" aria-controls="ft-ngb-${g.id}" data-tip="${escapeHtml(g.label)}">
          ${icon(g.icon, 16)}<span class="ft-nav-text">${escapeHtml(g.label)}</span><span class="ft-ng-chev">${icon('chevronRight', 12)}</span>
        </button>
        <div class="ft-ng-body" id="ft-ngb-${g.id}"${this.open.has(g.id) ? '' : ' inert'}>
          <div class="ft-ng-inner">${g.tiles.map((t) => `
            <button class="ft-ni${t.off ? ' is-planned' : ''}" type="button" data-tip="${escapeHtml(t.def.name)}: ${escapeHtml(t.def.summary)}"${toolAttrs(t)}>
              ${icon(t.def.icon, 16)}<span class="ft-ni-name">${escapeHtml(t.def.name)}</span>${t.badge ? `<span class="ft-ni-badge">${escapeHtml(t.badge)}</span>` : ''}
            </button>`).join('')}
          </div>
        </div>
      </div>`).join('');

    this.root = el<HTMLElement>(`
      <div class="ft-nav-wrap">
        <nav class="cv-home-nav" aria-label="Home navigation">
          <div class="ft-nav-head">
            <div class="cv-home-brand">formtools <span>${VERSION}</span></div>
            <button class="ft-nav-toggle" type="button" data-nav="toggle" aria-label="Collapse side panel" aria-expanded="${!this.rail}">${icon('collapseLeft', 16)}</button>
          </div>
          <div class="ft-nav-main">
            <button class="cv-home-nav-item is-active" type="button" data-cmd="go-home" data-tip="Home">${icon('ftHome', 16)}<span class="ft-nav-text">Home</span></button>
            <button class="cv-home-nav-item" type="button" data-cmd="go-browse" data-tip="Browse this computer">${icon('ftBrowse', 16)}<span class="ft-nav-text">Browse</span></button>
          </div>
          <div class="cv-home-nav-title"><span class="ft-nav-text">Tools</span></div>
          <div class="ft-nav-groups">${groupHtml}</div>
          <div class="cv-home-nav-foot">
            <button class="cv-home-nav-item" type="button" data-cmd="settings" data-tip="Preferences">${icon('settings', 16)}<span class="ft-nav-text">Preferences</span></button>
          </div>
        </nav>
        <div class="ft-nav-grip" role="separator" aria-orientation="vertical" aria-label="Resize side panel" aria-valuemin="${NAV_MIN}" aria-valuemax="${NAV_MAX}" aria-valuenow="${this.width}" tabindex="0" title="Drag to resize, double-click to reset"></div>
      </div>`);
    this.nav = q(this.root, '.cv-home-nav');
    this.grip = q(this.root, '.ft-nav-grip');
    this.toggleBtn = q<HTMLButtonElement>(this.root, '.ft-nav-toggle');
    this.syncToggle();
    this.syncHeads();

    const host =document.getElementById('overlay-root') ?? document.body;
    for (const g of groups) {
      const fly = el<HTMLElement>(`
        <div class="ft-flyout" role="menu" aria-label="${escapeHtml(g.label)}" data-fly="${g.id}" hidden>
          <div class="ft-flyout-title">${escapeHtml(g.label)}</div>
          ${g.tiles.map((t) => `
          <button class="ft-fly-item${t.off ? ' is-planned' : ''}" role="menuitem" type="button" data-tip="${escapeHtml(t.def.name)}: ${escapeHtml(t.def.summary)}"${toolAttrs(t)}>
            ${icon(t.def.icon, 18)}<span class="ft-fly-name">${escapeHtml(t.def.name)}</span>${t.badge ? `<span class="ft-fly-badge">${escapeHtml(t.badge)}</span>` : '<span class="ft-fly-key ft-key"></span>'}
          </button>`).join('')}
        </div>`);
      this.flyouts.set(g.id, fly);
      host.appendChild(fly);
      fly.addEventListener('click', (e) => {
        const cmd = (e.target instanceof Element ? e.target.closest<HTMLElement>('[data-cmd]') : null)?.dataset.cmd;
        if (!cmd) return;
        this.closeFlyout(false);
        this.run(cmd);
      });
      fly.addEventListener('keydown', (e) => this.flyKey(e, fly));
    }

    this.nav.addEventListener('click', (e) => {
      const t = e.target instanceof Element ? e.target : null;
      if (t?.closest('[data-nav="toggle"]')) { this.setRail(!this.rail); return; }
      const head = t?.closest<HTMLElement>('[data-ng]');
      if (head) this.headClick(head, e.detail === 0);
    });
    this.nav.addEventListener('keydown', (e) => this.navKey(e));
    this.bindGrip();

    document.addEventListener('pointerdown', (e) => {
      if (!this.flying) return;
      const t = e.target instanceof Node ? e.target : null;
      const fly = this.flyouts.get(this.flying.id);
      if (t && (fly?.contains(t) || this.flying.head.contains(t))) return;
      this.closeFlyout(false);
    }, true);
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !this.flying) return;
      e.preventDefault();
      e.stopPropagation();
      this.closeFlyout(true);
    }, true);
    window.addEventListener('resize', () => this.closeFlyout(false));
    window.addEventListener('keydown', (e) => {
      if (e.key !== '\\' || !(isMac ? e.metaKey : e.ctrlKey) || e.altKey || e.shiftKey || e.defaultPrevented) return;
      if (this.home.hidden) return;
      const tgt = e.target;
      if (tgt instanceof HTMLInputElement || tgt instanceof HTMLTextAreaElement || tgt instanceof HTMLSelectElement) return;
      e.preventDefault();
      this.setRail(!this.rail);
    });
  }

  get isRail(): boolean { return this.rail; }

  setRail(on: boolean): void {
    if (on === this.rail) return;
    this.rail = on;
    this.closeFlyout(false);
    setClass(this.home, 'is-rail', on);
    this.syncHeads();
    this.syncToggle();
    writeStore(KEY_RAIL, on ? '1' : '0');
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
    if (page !== 'home') this.closeFlyout(false);
  }

  applySupport(supported: (needs: string) => boolean): void {
    const nodes = [...this.nav.querySelectorAll<HTMLElement>('[data-needs]')];
    for (const f of this.flyouts.values()) nodes.push(...f.querySelectorAll<HTMLElement>('[data-needs]'));
    for (const n of nodes) setHidden(n, !supported(n.dataset.needs ?? ''));
  }

  private syncToggle(): void {
    const label = this.rail ? 'Expand side panel' : 'Collapse side panel';
    this.toggleBtn.setAttribute('aria-label', label);
    this.toggleBtn.setAttribute('aria-expanded', String(!this.rail));
    this.toggleBtn.dataset.tip = label;
    this.toggleBtn.title = `${label} (${TOGGLE_KEY})`;
  }

  private headClick(head: HTMLElement, byKey: boolean): void {
    const id = head.dataset.ng ?? '';
    if (this.rail) {
      if (this.flying?.id === id) this.closeFlyout(false);
      else this.showFlyout(id, head, byKey);
      return;
    }
    this.setGroup(id, !this.open.has(id));
  }

  private setGroup(id: string, on: boolean): void {
    const group = q(this.nav, `.ft-ng[data-group="${id}"]`);
    if (on) this.open.add(id); else this.open.delete(id);
    setClass(group, 'is-open', on);
    q(group, '.ft-ng-head').setAttribute('aria-expanded', String(on));
    q(group, '.ft-ng-body').toggleAttribute('inert', !on);
    writeStore(KEY_GROUPS, JSON.stringify([...this.open]));
  }

  private showFlyout(id: string, head: HTMLElement, focusFirst: boolean): void {
    this.closeFlyout(false);
    const fly = this.flyouts.get(id);
    if (!fly) return;
    const r = head.getBoundingClientRect();
    const edge = this.root.getBoundingClientRect().right;
    fly.style.visibility = 'hidden';
    fly.hidden = false;
    const h = fly.offsetHeight;
    fly.style.left = `${Math.round(edge + 4)}px`;
    fly.style.top = `${Math.round(Math.max(4, Math.min(r.top, window.innerHeight - h - 4)))}px`;
    fly.style.visibility = '';
    head.setAttribute('aria-expanded', 'true');
    setClass(head, 'is-flying', true);
    this.flying = { id, head };
    if (focusFirst) this.flyItems(fly)[0]?.focus();
  }

  private closeFlyout(restoreFocus: boolean): void {
    const cur = this.flying;
    if (!cur) return;
    this.flying = null;
    const fly = this.flyouts.get(cur.id);
    if (fly) fly.hidden = true;
    this.syncHeads();
    setClass(cur.head, 'is-flying', false);
    if (restoreFocus) cur.head.focus();
  }

  private syncHeads(): void {
    for (const head of this.nav.querySelectorAll<HTMLElement>('.ft-ng-head')) {
      const id = head.dataset.ng ?? '';
      head.setAttribute('aria-expanded', String(this.rail ? this.flying?.id === id : this.open.has(id)));
      if (this.rail) head.setAttribute('aria-haspopup', 'menu'); else head.removeAttribute('aria-haspopup');
    }
  }

  private flyItems(fly: HTMLElement): HTMLElement[] {
    return [...fly.querySelectorAll<HTMLElement>('.ft-fly-item')].filter((n) => !n.hidden);
  }

  private flyKey(e: KeyboardEvent, fly: HTMLElement): void {
    const items = this.flyItems(fly);
    const i = items.indexOf(document.activeElement as HTMLElement);
    let next = -1;
    if (e.key === 'ArrowDown') next = (i + 1) % items.length;
    else if (e.key === 'ArrowUp') next = (i - 1 + items.length) % items.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    else if (e.key === 'ArrowLeft') { e.preventDefault(); this.closeFlyout(true); return; }
    else if (e.key === 'Tab') { this.closeFlyout(true); return; }
    if (next < 0) return;
    e.preventDefault();
    items[next]?.focus();
  }

  private navKey(e: KeyboardEvent): void {
    const t = e.target instanceof HTMLElement ? e.target : null;
    if (!t) return;
    const head = t.closest<HTMLElement>('[data-ng]');
    if (head && e.key === 'ArrowRight') {
      e.preventDefault();
      const id = head.dataset.ng ?? '';
      if (this.rail) this.showFlyout(id, head, true);
      else if (!this.open.has(id)) this.setGroup(id, true);
      else q(this.nav, `.ft-ng[data-group="${id}"] .ft-ni:not([hidden])`).focus();
      return;
    }
    if (head && e.key === 'ArrowLeft' && !this.rail && this.open.has(head.dataset.ng ?? '')) { e.preventDefault(); this.setGroup(head.dataset.ng ?? '', false); return; }
    if (t.classList.contains('ft-ni') && e.key === 'ArrowLeft') {
      e.preventDefault();
      t.closest('.ft-ng')?.querySelector<HTMLElement>('.ft-ng-head')?.focus();
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    const list = [...this.nav.querySelectorAll<HTMLElement>('.ft-nav-toggle, .cv-home-nav-item, .ft-ng-head, .ft-ni')].filter((n) => !n.hidden && !n.closest('[inert]') && n.offsetParent !== null);
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
      const left = this.root.getBoundingClientRect().left;
      this.home.classList.add('is-resizing');
      const move = (ev: PointerEvent): void => this.setWidth(ev.clientX - left, false);
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

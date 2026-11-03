import { el, q, setClass, setHidden, setText, setValue } from './dom';
import { icon } from './icons';
import type { Commands } from './commands';
import { applyUiPrefs, loadPrefs, updatePrefs, UI_FONT_SIZES, type Prefs, type UiFontSize } from './prefs';
import { readChoice, setAccent, setIntensity, setTheme, themeSwatchesHtml, THEMES, STORAGE_KEY } from './themes';
import { MENUS_IN_WINDOW_KEY, menusInWindow } from './native-menu';
import { VERSION } from '../version';
import { EnginePanels, ShortcutsPanel } from './settings/panels';
import { buttonRow, colorRow, cols, grp, note, segmentedRow, selectRow, sliderRow, toggleRow, valueRow, type Row } from './settings/rows';

const RAIL_KEY = 'formtools.prefsRailCollapsed';
const SPOT_KEY = 'formtools.dialogSpots';

const SECTIONS: ReadonlyArray<readonly [string, string]> = [
  ['General', 'pfGeneral'],
  ['Appearance', 'pfInterface'],
  ['Browser', 'ftBrowse'],
  ['Viewer', 'ftViewer'],
  ['Desktop utilities', 'ftDesk'],
  ['Integration', 'ftFamily'],
  ['Keyboard shortcuts', 'pfTools'],
  ['Privacy and data', 'pfFile'],
  ['Engine', 'pfPerformance'],
  ['About', 'info'],
];

const ALIASES: Record<string, string> = { desk: 'Desktop utilities', shortcuts: 'Keyboard shortcuts', data: 'Privacy and data', privacy: 'Privacy and data' };

const isOwnKey = (k: string): boolean =>
  k.startsWith('formtools.') || k === 'formtools_desk_prefs' || k === 'formtools_user_skin' || k.startsWith('formtools_meta_') || k === STORAGE_KEY;

interface Shell {
  frame: HTMLElement;
  rail: HTMLElement;
  port: HTMLElement;
  shade: SVGPathElement;
  line: SVGPathElement;
}

export class SettingsDialog {
  readonly root: HTMLElement;
  private readonly frame: HTMLElement;
  private readonly pages: HTMLElement;
  private readonly nav: HTMLElement;
  private readonly shell: Shell;
  private readonly sections = new Map<string, HTMLElement>();
  private readonly setters: Array<(p: Prefs) => void> = [];
  private readonly openers: Array<() => void> = [];
  private readonly grid: HTMLElement;
  private readonly accent: Row<string>;
  private readonly intensity: Row<number>;
  private readonly menusRow: Row<boolean>;
  private readonly shortcuts: ShortcutsPanel;
  private readonly engine = new EnginePanels();
  private readonly resetBtn: HTMLButtonElement;
  private resetTimer = 0;
  private prefs: Prefs = loadPrefs();
  private lastFocus: HTMLElement | null = null;
  private current = '';
  private spyRaf = 0;
  private spyMuted = 0;
  private wireRaf = 0;
  private wireD = '';
  private portY = -1;
  private offset = { x: 0, y: 0 };

  constructor(commands?: Commands) {
    applyUiPrefs(this.prefs);
    this.shortcuts = new ShortcutsPanel(commands);
    this.root = el<HTMLElement>(`<div class="cv-scrim ft-settings-scrim" hidden>
      <div class="cv-dialog cv-prefs-dlg" role="dialog" aria-modal="true" aria-label="Preferences" tabindex="-1">
        <div class="cv-dialog-head"><span class="cv-prefs-headicon">${icon('settings', 16)}</span><span class="cv-dialog-title">Preferences</span><button class="cv-icon-btn" type="button" data-close title="Close" aria-label="Close">${icon('close', 16)}</button></div>
        <div class="cv-dialog-body"><div class="cv-prefs"><div class="cv-prefs-pages"></div></div></div>
        <div class="cv-dialog-foot"><button class="cv-btn cv-btn-primary" type="button" data-done>Done</button></div>
      </div></div>`);
    this.frame = q(this.root, '.cv-dialog');
    this.pages = q(this.root, '.cv-prefs-pages');
    this.nav = el('<div class="cv-prefs-nav" role="tablist" aria-label="Sections"></div>');

    const bind = <V>(row: Row<V>, read: (p: Prefs) => V): HTMLElement => {
      this.setters.push((p) => row.set(read(p)));
      return row.el;
    };
    const slot = (name: string): HTMLElement => el(`<div data-slot="${name}"></div>`);

    this.grid = el('<div class="nm-theme-grid" role="group" aria-label="Theme"></div>');
    this.grid.innerHTML = themeSwatchesHtml();
    this.accent = colorRow('Accent colour', (hex) => { setAccent(hex); this.syncTheme(); }, 'accentColor');
    this.intensity = sliderRow('Accent intensity', 0, 1.5, 0.05, (v) => setIntensity(v), 'intensity', 1);
    this.menusRow = toggleRow('On macOS, keep the menus in the window (next start)', (v) => {
      try { localStorage.setItem(MENUS_IN_WINDOW_KEY, v ? '1' : '0'); } catch { return; }
    }, 'menusInWindow');
    const lightThemes = Object.entries(THEMES).filter(([, t]) => t.light).map(([id, t]) => [id, t.label] as const);
    const darkThemes = Object.entries(THEMES).filter(([, t]) => !t.light).map(([id, t]) => [id, t.label] as const);

    const reset = buttonRow('Reset to defaults', 'Reset all preferences...', () => this.armReset(), 'danger');
    this.resetBtn = reset.button;
    this.resetBtn.classList.add('cv-btn-fixed');

    this.add('General',
      grp('Startup',
        bind(segmentedRow('Start on', [['home', 'Home'], ['browse', 'The last folder']], (v) => this.change({ startPage: v as Prefs['startPage'] }), 'startPage'), (p) => p.startPage),
        note('Home shows the tools and recent folders. The last folder opens the browser where you left it.')),
      grp('Reset', reset.el, note('Every preference, the theme and accent and the Desktop utilities settings go back to how formtools comes. Your files are never touched. formtools reloads.')));

    this.add('Appearance',
      grp('Theme', this.grid,
        note('Right-click a theme to favorite it. Theme and accent are shared with the other Form apps on this device.'),
        this.accent.el, this.intensity.el,
        bind(toggleRow('Match System Appearance', (v) => this.change({ themeAuto: v }), 'themeAuto'), (p) => p.themeAuto),
        cols(
          bind(selectRow('Light theme', lightThemes, (v) => this.change({ themeLight: v }), 'themeLight'), (p) => p.themeLight),
          bind(selectRow('Dark theme', darkThemes, (v) => this.change({ themeDark: v }), 'themeDark'), (p) => p.themeDark)),
        note('Match System Appearance switches between the light and dark theme chosen here when the appearance of the system changes.')),
      grp('Text',
        bind(selectRow('Interface text size', UI_FONT_SIZES, (v) => this.change({ uiFontSize: v as UiFontSize }), 'uiFontSize'), (p) => p.uiFontSize)),
      grp('Motion',
        bind(toggleRow('Enable animations', (v) => this.change({ animations: v }), 'animations'), (p) => p.animations)));

    this.add('Browser',
      grp('Thumbnails',
        bind(sliderRow('Thumbnail size (px)', 96, 320, 8, (v) => this.change({ thumbSize: v }), 'thumbSize', 168), (p) => p.thumbSize),
        bind(segmentedRow('Layout', [['grid', 'Grid'], ['list', 'List']], (v) => this.change({ browserView: v as Prefs['browserView'] }), 'browserView'), (p) => p.browserView)),
      grp('Order',
        bind(selectRow('Sort by', [['name', 'Name'], ['date', 'Date'], ['size', 'Size'], ['type', 'Type']], (v) => this.change({ sortBy: v as Prefs['sortBy'] }), 'sortBy'), (p) => p.sortBy),
        bind(toggleRow('Reverse order', (v) => this.change({ sortDesc: v }), 'sortDesc'), (p) => p.sortDesc)),
      grp('Files',
        bind(toggleRow('Show hidden files', (v) => this.change({ showHidden: v }), 'showHidden'), (p) => p.showHidden)));

    this.add('Viewer',
      grp('Opening',
        bind(selectRow('Open images at', [['fit', 'Fit to window'], ['fill', 'Fill the window'], ['actual', 'Actual pixels']], (v) => this.change({ viewerFit: v as Prefs['viewerFit'] }), 'viewerFit'), (p) => p.viewerFit),
        bind(selectRow('Background', [['theme', 'Theme'], ['black', 'Black'], ['checker', 'Checkerboard']], (v) => this.change({ viewerBackground: v as Prefs['viewerBackground'] }), 'viewerBackground'), (p) => p.viewerBackground)),
      grp('Browsing',
        bind(sliderRow('Images ready ahead and behind', 0, 6, 1, (v) => this.change({ prefetch: v }), 'prefetch', 2), (p) => p.prefetch),
        bind(sliderRow('Slideshow interval (s)', 1, 60, 1, (v) => this.change({ slideshowSeconds: v }), 'slideshowSeconds', 4), (p) => p.slideshowSeconds),
        bind(toggleRow('Animated zoom', (v) => this.change({ smoothZoom: v }), 'smoothZoom'), (p) => p.smoothZoom)),
      grp('Saving',
        bind(toggleRow('Ask before saving a rotate or flip', (v) => this.change({ confirmTransform: v }), 'confirmTransform'), (p) => p.confirmTransform)));

    this.add('Desktop utilities',
      grp('Global shortcuts and screen tools', slot('desk')));

    this.add('Integration',
      grp('Menus', this.menusRow.el),
      grp('Open in its app', note('Open in its app hands a file to the Form app that makes it through FormPortal when FormPortal is installed, and to the system\'s default app otherwise.')),
      grp('File manager menu', slot('osmenu')));

    this.add('Keyboard shortcuts',
      grp('Shortcuts', note('Read only. The list comes from the command catalogue, the same one the command palette and the menus use.'), this.shortcuts.el));

    this.add('Privacy and data',
      grp('Where things are kept', this.engine.data,
        note('Preferences, the theme and the Desktop utilities settings stay in this window\'s storage. Ratings, labels and tags are written beside your files as XMP sidecars.')),
      grp('Privacy', note('Every file is read on this computer by formtools\' own engine. Nothing is uploaded.')));

    this.add('Engine',
      grp('Status', this.engine.status,
        note('formtools starts its engine on this computer and talks to it over a local port.')));

    const version = valueRow('Version');
    version.set(VERSION);
    this.add('About',
      grp('formtools', version.el,
        note('Copyright (C) 2026 NodeAgentc, Inc. Apache License 2.0.'),
        note('Part of the Form family of tools; theme, accent and file hand-off are shared with the other apps.')));

    for (const [name] of SECTIONS) {
      const card = this.sections.get(name);
      if (card) this.pages.appendChild(card);
    }

    let collapsed = false;
    try { collapsed = localStorage.getItem(RAIL_KEY) === '1'; } catch { collapsed = false; }
    const fold = el<HTMLButtonElement>(`<button class="cv-prefs-fold" type="button">${icon('pfFold', 16)}</button>`);
    const paintRail = (): void => {
      setClass(this.frame, 'is-rail-collapsed', collapsed);
      const title = collapsed ? 'Expand tabs' : 'Collapse tabs';
      if (fold.title !== title) { fold.title = title; fold.setAttribute('aria-label', title); }
      fold.setAttribute('aria-expanded', String(!collapsed));
    };
    fold.addEventListener('click', () => {
      collapsed = !collapsed;
      try { localStorage.setItem(RAIL_KEY, collapsed ? '1' : '0'); } catch { paintRail(); }
      paintRail();
      this.queueWire();
    });
    paintRail();
    const rail = el('<div class="cv-prefs-rail"></div>');
    rail.append(this.nav, fold);
    const wire = el<HTMLElement>('<svg class="cv-prefs-wire" aria-hidden="true"><path class="cv-prefs-wire-shade"></path><path class="cv-prefs-wire-line"></path></svg>') as unknown as SVGSVGElement;
    const port = el('<span class="cv-prefs-port" aria-hidden="true"></span>');
    this.frame.append(rail, wire, port);
    this.shell = { frame: this.frame, rail, port, shade: q<SVGPathElement>(wire, '.cv-prefs-wire-shade'), line: q<SVGPathElement>(wire, '.cv-prefs-wire-line') };

    this.listen();
    this.markSection(SECTIONS[0][0]);
  }

  private add(name: string, ...groups: HTMLElement[]): void {
    const ic = SECTIONS.find(([n]) => n === name)?.[1] ?? 'pfGeneral';
    const tab = el<HTMLButtonElement>(`<button class="cv-prefs-railtab" type="button" role="tab" aria-selected="false"><span class="cv-prefs-tabicon">${icon(ic, 18)}</span><span class="cv-prefs-tablabel"></span></button>`);
    tab.dataset.section = name;
    tab.title = name;
    setText(q(tab, '.cv-prefs-tablabel'), name);
    tab.addEventListener('click', () => this.showSection(name, 'smooth'));
    this.nav.appendChild(tab);
    const card = el(`<section class="cv-prefs-page cv-prefs-sec" role="tabpanel" aria-label="${name}"><button class="cv-prefs-sechead" type="button" aria-expanded="true"><span class="cv-prefs-secicon">${icon(ic, 16)}</span><span class="cv-prefs-seclabel"></span><span class="cv-prefs-chev">${icon('chevronDown', 16)}</span></button><div class="cv-prefs-secbody"></div></section>`);
    card.dataset.section = name;
    setText(q(card, '.cv-prefs-seclabel'), name);
    q(card, '.cv-prefs-sechead').addEventListener('click', () => this.foldSection(name));
    q(card, '.cv-prefs-secbody').append(...groups);
    this.sections.set(name, card);
  }

  private listen(): void {
    q(this.root, '[data-close]').addEventListener('click', () => this.close());
    q(this.root, '[data-done]').addEventListener('click', () => this.close());
    this.root.addEventListener('pointerdown', (e) => { if (e.target === this.root) this.close(); });
    this.root.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); this.close(); }
    });
    this.bindMove();
    this.pages.addEventListener('scroll', () => this.queueSpy(), { passive: true });
    new ResizeObserver(() => this.queueWire()).observe(this.frame);
    window.addEventListener('resize', () => this.queueWire());
    this.grid.addEventListener('click', (e) => {
      const id = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-theme-id]')?.dataset.themeId : undefined;
      if (!id || !THEMES[id]) return;
      setTheme(id);
      this.syncTheme();
    });
    this.grid.addEventListener('contextmenu', (e) => {
      const id = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-theme-id]')?.dataset.themeId : undefined;
      if (!id) return;
      e.preventDefault();
      const cur = this.prefs.favouriteThemes;
      this.change({ favouriteThemes: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
      this.syncTheme();
    });
    document.addEventListener('nm:ui-settings-changed', () => { if (this.isOpen) this.syncTheme(); });
    this.nav.addEventListener('keydown', (e) => {
      const step = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
      if (!step || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const tabs = Array.from(this.nav.children) as HTMLElement[];
      const at = tabs.indexOf(document.activeElement as HTMLElement);
      if (at < 0) return;
      e.preventDefault();
      const next = tabs[(at + step + tabs.length) % tabs.length];
      next.focus();
      this.showSection(next.dataset.section ?? '', 'smooth');
    });
  }

  private bindMove(): void {
    let spot = { x: 0, y: 0 };
    try {
      const s = JSON.parse(localStorage.getItem(SPOT_KEY) ?? '{}') as { x?: unknown; y?: unknown };
      if (typeof s.x === 'number' && typeof s.y === 'number') spot = { x: s.x, y: s.y };
    } catch { spot = { x: 0, y: 0 }; }
    this.offset = spot;
    const head = q(this.frame, '.cv-dialog-head');
    head.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || (e.target instanceof Element && e.target.closest('button'))) return;
      const at = { ...this.offset }, sx = e.clientX, sy = e.clientY;
      head.setPointerCapture(e.pointerId);
      const move = (ev: PointerEvent): void => this.moveFrame(at.x + ev.clientX - sx, at.y + ev.clientY - sy);
      const up = (): void => {
        head.removeEventListener('pointermove', move);
        head.removeEventListener('pointerup', up);
        head.removeEventListener('pointercancel', up);
        try { localStorage.setItem(SPOT_KEY, JSON.stringify(this.offset)); } catch { return; }
      };
      head.addEventListener('pointermove', move);
      head.addEventListener('pointerup', up);
      head.addEventListener('pointercancel', up);
    });
  }

  private moveFrame(x: number, y: number): void {
    const was = this.offset, r = this.frame.getBoundingClientRect();
    if (!r.width) return;
    const left = r.left - was.x, top = r.top - was.y;
    const nx = Math.min(Math.max(x, 48 - r.width - left), window.innerWidth - 48 - left);
    const ny = Math.min(Math.max(y, -top), window.innerHeight - 44 - top);
    this.offset = { x: nx, y: ny };
    this.frame.style.translate = nx || ny ? `${nx}px ${ny}px` : '';
  }

  private change(patch: Partial<Prefs>): void {
    this.prefs = updatePrefs(patch);
  }

  private armReset(): void {
    const btn = this.resetBtn;
    if (btn.dataset.armed !== '1') {
      btn.dataset.armed = '1';
      setText(btn, 'Click again to reset everything');
      window.clearTimeout(this.resetTimer);
      this.resetTimer = window.setTimeout(() => this.disarmReset(), 4000);
      return;
    }
    window.clearTimeout(this.resetTimer);
    try {
      for (const k of Object.keys(localStorage)) if (isOwnKey(k)) localStorage.removeItem(k);
    } catch { return; }
    location.reload();
  }

  private disarmReset(): void {
    window.clearTimeout(this.resetTimer);
    if (this.resetBtn.dataset.armed === '1') {
      delete this.resetBtn.dataset.armed;
      setText(this.resetBtn, 'Reset all preferences...');
    }
  }

  private syncTheme(): void {
    const c = readChoice();
    setValue(q<HTMLInputElement>(this.accent.el, 'input'), c.accentColor);
    this.intensity.set(c.intensity ?? 1);
    for (const b of Array.from(this.grid.querySelectorAll<HTMLElement>('[data-theme-id]'))) {
      const id = b.dataset.themeId ?? '';
      const active = id === c.theme;
      setClass(b, 'is-active', active);
      b.setAttribute('aria-pressed', String(active));
      const fav = this.prefs.favouriteThemes.includes(id);
      setClass(b, 'is-fav', fav);
      const order = fav ? '-1' : '0';
      if (b.style.order !== order) b.style.order = order;
      const label = THEMES[id]?.label ?? id;
      const title = fav ? `${label} (favorite, right-click to remove)` : `${label} (right-click to add to favorites)`;
      if (b.title !== title) b.title = title;
      const border = active ? c.accentColor : THEMES[id]?.vars['--border-color'] ?? '';
      if (b.dataset.border !== border) { b.dataset.border = border; b.style.borderColor = border; }
    }
  }

  private sync(): void {
    this.prefs = loadPrefs();
    for (const set of this.setters) set(this.prefs);
    this.menusRow.set(menusInWindow());
    this.syncTheme();
    this.disarmReset();
  }

  private resolve(section?: string): string {
    if (!section) return SECTIONS[0][0];
    const low = section.toLowerCase();
    const alias = ALIASES[low];
    const hit = SECTIONS.find(([n]) => n === section || n.toLowerCase() === low || n === alias);
    return hit ? hit[0] : SECTIONS[0][0];
  }

  private showSection(name: string, scroll: ScrollBehavior | null = null): void {
    if (!this.sections.has(name)) return;
    this.markSection(name);
    if (scroll) this.scrollToSection(name, scroll);
  }

  private markSection(name: string): void {
    if (this.current === name) return;
    this.current = name;
    for (const [n, page] of this.sections) setClass(page, 'is-current', n === name);
    for (const tab of Array.from(this.nav.children) as HTMLElement[]) {
      const on = tab.dataset.section === name;
      setClass(tab, 'is-active', on);
      tab.setAttribute('aria-selected', String(on));
    }
    this.queueWire();
  }

  private scrollToSection(name: string, behavior: ScrollBehavior): void {
    const sec = this.sections.get(name);
    if (!sec) return;
    if (sec.classList.contains('is-folded')) this.foldSection(name);
    const top = sec.getBoundingClientRect().top - this.pages.getBoundingClientRect().top + this.pages.scrollTop - 12;
    this.spyMuted = performance.now() + 700;
    this.pages.scrollTo({ top, behavior });
  }

  private foldSection(name: string): void {
    const sec = this.sections.get(name);
    if (!sec) return;
    const folded = !sec.classList.contains('is-folded');
    setClass(sec, 'is-folded', folded);
    setHidden(q(sec, '.cv-prefs-secbody'), folded);
    q(sec, '.cv-prefs-sechead').setAttribute('aria-expanded', String(!folded));
    this.queueWire();
    this.queueSpy();
  }

  private queueSpy(): void {
    if (this.spyRaf) return;
    this.spyRaf = requestAnimationFrame(() => {
      this.spyRaf = 0;
      const pages = this.pages;
      if (!pages.clientHeight || performance.now() < this.spyMuted) return;
      const edge = pages.getBoundingClientRect().top + 24;
      const names = Array.from(this.sections.keys());
      let best = '', bestD = Infinity;
      if (pages.scrollHeight > pages.clientHeight + 4 && pages.scrollTop + pages.clientHeight >= pages.scrollHeight - 2) best = names[names.length - 1] ?? '';
      else {
        for (const [n, sec] of this.sections) {
          const top = sec.getBoundingClientRect().top, d = top <= edge ? edge - top : top - edge + 100000;
          if (d < bestD) { bestD = d; best = n; }
        }
      }
      if (best) this.markSection(best);
    });
  }

  private queueWire(): void {
    if (this.wireRaf) return;
    this.wireRaf = requestAnimationFrame(() => { this.wireRaf = 0; this.drawWire(); });
  }

  private drawWire(): void {
    const s = this.shell;
    if (this.root.hidden) return;
    const F = s.frame.getBoundingClientRect();
    const tab = this.nav.querySelector<HTMLElement>('.cv-prefs-railtab.is-active');
    const head = s.frame.querySelector<HTMLElement>('.cv-dialog-head');
    if (!F.width || !tab || !head) return;
    const N = this.nav.getBoundingClientRect();
    let T = tab.getBoundingClientRect();
    if (T.top < N.top || T.bottom > N.bottom) {
      this.nav.scrollTop += T.top < N.top ? T.top - N.top - 6 : T.bottom - N.bottom + 6;
      T = tab.getBoundingClientRect();
    }
    const R = s.rail.getBoundingClientRect(), H = head.getBoundingClientRect();
    const portY = Math.round(H.bottom - F.top), sx = Math.round(T.right - F.left), ty = Math.round(T.top - F.top + T.height / 2);
    const rr = R.right - F.left, trunk = Math.round(rr - rr * 0.45), dy = portY - ty, r = 10, dir = dy > 0 ? 1 : -1;
    const d = Math.abs(dy) < 2 * r
      ? `M ${sx} ${ty} H ${trunk} V ${portY} H -7`
      : `M ${sx} ${ty} H ${trunk - r} a ${r} ${r} 0 0 ${dir > 0 ? 1 : 0} ${r} ${dir * r} V ${portY - dir * r} a ${r} ${r} 0 0 ${dir > 0 ? 0 : 1} ${r} ${dir * r} H -7`;
    if (d !== this.wireD) { this.wireD = d; s.shade.setAttribute('d', d); s.line.setAttribute('d', d); }
    if (portY !== this.portY) { this.portY = portY; s.port.style.transform = `translateY(${portY}px)`; }
  }

  get isOpen(): boolean { return !this.root.hidden; }

  mount(slot: string, node: HTMLElement, onOpen?: () => void): void {
    this.pages.querySelector(`[data-slot="${slot}"]`)?.replaceWith(node);
    if (onOpen) this.openers.push(onOpen);
  }

  open(section?: string): void {
    if (this.isOpen) return;
    for (const fn of this.openers) fn();
    this.shortcuts.refresh();
    void this.engine.refresh();
    this.sync();
    this.lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const name = this.resolve(section);
    this.markSection(name);
    this.root.hidden = false;
    if (this.offset.x || this.offset.y) {
      const kept = this.offset;
      this.offset = { x: 0, y: 0 };
      this.frame.style.translate = '';
      this.moveFrame(kept.x, kept.y);
    }
    this.scrollToSection(name, 'auto');
    q<HTMLElement>(this.nav, '.cv-prefs-railtab.is-active').focus({ preventScroll: true });
    if (!this.root.contains(document.activeElement)) this.frame.focus({ preventScroll: true });
    this.queueWire();
  }

  close(): void {
    if (this.root.hidden) return;
    this.root.hidden = true;
    this.disarmReset();
    if (this.root.contains(document.activeElement) && document.activeElement instanceof HTMLElement) document.activeElement.blur();
    if (this.lastFocus && typeof this.lastFocus.focus === 'function') this.lastFocus.focus({ preventScroll: true });
  }
}

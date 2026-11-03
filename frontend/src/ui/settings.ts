import { el, q, setChecked, setClass, setText, setValue } from './dom';
import { icon } from './icons';
import { loadPrefs, updatePrefs, type Prefs } from './prefs';
import { readChoice, setAccent, setTheme, themeSwatchesHtml, THEMES } from './themes';
import { MENUS_IN_WINDOW_KEY, menusInWindow } from './native-menu';
import { VERSION } from '../version';

const SECTIONS: Array<[string, string, string]> = [
  ['general', 'General', 'pfGeneral'],
  ['appearance', 'Appearance', 'theme'],
  ['browser', 'Browser', 'ftBrowse'],
  ['viewer', 'Viewer', 'ftViewer'],
  ['desk', 'Desktop utilities', 'ftDesk'],
  ['integration', 'Integration', 'ftFamily'],
  ['about', 'About', 'info'],
];

const select = (key: keyof Prefs, label: string, options: Array<[string, string]>): string =>
  `<label class="ft-row"><span class="ft-row-label">${label}</span><select class="cv-hf-sort" data-pref="${key}">${options.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select></label>`;
const check = (key: keyof Prefs, label: string): string =>
  `<label class="ft-row"><span class="ft-row-label">${label}</span><input type="checkbox" class="ft-check" data-pref="${key}"></label>`;
const range = (key: keyof Prefs, label: string, min: number, max: number, step: number, unit: string): string =>
  `<label class="ft-row"><span class="ft-row-label">${label}</span><span class="ft-range"><input type="range" min="${min}" max="${max}" step="${step}" data-pref="${key}"><output class="ft-range-out" data-out="${key}" data-unit="${unit}"></output></span></label>`;

export class SettingsDialog {
  readonly root: HTMLElement;
  private readonly body: HTMLElement;
  private lastFocus: Element | null = null;

  constructor() {
    this.root = el<HTMLElement>(`
      <div class="cv-scrim ft-settings-scrim" hidden>
        <div class="cv-dialog ft-settings" role="dialog" aria-modal="true" aria-label="Preferences">
          <header class="ft-dlg-head"><span class="ft-dlg-title">Preferences</span><button class="cv-tt-btn" type="button" data-close title="Close" aria-label="Close">${icon('close', 16)}</button></header>
          <div class="ft-settings-grid">
            <nav class="ft-rail">${SECTIONS.map(([id, label, ic]) => `<button class="ft-rail-item" type="button" data-sec="${id}">${icon(ic, 16)}<span>${label}</span></button>`).join('')}</nav>
            <div class="ft-settings-body">
              <section class="ft-sec" data-sec="general"><h3>General</h3>
                ${select('startPage', 'Start on', [['home', 'Home'], ['browse', 'The last folder']])}
              </section>
              <section class="ft-sec" data-sec="appearance"><h3>Appearance</h3>
                <div class="ft-row ft-row-col"><span class="ft-row-label">Theme</span><div class="ft-swatches"></div></div>
                <label class="ft-row"><span class="ft-row-label">Accent colour</span><input type="color" class="ft-accent" aria-label="Accent colour"></label>
              </section>
              <section class="ft-sec" data-sec="browser"><h3>Browser</h3>
                ${range('thumbSize', 'Thumbnail size', 96, 320, 8, ' px')}
                ${select('browserView', 'Layout', [['grid', 'Grid'], ['list', 'List']])}
                ${select('sortBy', 'Sort by', [['name', 'Name'], ['date', 'Date'], ['size', 'Size'], ['type', 'Type']])}
                ${check('sortDesc', 'Reverse order')}
                ${check('showHidden', 'Show hidden files')}
              </section>
              <section class="ft-sec" data-sec="viewer"><h3>Viewer</h3>
                ${select('viewerFit', 'Open images at', [['fit', 'Fit to window'], ['fill', 'Fill the window'], ['actual', 'Actual pixels']])}
                ${select('viewerBackground', 'Background', [['theme', 'Theme'], ['black', 'Black'], ['checker', 'Checkerboard']])}
                ${range('prefetch', 'Images ready ahead and behind', 0, 6, 1, '')}
                ${range('slideshowSeconds', 'Slideshow interval', 1, 60, 1, ' s')}
                ${check('confirmTransform', 'Ask before saving a rotate or flip')}
              </section>
              <div class="ft-sec-slot" data-slot="desk"></div>
              <section class="ft-sec" data-sec="integration"><h3>Integration</h3>
                <label class="ft-row"><span class="ft-row-label">On macOS, keep the menus in the window (next start)</span><input type="checkbox" class="ft-check ft-menus-in-window"></label>
                <p class="ft-note">Open in its app hands a file to the Form app that makes it through FormPortal when FormPortal is installed, and to the system's default app otherwise.</p>
              </section>
              <section class="ft-sec" data-sec="about"><h3>About</h3>
                <p class="ft-note">formtools ${VERSION} · Copyright (C) 2026 NodeAgentc, Inc. · Apache License 2.0</p>
                <p class="ft-note">Every file is read on this computer by formtools' own engine. Nothing is uploaded.</p>
              </section>
            </div>
          </div>
        </div>
      </div>`);
    this.body = q(this.root, '.ft-settings-body');
    q(this.root, '.ft-swatches').innerHTML = themeSwatchesHtml();
    this.wire();
  }

  private wire(): void {
    this.root.addEventListener('click', (e) => {
      const t = e.target instanceof Element ? e.target : null;
      if (t === this.root || t?.closest('[data-close]')) { this.close(); return; }
      const sec = t?.closest<HTMLElement>('.ft-rail-item')?.dataset.sec;
      if (sec) { q(this.body, `.ft-sec[data-sec="${sec}"]`).scrollIntoView({ block: 'start', behavior: 'smooth' }); this.mark(sec); return; }
      const sw = t?.closest<HTMLElement>('[data-theme-id]')?.dataset.themeId;
      if (sw && THEMES[sw]) { setTheme(sw); this.syncSwatches(); }
    });
    this.body.addEventListener('change', (e) => this.change(e.target));
    this.body.addEventListener('input', (e) => { const t = e.target; if (t instanceof HTMLInputElement && t.type === 'range') this.out(t); });
    this.body.addEventListener('scroll', () => {
      const top = this.body.getBoundingClientRect().top;
      let cur = SECTIONS[0][0];
      for (const s of this.body.querySelectorAll<HTMLElement>('.ft-sec')) if (s.getBoundingClientRect().top - top < 80) cur = s.dataset.sec ?? cur;
      this.mark(cur);
    }, { passive: true });
    q<HTMLInputElement>(this.root, '.ft-accent').addEventListener('input', (e) => setAccent((e.target as HTMLInputElement).value));
    q<HTMLInputElement>(this.root, '.ft-menus-in-window').addEventListener('change', (e) => {
      try { localStorage.setItem(MENUS_IN_WINDOW_KEY, (e.target as HTMLInputElement).checked ? '1' : '0'); } catch { return; }
    });
    this.root.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.close(); } });
  }

  private change(t: EventTarget | null): void {
    if (!(t instanceof HTMLInputElement || t instanceof HTMLSelectElement)) return;
    const key = t.dataset.pref as keyof Prefs | undefined;
    if (!key) return;
    let v: unknown = t.value;
    if (t instanceof HTMLInputElement && t.type === 'checkbox') v = t.checked;
    else if (t instanceof HTMLInputElement && t.type === 'range') v = Number(t.value);
    updatePrefs({ [key]: v } as Partial<Prefs>);
  }

  private out(input: HTMLInputElement): void {
    const o = this.body.querySelector<HTMLOutputElement>(`[data-out="${input.dataset.pref}"]`);
    if (o) setText(o, `${input.value}${o.dataset.unit ?? ''}`);
  }

  private mark(sec: string): void {
    for (const b of this.root.querySelectorAll<HTMLElement>('.ft-rail-item')) setClass(b, 'is-active', b.dataset.sec === sec);
  }

  private syncSwatches(): void {
    const cur = readChoice().theme;
    for (const s of this.root.querySelectorAll<HTMLElement>('[data-theme-id]')) setClass(s, 'is-active', s.dataset.themeId === cur);
  }

  private sync(): void {
    const p = loadPrefs();
    for (const n of this.body.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-pref]')) {
      const v = p[n.dataset.pref as keyof Prefs];
      if (n instanceof HTMLInputElement && n.type === 'checkbox') setChecked(n, v === true);
      else { setValue(n, String(v)); if (n instanceof HTMLInputElement && n.type === 'range') this.out(n); }
    }
    setValue(q<HTMLInputElement>(this.root, '.ft-accent'), readChoice().accentColor);
    setChecked(q<HTMLInputElement>(this.root, '.ft-menus-in-window'), menusInWindow());
    this.syncSwatches();
  }

  get isOpen(): boolean { return !this.root.hidden; }

  private readonly openers: Array<() => void> = [];

  mount(slot: string, node: HTMLElement, onOpen?: () => void): void {
    this.body.querySelector(`[data-slot="${slot}"]`)?.replaceWith(node);
    if (onOpen) this.openers.push(onOpen);
  }

  open(section = 'general'): void {
    for (const fn of this.openers) fn();
    this.sync();
    this.lastFocus = document.activeElement;
    this.root.hidden = false;
    this.mark(section);
    q(this.body, `.ft-sec[data-sec="${section}"]`).scrollIntoView({ block: 'start' });
    q<HTMLElement>(this.root, '.ft-rail-item.is-active').focus({ preventScroll: true });
  }

  close(): void {
    if (this.root.hidden) return;
    this.root.hidden = true;
    if (this.lastFocus instanceof HTMLElement) this.lastFocus.focus({ preventScroll: true });
  }
}

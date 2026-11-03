import './icons';
import type { DeskCaps, DeskResult, DeskTool, DeskUtility } from '../../io/desk';
import { desk } from '../../io/desk';
import { el, q, setClass, setHidden } from '../dom';
import { icon } from '../icons';
import { AwakeSection } from './awake';
import type { DeskDeps, DeskSection, SectionId } from './common';
import { EnvSection } from './env';
import { HostsSection } from './hosts';
import { PickerSection } from './picker';
import { RulerSection } from './ruler';
import { deskCaps, deskCapsError } from './store';
import { TextSection } from './text';
import { TimerSection } from './timer';
import { TopmostSection } from './topmost';
import { ZoomSection } from './zoom';

const TABS: Array<[SectionId, string, string, DeskUtility[]]> = [
  ['picker', 'Colour picker', 'ftPicker', ['picker']],
  ['ruler', 'Screen ruler', 'ftRuler', ['ruler']],
  ['text', 'Text extractor', 'ftOcr', ['text']],
  ['zoom', 'Zoom and draw', 'ftZoomDraw', ['zoom', 'draw']],
  ['timer', 'Break timer', 'ftTimer', ['timer']],
  ['awake', 'Awake', 'ftAwake', ['awake']],
  ['topmost', 'Always on top', 'ftTopmost', ['topmost']],
  ['hosts', 'Hosts file', 'ftHosts', ['hosts']],
  ['env', 'Environment', 'ftEnv', ['env']],
];

const ALIAS: Record<string, SectionId> = { draw: 'zoom', color: 'picker', colour: 'picker', ocr: 'text', measure: 'ruler', break: 'timer', pin: 'topmost', environment: 'env' };

export class DeskPage {
  readonly root = el<HTMLElement>(`<section class="ft-deskp ft-page" aria-label="Desktop utilities" data-page="desk" hidden>
      <div class="ft-vbar ft-tools-bar">
        <button class="cv-tt-btn" type="button" data-t="back" title="Back (Escape)" aria-label="Back">${icon('chevronLeft', 16)}</button>
        <nav class="ft-seg ft-tools-tabs ft-desk-tabs">${TABS.map(([id, label, ic]) => `<button type="button" class="ft-seg-btn" data-tab="${id}">${icon(ic, 14)} ${label}</button>`).join('')}</nav>
      </div>
      <div class="ft-desk-pages"></div>
    </section>`);
  current: SectionId = 'picker';
  private readonly sections: Record<SectionId, DeskSection>;
  private caps: DeskCaps | null = null;

  constructor(private readonly deps: DeskDeps) {
    this.sections = {
      picker: new PickerSection(deps), ruler: new RulerSection(deps), text: new TextSection(deps), zoom: new ZoomSection(deps),
      timer: new TimerSection(deps), awake: new AwakeSection(deps), topmost: new TopmostSection(deps), hosts: new HostsSection(deps), env: new EnvSection(deps),
    };
    q(this.root, '.ft-desk-pages').append(...TABS.map(([id]) => this.sections[id].root));
    setHidden(q(this.root, '[data-t="back"]'), !deps.back);
    this.root.addEventListener('click', (e) => {
      const t = e.target instanceof Element ? e.target : null;
      if (t?.closest('[data-t="back"]')) { this.deps.back?.(); return; }
      const tab = t?.closest<HTMLElement>('[data-tab]')?.dataset.tab as SectionId | undefined;
      if (tab) this.show(tab);
    });
    this.root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.deps.back && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement)) { e.preventDefault(); this.deps.back(); }
    });
    this.paint();
    void deskCaps().then((caps) => { this.caps = caps; this.support(); });
    this.support();
  }

  show(section?: string): void {
    const id = section ? (ALIAS[section] ?? section) as SectionId : this.current;
    if (this.sections[id]) this.current = id;
    const tab = q(this.root, `[data-tab="${this.current}"]`);
    if (tab.hidden) this.current = (TABS.find(([t]) => !q(this.root, `[data-tab="${t}"]`).hidden)?.[0] ?? this.current);
    this.paint();
    this.sections[this.current].shown();
  }

  handleShortcut(id: string): void {
    const key: string = id;
    if (key === 'topmost') { this.sections.topmost.run(); return; }
    if (key === 'draw') { this.sections.zoom.run('draw'); return; }
    if (key === 'zoom') { this.sections.zoom.run('zoom'); return; }
    const sec = this.sections[key as SectionId];
    if (sec) sec.run(key as DeskTool);
  }

  handleResult(r: DeskResult): void {
    const key: SectionId | undefined = r.tool === 'draw' ? 'zoom' : this.sections[r.tool as SectionId] ? r.tool as SectionId : undefined;
    if (key) this.sections[key].result(r);
  }

  private paint(): void {
    for (const [id] of TABS) {
      setClass(q(this.root, `[data-tab="${id}"]`), 'is-on', id === this.current);
      setHidden(this.sections[id].root, id !== this.current);
    }
  }

  private support(): void {
    const caps = this.caps;
    if (!caps) {
      const why = desk.available() ? deskCapsError() || 'Checking what this computer supports.' : '';
      for (const [id] of TABS) this.sections[id].setSupport(false, why || this.sections[id].offline);
      return;
    }
    let any = false;
    for (const [, , , keys] of TABS) if (keys.some((k) => caps.utilities[k]?.ok === true)) any = true;
    for (const [id, , , keys] of TABS) {
      const sec = this.sections[id];
      const hit = keys.map((k) => caps.utilities[k]).find((s) => s?.ok) ?? caps.utilities[keys[0]];
      const ok = hit?.ok === true;
      sec.describe(caps);
      sec.setSupport(ok, hit?.reason || 'This is not available on this computer.');
      setHidden(q(this.root, `[data-tab="${id}"]`), any && !ok);
    }
    if (q(this.root, `[data-tab="${this.current}"]`).hidden) this.show();
    else if (!this.root.hidden) this.sections[this.current].shown();
  }
}

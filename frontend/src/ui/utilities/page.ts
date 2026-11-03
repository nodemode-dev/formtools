import './icons';
import { el, q, setClass, setHidden } from '../dom';
import { icon } from '../icons';
import { ChecksumsView } from './checksums';
import { CleanupView } from './cleanup';
import type { UtilDeps } from './common';
import { DiskUsageView } from './diskusage';
import { DupesView } from './dupes';
import { LocksView, TemplatesView } from './templates';

export type UtilId = 'dupes' | 'disk' | 'hash' | 'cleanup' | 'templates' | 'locks';

const TABS: Array<[UtilId, string, string]> = [
  ['dupes', 'Duplicates', 'ftDuplicate'], ['disk', 'Disk usage', 'ftDisk'], ['hash', 'Checksums', 'ftHash'],
  ['cleanup', 'Clean up', 'ftSweep'], ['templates', 'New from template', 'ftTemplate'], ['locks', 'Open by', 'ftLocked'],
];

interface View { root: HTMLElement; show(inputs?: string[]): void }

export class UtilitiesPage {
  readonly root = el<HTMLElement>(`<section class="ft-utilp ft-page" aria-label="Utilities" data-page="util" hidden>
      <div class="ft-vbar ft-tools-bar">
        <button class="cv-tt-btn" type="button" data-t="back" title="Back (Escape)" aria-label="Back">${icon('chevronLeft', 16)}</button>
        <nav class="ft-seg ft-tools-tabs">${TABS.map(([id, label, ic]) => `<button type="button" class="ft-seg-btn" data-tab="${id}">${icon(ic, 14)} ${label}</button>`).join('')}</nav>
      </div>
      <div class="ft-tools-body"></div>
    </section>`);
  current: UtilId = 'dupes';
  private readonly views: Record<UtilId, View>;

  constructor(deps: UtilDeps, private readonly back: () => void) {
    this.views = {
      dupes: new DupesView(deps), disk: new DiskUsageView(deps), hash: new ChecksumsView(deps),
      cleanup: new CleanupView(deps), templates: new TemplatesView(deps), locks: new LocksView(deps),
    };
    q(this.root, '.ft-tools-body').append(...Object.values(this.views).map((v) => v.root));
    this.root.addEventListener('click', (e) => {
      const t = e.target instanceof Element ? e.target : null;
      if (t?.closest('[data-t="back"]')) { this.back(); return; }
      const tab = t?.closest<HTMLElement>('[data-tab]')?.dataset.tab as UtilId | undefined;
      if (tab) this.show(tab);
    });
    this.root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement)) { e.preventDefault(); this.back(); }
    });
  }

  show(id: UtilId, inputs?: string[]): void {
    this.current = id;
    for (const [tab] of TABS) {
      setClass(q(this.root, `[data-tab="${tab}"]`), 'is-on', tab === id);
      setHidden(this.views[tab].root, tab !== id);
    }
    this.views[id].show(inputs);
  }
}

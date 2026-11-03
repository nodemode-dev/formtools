import { el, q, setClass, setHidden } from '../dom';
import { icon } from '../icons';
import type { Jobs } from '../jobs';
import { BatchTool } from './batch';
import { RenameTool } from './rename';
import { ResizeTool } from './resize';

export type ToolId = 'convert' | 'resize' | 'rename';

const TABS: Array<[ToolId, string, string]> = [['convert', 'Batch convert', 'ftBatch'], ['resize', 'Resize', 'ftResize'], ['rename', 'Rename', 'ftRename']];

export class ToolsPage {
  readonly root = el<HTMLElement>(`<section class="ft-toolsp ft-page" aria-label="Tools" data-page="tool" hidden>
      <div class="ft-vbar ft-tools-bar">
        <button class="cv-tt-btn" type="button" data-t="back" title="Back (Escape)" aria-label="Back">${icon('chevronLeft', 16)}</button>
        <nav class="ft-seg ft-tools-tabs">${TABS.map(([id, label, ic]) => `<button type="button" class="ft-seg-btn" data-tab="${id}">${icon(ic, 14)} ${label}</button>`).join('')}</nav>
      </div>
      <div class="ft-tools-body"></div>
    </section>`);
  readonly batch: BatchTool;
  readonly resize: ResizeTool;
  readonly rename: RenameTool;
  current: ToolId = 'convert';

  constructor(selection: () => string[], jobs: Jobs, private readonly back: () => void, changed: () => void) {
    this.batch = new BatchTool(selection, jobs, changed);
    this.resize = new ResizeTool(selection, jobs, changed);
    this.rename = new RenameTool(selection, changed);
    q(this.root, '.ft-tools-body').append(this.batch.root, this.resize.root, this.rename.root);
    this.root.addEventListener('click', (e) => {
      const t = e.target instanceof Element ? e.target : null;
      if (t?.closest('[data-t="back"]')) { this.back(); return; }
      const tab = t?.closest<HTMLElement>('[data-tab]')?.dataset.tab as ToolId | undefined;
      if (tab) this.show(tab);
    });
    this.root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement)) { e.preventDefault(); this.back(); }
    });
  }

  show(tool: ToolId, inputs?: string[]): void {
    this.current = tool;
    for (const [id] of TABS) {
      setClass(q(this.root, `[data-tab="${id}"]`), 'is-on', id === tool);
      setHidden(q(this.root, `.ft-tool-page[data-tool="${id}"]`), id !== tool);
    }
    const t = tool === 'convert' ? this.batch : tool === 'resize' ? this.resize : this.rename;
    if (inputs && inputs.length) t.inputs.set(inputs);
    if (tool === 'convert') void this.batch.start();
  }
}

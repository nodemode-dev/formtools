import type { DeskCaps, DeskResult, DeskTool } from '../../io/desk';
import { q, setDisabled, setText } from '../dom';
import { toast } from '../toast';
import { accelLabel } from './accel';
import { btn, DeskSection, startTool, textOf, type DeskDeps } from './common';
import { HistoryList } from './history';
import { loadDeskPrefs } from './store';

const ENGINES: Record<string, string> = { vision: 'macOS Vision', windows: 'Windows text recognition', tesseract: 'Tesseract' };

export class TextSection extends DeskSection {
  private readonly history: HistoryList;

  constructor(deps: DeskDeps) {
    super('text', 'Text extractor', 'ftOcr', 'The text extractor runs in the desktop app. Open formtools there to copy text out of anything on your screen.', `
        <div class="ft-desk-actions">
          ${btn('extract', 'ftOcr', 'Extract text', true)}
          <span class="ft-desk-hint"></span>
          ${btn('clear', 'ftTrashCan', 'Clear the list')}
        </div>
        <p class="ft-note ft-desk-engine"></p>
        <div class="ft-desk-history-slot"></div>`, deps);
    this.history = new HistoryList('formtools_desk_texts', 12, 'Nothing extracted yet. Press Extract text, then drag over the words you want; they are copied at once.', deps, () => this.sync());
    q(this.root, '.ft-desk-history-slot').replaceWith(this.history.root);
    this.root.addEventListener('click', (e) => {
      const act = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-act]')?.dataset.act : undefined;
      if (act === 'extract') this.run('text');
      else if (act === 'clear') this.history.clear();
    });
    this.sync();
  }

  override describe(caps: DeskCaps): void {
    const name = caps.ocr.engine ? ENGINES[caps.ocr.engine] ?? caps.ocr.engine : '';
    setText(q(this.root, '.ft-desk-engine'), name ? `Recognition by ${name}. The picture never leaves this computer.` : '');
  }

  override shown(): void {
    const p = loadDeskPrefs();
    setText(q(this.root, '.ft-desk-hint'), p.enabled.text && p.accel.text ? `Shortcut ${accelLabel(p.accel.text)}` : '');
  }

  override run(tool: DeskTool = 'text'): void {
    if (!this.supported) return;
    const lang = loadDeskPrefs().lang;
    void startTool(tool, lang ? { lang } : {}, this.deps);
  }

  override result(r: DeskResult): void {
    if (r.kind === 'error') { const t = String(r.value); this.deps.status(t); toast(t, 'error'); return; }
    if (r.kind !== 'text') return;
    const text = textOf(r.value).trim();
    if (!text) { this.deps.status('No text was found in that region.'); return; }
    this.history.add(text);
    this.deps.status(`Copied ${text.length} characters.`);
  }

  private sync(): void { setDisabled(q<HTMLButtonElement>(this.root, '[data-act="clear"]'), this.history.size === 0); }
}

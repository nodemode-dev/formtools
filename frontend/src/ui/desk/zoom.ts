import type { DeskCaps, DeskResult, DeskTool } from '../../io/desk';
import { q, setDisabled, setText, setTitle } from '../dom';
import { toast } from '../toast';
import { accelLabel } from './accel';
import { btn, DeskSection, startTool, type DeskDeps } from './common';
import { loadDeskPrefs } from './store';

export class ZoomSection extends DeskSection {
  constructor(deps: DeskDeps) {
    super('zoom', 'Zoom and draw', 'ftZoomDraw', 'Zoom and draw run in the desktop app. Open formtools there to magnify and annotate your screen.', `
        <div class="ft-desk-actions">
          ${btn('zoom', 'zoomIn', 'Zoom', true)}
          ${btn('draw', 'tPencil', 'Draw')}
          <span class="ft-desk-hint"></span>
        </div>
        <p class="ft-note">Zoom freezes the screen and magnifies it around the pointer: scroll or press plus and minus, 1.25 to 8 times. Press D to start drawing on it.</p>
        <p class="ft-note">Draw keys: pen, highlighter, line, arrow, rectangle, ellipse and text (T). R, G, B, Y, O and P pick a colour. Ctrl+Z undoes, E clears, W is a whiteboard, K a blackboard, Ctrl+C copies the marked-up screen as a picture. Escape closes.</p>`, deps);
    this.root.addEventListener('click', (e) => {
      const act = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-act]')?.dataset.act : undefined;
      if (act === 'zoom' || act === 'draw') this.run(act);
    });
  }

  override describe(caps: DeskCaps): void {
    const z = caps.utilities.zoom, d = caps.utilities.draw;
    const zb = q<HTMLButtonElement>(this.root, '[data-act="zoom"]'), db = q<HTMLButtonElement>(this.root, '[data-act="draw"]');
    setDisabled(zb, !z.ok);
    setDisabled(db, !d.ok);
    setTitle(zb, z.ok ? '' : z.reason);
    setTitle(db, d.ok ? '' : d.reason);
  }

  override shown(): void {
    const p = loadDeskPrefs();
    const keys = [p.enabled.zoom && p.accel.zoom ? `Zoom ${accelLabel(p.accel.zoom)}` : '', p.enabled.draw && p.accel.draw ? `Draw ${accelLabel(p.accel.draw)}` : ''].filter(Boolean);
    setText(q(this.root, '.ft-desk-hint'), keys.join('   '));
  }

  override run(tool: DeskTool = 'zoom'): void {
    if (!this.supported) return;
    const target = q<HTMLButtonElement>(this.root, `[data-act="${tool === 'draw' ? 'draw' : 'zoom'}"]`);
    if (target.disabled) return;
    void startTool(tool === 'draw' ? 'draw' : 'zoom', tool === 'draw' ? {} : { zoom: loadDeskPrefs().zoomStart }, this.deps);
  }

  override result(r: DeskResult): void {
    if (r.kind === 'error') { const t = String(r.value); this.deps.status(t); toast(t, 'error'); return; }
    if (r.kind === 'image') this.deps.status('Copied the marked-up screen as a picture.');
  }
}

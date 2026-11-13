import type { Entry } from '../../io/api';
import { docApi, type FontAxis, type FontInfo } from '../../io/doc-api';
import { el, patchList, q, setClass, setDisabled, setHidden, setText } from '../dom';
import { icon } from '../icons';
import './icons';
import { blockRange } from './blocks';
import { Seq, busy, copyText, errText, fmtInt } from './common';
import type { DocDeps, DocKind } from './types';

const SIZES = [12, 14, 16, 18, 24, 32, 48, 64, 96];
const DEFAULT_SAMPLE = 'The quick brown fox jumps over the lazy dog 0123456789';
const PAGE = 256;

let counter = 0;
let probe: CanvasRenderingContext2D | null = null;

function covers(family: string, ch: string): boolean {
  if (!probe) probe = document.createElement('canvas').getContext('2d');
  if (!probe) return true;
  probe.font = `32px "${family}", serif`;
  const a = probe.measureText(ch).width;
  probe.font = `32px "${family}", monospace`;
  return a === probe.measureText(ch).width;
}

interface Meta { label: string; value: string }

export class FontView implements DocKind {
  readonly root = el<HTMLElement>(`<section class="dv-panel dv-font" hidden>
      <div class="dv-bar">
        <input class="ft-input dv-sample-in" type="text" spellcheck="false" aria-label="Sample text" placeholder="Type a sample">
        <button class="ft-btn" type="button" data-f="reset" title="Restore the default sample">Reset</button>
        <span class="dv-gap"></span>
        <span class="dv-note"></span>
        <span class="dv-info"></span>
        <span class="ft-busy dv-spin"></span>
        <button class="ft-btn" type="button" data-f="install" title="Install for this user">${icon('dvInstall', 14)}<span>Install</span></button>
      </div>
      <div class="dv-font-body">
        <div class="dv-font-main">
          <div class="ft-panel dv-fbig"><div class="dv-fbig-text"></div></div>
          <div class="ft-panel dv-fwater"></div>
          <div class="ft-panel dv-fglyphs">
            <div class="ft-panel-head"><span class="ft-panel-title">Characters</span><span class="ft-panel-count dv-gcount"></span>
              <select class="cv-hf-sort dv-gblock" aria-label="Unicode block"></select>
              <button class="cv-tt-btn" type="button" data-f="gprev" aria-label="Previous characters">${icon('ftPrev', 14)}</button>
              <button class="cv-tt-btn" type="button" data-f="gnext" aria-label="Next characters">${icon('ftNext', 14)}</button>
            </div>
            <div class="dv-gcells"></div>
            <p class="dv-gempty" hidden>No characters from this block are in the font.</p>
          </div>
        </div>
        <aside class="dv-font-side">
          <div class="ft-panel dv-faxes" hidden><div class="ft-panel-head"><span class="ft-panel-title">Variable axes</span><button class="ft-btn" type="button" data-f="axes-reset">Reset</button></div><div class="dv-axes"></div></div>
          <div class="ft-panel"><div class="ft-panel-head"><span class="ft-panel-title">Details</span></div><dl class="dv-meta"></dl></div>
          <div class="ft-panel dv-fchips" hidden><div class="ft-panel-head"><span class="ft-panel-title">Features</span></div><div class="dv-chips dv-feat"></div></div>
          <div class="ft-panel dv-fchips2" hidden><div class="ft-panel-head"><span class="ft-panel-title">Scripts</span></div><div class="dv-chips dv-scripts"></div></div>
        </aside>
      </div>
    </section>`);
  private readonly sampleIn = q<HTMLInputElement>(this.root, '.dv-sample-in');
  private readonly big = q(this.root, '.dv-fbig-text');
  private readonly water = q(this.root, '.dv-fwater');
  private readonly cells = q(this.root, '.dv-gcells');
  private readonly blockSel = q<HTMLSelectElement>(this.root, '.dv-gblock');
  private readonly spin = q(this.root, '.dv-spin');
  private readonly seq = new Seq();
  private face: FontFace | null = null;
  private family = '';
  private entry: Entry | null = null;
  private info: FontInfo | null = null;
  private axisValues = new Map<string, number>();
  private page = 0;
  private loaded = false;

  constructor(private readonly deps: DocDeps) {
    this.sampleIn.value = DEFAULT_SAMPLE;
    for (const px of SIZES) {
      const row = document.createElement('div');
      row.className = 'dv-fw-row';
      row.innerHTML = '<span class="dv-fw-size"></span><span class="dv-fw-text"></span>';
      setText(row.children[0], `${px} px`);
      (row.children[1] as HTMLElement).style.fontSize = `${px}px`;
      this.water.appendChild(row);
    }
    this.syncSample();
    this.sampleIn.addEventListener('input', () => this.syncSample());
    this.sampleIn.addEventListener('keydown', (e) => { if (e.key === 'Escape') { this.sampleIn.blur(); e.stopPropagation(); } });
    this.root.addEventListener('click', (e) => {
      const t = e.target instanceof Element ? e.target : null;
      const b = t?.closest<HTMLElement>('[data-f]');
      const a = b?.dataset.f;
      if (a === 'reset') { this.sampleIn.value = DEFAULT_SAMPLE; this.syncSample(); }
      else if (a === 'install') void this.install();
      else if (a === 'gprev') { this.page = Math.max(0, this.page - 1); this.renderGlyphs(); }
      else if (a === 'gnext') { this.page++; this.renderGlyphs(); }
      else if (a === 'axes-reset') this.resetAxes();
      const cell = t?.closest<HTMLElement>('.dv-gcell');
      if (cell) void copyText(cell.dataset.ch ?? '').then((ok) => this.deps.status(ok ? `Copied ${cell.title}.` : 'Could not copy.'));
    });
    this.blockSel.addEventListener('change', () => { this.page = 0; this.renderGlyphs(); });
    q(this.root, '.dv-axes').addEventListener('input', (e) => {
      const r = e.target instanceof HTMLInputElement ? e.target : null;
      if (!r?.dataset.tag) return;
      this.axisValues.set(r.dataset.tag, Number(r.value));
      setText(r.parentElement?.querySelector('.dv-axis-v') ?? null, r.value);
      this.applyAxes();
    });
  }

  async open(entry: Entry): Promise<void> {
    const my = this.seq.next();
    this.entry = entry;
    setClass(this.root, 'is-loading', true);
    const stop = busy(this.spin);
    try {
      const info = await docApi.fontInfo(entry.path);
      if (!this.seq.is(my)) return;
      let note = '';
      let face: FontFace | null = null;
      const family = `dvf${++counter}`;
      if (info.format === 'collection' || entry.ext === 'ttc' || entry.ext === 'otc') note = 'A font collection cannot be previewed here; its details are shown.';
      else {
        try {
          face = new FontFace(family, `url("${docApi.rawUrl(entry.path, entry.mtime)}")`);
          await face.load();
        } catch {
          face = null;
          note = 'The window could not load this font for a preview; its details are shown.';
        }
      }
      if (!this.seq.is(my)) return;
      if (this.face) document.fonts.delete(this.face);
      this.face = face;
      if (face) document.fonts.add(face);
      this.family = face ? family : '';
      this.loaded = !!face;
      this.info = info;
      this.root.style.setProperty('--dv-font', face ? `"${family}"` : 'inherit');
      setClass(this.root, 'has-face', !!face);
      this.axisValues = new Map(info.axes.map((a) => [a.tag, a.default]));
      this.renderAxes(info.axes);
      this.applyAxes();
      this.renderMeta(info);
      this.renderChips(info);
      this.renderBlocks(info);
      setText(q(this.root, '.dv-note'), note);
      setText(q(this.root, '.dv-info'), `${info.format} · ${fmtInt(info.glyphs)} glyphs${info.faces > 1 ? ` · ${info.faces} faces` : ''}`);
      this.syncInstall();
      setHidden(q(this.root, '.dv-font-body'), false);
      this.page = 0;
      this.renderGlyphs();
    } catch (err) {
      if (this.seq.is(my)) {
        if (this.face) { document.fonts.delete(this.face); this.face = null; }
        this.family = '';
        this.loaded = false;
        this.info = null;
        setHidden(q(this.root, '.dv-font-body'), true);
        setDisabled(q<HTMLButtonElement>(this.root, '[data-f="install"]'), true);
        setText(q(this.root, '.dv-info'), '');
        setText(q(this.root, '.dv-note'), errText(err));
      }
    } finally {
      stop();
      if (this.seq.is(my)) setClass(this.root, 'is-loading', false);
    }
  }

  close(): void {
    this.seq.bump();
    if (this.face) { document.fonts.delete(this.face); this.face = null; }
    this.loaded = false;
    this.entry = null;
    this.info = null;
  }

  key(_e: KeyboardEvent): boolean { return false; }

  private syncSample(): void {
    const text = this.sampleIn.value || DEFAULT_SAMPLE;
    setText(this.big, text);
    this.water.querySelectorAll('.dv-fw-text').forEach((n) => setText(n, text));
  }

  private applyAxes(): void {
    const v = [...this.axisValues].map(([t, n]) => `"${t}" ${n}`).join(', ');
    this.root.style.setProperty('--dv-fvs', v || 'normal');
  }

  private renderAxes(axes: FontAxis[]): void {
    const host = q(this.root, '.dv-axes');
    setHidden(q(this.root, '.dv-faxes'), axes.length === 0);
    patchList(host, axes, {
      key: (a) => a.tag,
      create: (a) => {
        const row = document.createElement('label');
        row.className = 'dv-axis';
        row.innerHTML = '<span class="dv-axis-n"></span><input type="range" class="dv-axis-r"><span class="dv-axis-v"></span>';
        this.updateAxis(row, a);
        return row;
      },
      update: (n, a) => this.updateAxis(n, a),
    });
  }

  private updateAxis(row: HTMLElement, a: FontAxis): void {
    setText(row.children[0], a.name || a.tag);
    const r = row.children[1] as HTMLInputElement;
    r.dataset.tag = a.tag;
    r.min = String(a.min);
    r.max = String(a.max);
    r.step = a.max - a.min > 20 ? '1' : '0.01';
    r.value = String(this.axisValues.get(a.tag) ?? a.default);
    setText(row.children[2], r.value);
    row.title = `${a.tag}: ${a.min} to ${a.max}`;
  }

  private resetAxes(): void {
    if (!this.info) return;
    this.axisValues = new Map(this.info.axes.map((a) => [a.tag, a.default]));
    this.renderAxes(this.info.axes);
    this.applyAxes();
  }

  private renderMeta(info: FontInfo): void {
    const rows: Meta[] = [
      { label: 'Family', value: info.family },
      { label: 'Style', value: info.subfamily },
      { label: 'Full name', value: info.full_name },
      { label: 'PostScript', value: info.postscript },
      { label: 'Version', value: info.version },
      { label: 'Designer', value: info.designer },
      { label: 'Vendor', value: info.vendor },
      { label: 'Format', value: info.format },
      { label: 'Glyphs', value: fmtInt(info.glyphs) },
      { label: 'License', value: info.license },
      { label: 'License URL', value: info.license_url },
      { label: 'Copyright', value: info.copyright },
    ].filter((r) => r.value);
    patchList(q(this.root, '.dv-meta'), rows, {
      key: (r) => r.label,
      create: (r) => {
        const d = document.createElement('div');
        d.className = 'ft-info-row';
        d.innerHTML = '<dt></dt><dd></dd>';
        this.updateMeta(d, r);
        return d;
      },
      update: (n, r) => this.updateMeta(n, r),
    });
  }

  private updateMeta(n: HTMLElement, r: Meta): void {
    setText(n.children[0], r.label);
    setText(n.children[1], r.value);
  }

  private renderChips(info: FontInfo): void {
    const fill = (host: HTMLElement, panel: HTMLElement, tags: string[]): void => {
      setHidden(panel, tags.length === 0);
      patchList(host, tags, {
        key: (t) => t,
        create: (t) => { const s = document.createElement('span'); s.className = 'dv-chip'; s.textContent = t; return s; },
        update: () => undefined,
      });
    };
    fill(q(this.root, '.dv-feat'), q(this.root, '.dv-fchips'), info.features);
    fill(q(this.root, '.dv-scripts'), q(this.root, '.dv-fchips2'), info.scripts);
  }

  private renderBlocks(info: FontInfo): void {
    const prev = this.blockSel.value;
    const usable = info.coverage.filter((c) => blockRange(c.block));
    patchList(this.blockSel as unknown as HTMLElement, usable, {
      key: (c) => c.block,
      create: (c) => { const o = document.createElement('option'); o.value = c.block; this.updateBlock(o, c); return o; },
      update: (n, c) => this.updateBlock(n as HTMLOptionElement, c),
    });
    this.blockSel.value = usable.some((c) => c.block === prev) ? prev : usable[0]?.block ?? '';
    setDisabled(this.blockSel, usable.length === 0);
  }

  private updateBlock(o: HTMLOptionElement, c: { block: string; count: number }): void {
    const t = `${c.block} (${fmtInt(c.count)})`;
    if (o.textContent !== t) o.textContent = t;
  }

  private renderGlyphs(): void {
    const range = blockRange(this.blockSel.value);
    const empty = q(this.root, '.dv-gempty');
    if (!range || !this.loaded) {
      patchList(this.cells, [], { key: (x: number) => String(x), create: () => document.createElement('i'), update: () => undefined });
      setHidden(empty, true);
      setText(q(this.root, '.dv-gcount'), this.loaded ? '' : 'No preview');
      return;
    }
    const [lo, hi] = range;
    const pages = Math.ceil((hi - lo + 1) / PAGE);
    this.page = Math.min(this.page, pages - 1);
    const start = lo + this.page * PAGE, end = Math.min(hi, start + PAGE - 1);
    const list: number[] = [];
    for (let cp = start; cp <= end; cp++) {
      if (cp < 0x20 || (cp >= 0x7f && cp < 0xa0) || (cp >= 0xd800 && cp < 0xe000)) continue;
      if (covers(this.family, String.fromCodePoint(cp))) list.push(cp);
    }
    patchList(this.cells, list, {
      key: (cp) => String(cp),
      create: (cp) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'dv-gcell';
        const ch = String.fromCodePoint(cp);
        b.dataset.ch = ch;
        b.textContent = /\p{M}/u.test(ch) ? `◌${ch}` : ch;
        b.title = `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`;
        return b;
      },
      update: () => undefined,
    });
    setHidden(empty, list.length > 0);
    setText(q(this.root, '.dv-gcount'), `${fmtInt(list.length)} shown · page ${this.page + 1} of ${pages}`);
    setDisabled(q<HTMLButtonElement>(this.root, '[data-f="gprev"]'), this.page === 0);
    setDisabled(q<HTMLButtonElement>(this.root, '[data-f="gnext"]'), this.page >= pages - 1);
  }

  private syncInstall(): void {
    const b = q<HTMLButtonElement>(this.root, '[data-f="install"]');
    const done = !!this.info?.installed;
    setDisabled(b, done);
    setText(b.lastElementChild, done ? 'Installed' : 'Install');
  }

  private async install(): Promise<void> {
    if (!this.entry || !this.info) return;
    try {
      const r = await docApi.fontInstall(this.entry.path);
      this.info.installed = true;
      this.syncInstall();
      this.deps.status(`Installed to ${r.path}.`);
    } catch (err) {
      this.deps.status(errText(err));
    }
  }
}

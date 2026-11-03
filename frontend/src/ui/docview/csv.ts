import type { Entry } from '../../io/api';
import { docApi, type CsvDoc } from '../../io/doc-api';
import { el, q, setClass, setDisabled, setText } from '../dom';
import { icon } from '../icons';
import './icons';
import { Seq, busy, errText, fmtInt } from './common';
import { VGrid, type GridCol } from './grid';
import type { DocDeps, DocKind } from './types';

const DELIMS: Record<string, string> = { ',': 'Comma', '\t': 'Tab', ';': 'Semicolon', '|': 'Pipe' };

const colName = (i: number): string => {
  let n = i, s = '';
  do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return s;
};

const numeric = (s: string): number | null => {
  if (s === '') return null;
  const n = Number(s.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};

export class CsvView implements DocKind {
  readonly root = el<HTMLElement>(`<section class="dv-panel dv-csv" hidden>
      <div class="dv-bar">
        <button class="cv-tt-btn is-on" type="button" data-c="header" title="Treat the first row as the header" aria-label="First row is header">${icon('dvTable', 16)}</button>
        <input class="ft-input dv-find" type="text" placeholder="Filter rows" spellcheck="false" aria-label="Filter rows">
        <span class="dv-count"></span>
        <span class="dv-gap"></span>
        <span class="dv-note"></span>
        <span class="dv-info"></span>
        <span class="ft-busy dv-spin"></span>
      </div>
      <div class="dv-gridhost"></div>
    </section>`);
  private readonly grid = new VGrid();
  private readonly spin = q(this.root, '.dv-spin');
  private readonly filter = q<HTMLInputElement>(this.root, '.dv-find');
  private readonly seq = new Seq();
  private doc: CsvDoc | null = null;
  private rows: string[][] = [];
  private view: number[] = [];
  private cols = 0;
  private numericCol: boolean[] = [];
  private sortCol = -1;
  private sortDir: 1 | -1 | 0 = 0;
  private useHeader = true;

  constructor(_deps: DocDeps) {
    q(this.root, '.dv-gridhost').appendChild(this.grid.root);
    this.grid.cell = (i, c) => this.rows[this.view[i]]?.[c] ?? '';
    this.grid.onSort = (c) => {
      if (this.sortCol !== c) { this.sortCol = c; this.sortDir = 1; }
      else if (this.sortDir === 1) this.sortDir = -1;
      else { this.sortDir = 0; this.sortCol = -1; }
      this.rebuild();
    };
    this.filter.addEventListener('input', () => this.rebuild());
    this.filter.addEventListener('keydown', (e) => { if (e.key === 'Escape') { this.filter.value = ''; this.rebuild(); this.filter.blur(); e.stopPropagation(); } });
    q(this.root, '[data-c="header"]').addEventListener('click', (e) => {
      this.useHeader = !this.useHeader;
      setClass(e.currentTarget as HTMLElement, 'is-on', this.useHeader);
      if (this.doc) this.load(this.doc);
    });
  }

  async open(entry: Entry): Promise<void> {
    const my = this.seq.next();
    setClass(this.root, 'is-loading', true);
    const stop = busy(this.spin);
    try {
      const doc = await docApi.csv(entry.path);
      if (!this.seq.is(my)) return;
      this.doc = doc;
      this.sortCol = -1;
      this.sortDir = 0;
      this.filter.value = '';
      this.load(doc);
      this.grid.scrollHome();
    } catch (err) {
      if (this.seq.is(my)) {
        this.doc = null;
        this.rows = [];
        this.view = [];
        this.grid.setCount(0);
        setText(q(this.root, '.dv-note'), errText(err));
      }
    } finally {
      stop();
      if (this.seq.is(my)) setClass(this.root, 'is-loading', false);
    }
  }

  close(): void {
    this.seq.bump();
    this.doc = null;
    this.rows = [];
    this.view = [];
    this.grid.setCount(0);
  }

  key(e: KeyboardEvent): boolean {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); this.filter.focus(); this.filter.select(); return true; }
    return false;
  }

  private load(doc: CsvDoc): void {
    const withHeader = this.useHeader && doc.header !== null;
    this.rows = withHeader || doc.header === null ? doc.rows : [doc.header, ...doc.rows];
    const header = withHeader ? doc.header : null;
    const sample = this.rows.slice(0, 300);
    this.cols = Math.max(header?.length ?? 0, ...sample.map((r) => r.length), 1);
    const widths: number[] = [];
    this.numericCol = [];
    const cols: GridCol[] = [];
    for (let c = 0; c < this.cols; c++) {
      let chars = Math.max(3, (header?.[c] ?? colName(c)).length + 3);
      let nums = 0, filled = 0;
      for (const r of sample) {
        const v = r[c] ?? '';
        if (v.length > chars) chars = v.length;
        if (v !== '') { filled++; if (numeric(v) !== null) nums++; }
      }
      widths.push(Math.max(64, Math.min(360, Math.round(chars * 7.4 + 24))));
      this.numericCol.push(filled > 0 && nums / filled >= 0.9);
      cols.push({ label: header?.[c] ?? colName(c), width: widths[c], right: this.numericCol[c] });
    }
    this.grid.setColumns(cols);
    setDisabled(q<HTMLButtonElement>(this.root, '[data-c="header"]'), doc.header === null);
    const delim = DELIMS[doc.delimiter] ?? `"${doc.delimiter}"`;
    setText(q(this.root, '.dv-info'), `${delim}-separated · ${fmtInt(doc.total_rows)} rows · ${this.cols} columns`);
    setText(q(this.root, '.dv-note'), doc.truncated ? `Showing the first ${fmtInt(doc.rows.length)} of ${fmtInt(doc.total_rows)} rows.` : '');
    this.rebuild();
  }

  private rebuild(): void {
    const needle = this.filter.value.trim().toLowerCase();
    let idx: number[] = [];
    for (let i = 0; i < this.rows.length; i++) {
      if (!needle || this.rows[i].some((v) => v.toLowerCase().includes(needle))) idx.push(i);
    }
    if (this.sortDir !== 0 && this.sortCol >= 0) {
      const c = this.sortCol, d = this.sortDir, num = this.numericCol[c];
      const val = (i: number): string => this.rows[i][c] ?? '';
      idx = idx.sort((a, b) => {
        const x = val(a), y = val(b);
        if (x === '' || y === '') return x === y ? 0 : x === '' ? 1 : -1;
        if (num) return d * ((numeric(x) ?? 0) - (numeric(y) ?? 0));
        return d * x.localeCompare(y, undefined, { numeric: true, sensitivity: 'base' });
      });
    }
    this.view = idx;
    this.grid.setSort(this.sortCol, this.sortDir);
    this.grid.setCount(idx.length);
    setText(q(this.root, '.dv-count'), needle ? `${fmtInt(idx.length)} of ${fmtInt(this.rows.length)} rows` : '');
  }
}

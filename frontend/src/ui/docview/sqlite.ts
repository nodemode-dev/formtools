import type { Entry } from '../../io/api';
import { docApi, type SqlCell, type SqlTable } from '../../io/doc-api';
import { el, patchList, q, setClass, setText } from '../dom';
import { icon } from '../icons';
import './icons';
import { Seq, busy, errText, fmtInt } from './common';
import { VGrid, type GridCol } from './grid';
import type { DocDeps, DocKind } from './types';

const PAGE = 200;
const KEEP = 40;

const show = (v: SqlCell): string | null => {
  if (v === null) return null;
  if (typeof v === 'object') return `[blob, ${fmtInt(v.blob)} bytes]`;
  const s = String(v);
  return s.length > 500 ? `${s.slice(0, 500)}...` : s;
};

export class SqliteView implements DocKind {
  readonly root = el<HTMLElement>(`<section class="dv-panel dv-sqlite" hidden>
      <div class="dv-bar">
        <span class="dv-title"></span>
        <span class="dv-gap"></span>
        <span class="dv-note"></span>
        <span class="dv-info"></span>
        <span class="ft-busy dv-spin"></span>
      </div>
      <div class="dv-split">
        <nav class="dv-side" aria-label="Tables"><div class="dv-side-list"></div></nav>
        <div class="dv-gridhost"></div>
      </div>
    </section>`);
  private readonly grid = new VGrid();
  private readonly list = q(this.root, '.dv-side-list');
  private readonly spin = q(this.root, '.dv-spin');
  private readonly seq = new Seq();
  private readonly pages = new Map<number, SqlCell[][]>();
  private readonly pending = new Set<number>();
  private path = '';
  private tables: SqlTable[] = [];
  private current = '';
  private tableToken = 0;

  constructor(_deps: DocDeps) {
    q(this.root, '.dv-gridhost').appendChild(this.grid.root);
    this.grid.cell = (i, c) => this.cellAt(i, c);
    this.list.addEventListener('click', (e) => {
      const b = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-key]') : null;
      if (b?.dataset.key && b.dataset.key !== this.current) void this.pick(b.dataset.key);
    });
  }

  async open(entry: Entry): Promise<void> {
    const my = this.seq.next();
    setClass(this.root, 'is-loading', true);
    const stop = busy(this.spin);
    try {
      const res = await docApi.sqliteTables(entry.path);
      if (!this.seq.is(my)) return;
      const same = this.path === entry.path;
      this.path = entry.path;
      this.tables = res.tables;
      const keep = same && res.tables.some((t) => t.name === this.current) ? this.current : res.tables[0]?.name ?? '';
      this.current = keep;
      this.renderList();
      setText(q(this.root, '.dv-note'), res.tables.length ? '' : 'This database has no tables.');
      if (keep) await this.pick(keep, my);
      else { this.grid.setColumns([]); this.grid.setCount(0); setText(q(this.root, '.dv-title'), ''); setText(q(this.root, '.dv-info'), ''); }
    } catch (err) {
      if (this.seq.is(my)) {
        this.tableToken++;
        this.pages.clear();
        this.pending.clear();
        this.path = '';
        this.tables = [];
        this.current = '';
        this.renderList();
        this.grid.setColumns([]);
        this.grid.setCount(0);
        setText(q(this.root, '.dv-title'), '');
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
    this.tableToken++;
    this.pages.clear();
    this.pending.clear();
    this.grid.setCount(0);
    this.path = '';
    this.current = '';
  }

  key(_e: KeyboardEvent): boolean { return false; }

  private renderList(): void {
    patchList(this.list, this.tables, {
      key: (t) => t.name,
      create: (t) => {
        const n = document.createElement('button');
        n.type = 'button';
        n.className = 'dv-side-item';
        n.innerHTML = `${icon('dvTable', 14)}<span class="dv-side-name"></span><span class="dv-side-n"></span>`;
        this.updateItem(n, t);
        return n;
      },
      update: (n, t) => this.updateItem(n, t),
    });
  }

  private updateItem(n: HTMLElement, t: SqlTable): void {
    setText(n.children[1], t.name);
    setText(n.children[2], t.kind === 'view' ? 'view' : fmtInt(t.rows));
    setClass(n, 'is-on', t.name === this.current);
    n.title = `${t.name} (${t.kind}, ${fmtInt(t.rows)} rows, ${t.columns.length} columns)`;
  }

  private async pick(name: string, parent = this.seq.next()): Promise<void> {
    const table = this.tables.find((t) => t.name === name);
    if (!table) return;
    const token = ++this.tableToken;
    this.current = name;
    this.renderList();
    setClass(this.root, 'is-loading', true);
    const stop = busy(this.spin);
    try {
      const first = await docApi.sqliteRows(this.path, name, 0, PAGE);
      if (token !== this.tableToken || !this.seq.is(parent)) return;
      this.pages.clear();
      this.pending.clear();
      this.pages.set(0, first.rows);
      const widths = table.columns.map((c, i) => {
        let chars = Math.max(c.name.length + (c.pk ? 3 : 0), c.type.length, 4);
        for (const r of first.rows.slice(0, 100)) {
          const v = show(r[i] ?? null);
          if (v && v.length > chars) chars = v.length;
        }
        return Math.max(72, Math.min(320, Math.round(chars * 7.4 + 24)));
      });
      const cols: GridCol[] = table.columns.map((c, i) => ({ label: c.pk ? `${c.name} (PK)` : c.name, sub: c.type, width: widths[i] }));
      this.grid.setColumns(cols);
      this.grid.setCount(first.total);
      this.grid.scrollHome();
      setText(q(this.root, '.dv-title'), `${table.name}${table.kind === 'view' ? ' (view)' : ''}`);
      setText(q(this.root, '.dv-info'), `${fmtInt(first.total)} rows · ${table.columns.length} columns`);
    } catch (err) {
      if (token === this.tableToken) setText(q(this.root, '.dv-note'), errText(err));
    } finally {
      stop();
      if (token === this.tableToken && this.seq.is(parent)) setClass(this.root, 'is-loading', false);
    }
  }

  private cellAt(i: number, c: number): string | null | undefined {
    const page = Math.floor(i / PAGE);
    const rows = this.pages.get(page);
    if (!rows) { this.fetchPage(page); return undefined; }
    return show(rows[i - page * PAGE]?.[c] ?? null);
  }

  private fetchPage(page: number): void {
    if (this.pending.has(page) || !this.current) return;
    this.pending.add(page);
    const token = this.tableToken;
    void docApi.sqliteRows(this.path, this.current, page * PAGE, PAGE).then((r) => {
      if (token !== this.tableToken) return;
      this.pending.delete(page);
      this.pages.set(page, r.rows);
      if (this.pages.size > KEEP) {
        const first = this.grid.list.firstVisible() / PAGE;
        const far = [...this.pages.keys()].sort((a, b) => Math.abs(b - first) - Math.abs(a - first))[0];
        if (far !== page) this.pages.delete(far);
      }
      this.grid.list.refresh();
    }).catch((err) => {
      if (token !== this.tableToken) return;
      this.pending.delete(page);
      setText(q(this.root, '.dv-note'), errText(err));
    });
  }
}

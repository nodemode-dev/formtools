import { baseName, dirName, fmtBytes, type UsageCategory, type UsageExtRow, type UsageLargest, type UsageStats, type UsageTypeRow } from '../../io/util-api';
import { el, escapeHtml, patchList, q, setClass, setStyleVar, setText } from '../dom';
import { icon } from '../icons';
import { CATEGORIES, CATEGORY_LABEL, pct } from './categories';

const STATS: Array<[string, string]> = [
  ['apparent', 'Apparent size'], ['allocated', 'On disk'], ['files', 'Files'], ['folders', 'Folders'],
  ['errors', 'Unreadable folders'], ['average', 'Average file'], ['newest', 'Newest file'], ['oldest', 'Oldest file'],
];

const fmtDate = (t: number | null): string => (t === null ? 'None' : new Date(t * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }));

export class TypesPane {
  readonly root = el<HTMLElement>(`<div class="ft-du-types" hidden>
      <p class="ft-note ft-du-empty">Measure a folder to see what kinds of files fill it.</p>
      <div class="ft-du-tbody">
        <section class="ft-du-tsec">
          <h3 class="ft-du-th">Totals <span class="ft-du-tscope"></span></h3>
          <dl class="ft-du-stats">${STATS.map(([k, label]) => `<div class="ft-du-stat" data-stat="${k}"><dt>${label}</dt><dd></dd></div>`).join('')}</dl>
          <p class="ft-note ft-du-tnote"></p>
        </section>
        <section class="ft-du-tsec">
          <h3 class="ft-du-th">By type</h3>
          <div class="ft-du-stack" role="img" aria-label="Share of space by file type"></div>
          <div class="ft-du-trows ft-du-cat" role="table" aria-label="Space by file type">
            <div class="ft-du-trow is-head" role="row"><span></span><span>Type</span><span>Size</span><span>On disk</span><span>Files</span><span>Share</span></div>
            <div class="ft-du-tlist" data-list="cat"></div>
          </div>
        </section>
        <section class="ft-du-tsec">
          <h3 class="ft-du-th">Top extensions</h3>
          <div class="ft-du-trows ft-du-ext" role="table" aria-label="Largest file extensions">
            <div class="ft-du-trow is-head" role="row"><span></span><span>Extension</span><span>Size</span><span>On disk</span><span>Files</span><span>Share</span></div>
            <div class="ft-du-tlist" data-list="ext"></div>
          </div>
        </section>
        <section class="ft-du-tsec">
          <h3 class="ft-du-th">Largest files</h3>
          <div class="ft-du-trows ft-du-big" role="table" aria-label="Largest files">
            <div class="ft-du-trow is-head" role="row"><span></span><span>File</span><span>Size</span><span>On disk</span><span>Modified</span><span></span></div>
            <div class="ft-du-tlist" data-list="big"></div>
          </div>
        </section>
      </div>
    </div>`);
  private readonly stack = q(this.root, '.ft-du-stack');
  private shown: UsageStats | null = null;

  constructor() {
    this.buildStack();
    this.buildStats();
    patchList(q(this.root, '[data-list="cat"]'), CATEGORIES.map((c) => c.id), {
      key: (id) => id,
      create: (id) => el<HTMLElement>(`<div class="ft-du-trow is-empty" role="row" data-cat-row="${id}" data-cat="${id}"><span class="ft-sw"></span><span class="ft-du-tname"></span><span class="ft-du-tnum" data-c="bytes"></span><span class="ft-du-tnum" data-c="alloc"></span><span class="ft-du-tnum" data-c="files"></span><span class="ft-du-tshare"><i></i><b></b></span></div>`),
      update: () => undefined,
    });
    q(this.root, '[data-list="cat"]').querySelectorAll<HTMLElement>('[data-cat-row]').forEach((r) => setText(q(r, '.ft-du-tname'), CATEGORY_LABEL[r.dataset.catRow as UsageCategory]));
  }

  private buildStack(): void {
    patchList(this.stack, CATEGORIES.map((c) => c.id), {
      key: (id) => id,
      create: (id) => { const s = el<HTMLElement>(`<i data-cat="${id}"></i>`); s.title = CATEGORY_LABEL[id]; return s; },
      update: () => undefined,
    });
  }

  private buildStats(): void {
    q(this.root, '.ft-du-stats').querySelectorAll('dd').forEach((d) => setText(d, ''));
  }

  setData(stats: UsageStats | null, scope: string): void {
    this.shown = stats;
    setClass(this.root, 'has-data', !!stats);
    if (!stats) return;
    setText(q(this.root, '.ft-du-tscope'), scope);
    const set = (k: string, v: string): void => setText(q(q(this.root, `[data-stat="${k}"]`), 'dd'), v);
    set('apparent', fmtBytes(stats.apparent));
    set('allocated', `${fmtBytes(stats.allocated)} (${pct(stats.allocated, stats.apparent)} of apparent)`);
    set('files', stats.files.toLocaleString());
    set('folders', stats.folders.toLocaleString());
    set('errors', stats.errors.toLocaleString());
    set('average', fmtBytes(stats.average_file));
    set('newest', fmtDate(stats.newest));
    set('oldest', fmtDate(stats.oldest));
    const links = stats.hardlinks_counted_once;
    setText(q(this.root, '.ft-du-tnote'), `${links ? `${links.toLocaleString()} extra hard links were counted once. ` : 'Each file is counted once even when hard linked. '}${stats.allocation === 'blocks' ? 'On disk is the blocks the system reports.' : 'On disk is the size rounded up to 4 KB.'}`);
    const rows = new Map<UsageCategory, UsageTypeRow>(stats.by_type.map((r) => [r.category, r]));
    this.stack.querySelectorAll<HTMLElement>('[data-cat]').forEach((s) => {
      const r = rows.get(s.dataset.cat as UsageCategory);
      setStyleVar(s, 'flex-grow', r ? String(Math.max(0, r.bytes)) : '0');
      const label = r ? `${CATEGORY_LABEL[r.category]} ${fmtBytes(r.bytes)} ${pct(r.bytes, stats.apparent)}` : '';
      if (s.title !== label) s.title = label;
    });
    q(this.root, '[data-list="cat"]').querySelectorAll<HTMLElement>('[data-cat-row]').forEach((row) => {
      const r = rows.get(row.dataset.catRow as UsageCategory);
      setClass(row, 'is-empty', !r || r.files === 0);
      setText(q(row, '[data-c="bytes"]'), r ? fmtBytes(r.bytes) : '');
      setText(q(row, '[data-c="alloc"]'), r ? fmtBytes(r.allocated) : '');
      setText(q(row, '[data-c="files"]'), r ? r.files.toLocaleString() : '');
      setText(q(row, '.ft-du-tshare b'), r ? pct(r.bytes, stats.apparent) : '');
      setStyleVar(q(row, '.ft-du-tshare i'), '--share', `${r && stats.apparent ? Math.max(0.4, (r.bytes / stats.apparent) * 100).toFixed(2) : 0}%`);
    });
    patchList(q(this.root, '[data-list="ext"]'), stats.by_ext, {
      key: (r: UsageExtRow) => `${r.ext}|${r.category}`,
      create: (r) => {
        const row = el<HTMLElement>(`<div class="ft-du-trow" role="row" data-cat="${r.category}"><span class="ft-sw"></span><span class="ft-du-tname"></span><span class="ft-du-tnum" data-c="bytes"></span><span class="ft-du-tnum" data-c="alloc"></span><span class="ft-du-tnum" data-c="files"></span><span class="ft-du-tshare"><i></i><b></b></span></div>`);
        setText(q(row, '.ft-du-tname'), r.ext ? `.${r.ext}` : '(no extension)');
        row.title = CATEGORY_LABEL[r.category];
        this.paintExt(row, r, stats);
        return row;
      },
      update: (row, r) => this.paintExt(row, r, stats),
    });
    patchList(q(this.root, '[data-list="big"]'), stats.largest, {
      key: (r: UsageLargest) => r.path,
      create: (r) => {
        const row = el<HTMLElement>(`<div class="ft-du-trow" role="row" data-cat="${r.category}"><span class="ft-sw"></span><span class="ft-du-tfile"><span class="ft-du-tname"></span><span class="ft-du-tdir"></span></span><span class="ft-du-tnum" data-c="bytes"></span><span class="ft-du-tnum" data-c="alloc"></span><span class="ft-du-tnum" data-c="date"></span><button class="cv-tt-btn" type="button" data-reveal="${escapeHtml(r.path)}" title="Show in folder" aria-label="Show in folder">${icon('folderOpen', 14)}</button></div>`);
        setText(q(row, '.ft-du-tname'), baseName(r.path));
        setText(q(row, '.ft-du-tdir'), dirName(r.path));
        row.title = r.path;
        setText(q(row, '[data-c="bytes"]'), fmtBytes(r.size));
        setText(q(row, '[data-c="alloc"]'), fmtBytes(r.allocated));
        setText(q(row, '[data-c="date"]'), fmtDate(r.mtime));
        return row;
      },
      update: () => undefined,
    });
  }

  private paintExt(row: HTMLElement, r: UsageExtRow, stats: UsageStats): void {
    setText(q(row, '[data-c="bytes"]'), fmtBytes(r.bytes));
    setText(q(row, '[data-c="alloc"]'), fmtBytes(r.allocated));
    setText(q(row, '[data-c="files"]'), r.files.toLocaleString());
    setText(q(row, '.ft-du-tshare b'), pct(r.bytes, stats.apparent));
    setStyleVar(q(row, '.ft-du-tshare i'), '--share', `${stats.apparent ? Math.max(0.4, (r.bytes / stats.apparent) * 100).toFixed(2) : 0}%`);
  }

  current(): UsageStats | null { return this.shown; }
}

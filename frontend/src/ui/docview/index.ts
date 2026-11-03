import type { Entry } from '../../io/api';
import { delayedIndicator, el, q, setClass, setHidden, setText, type Disposer } from '../dom';
import { icon } from '../icons';
import './icons';
import { Seq, fmtBytes, typeOnly } from './common';
import type { DocDeps, DocKind, KindName } from './types';
import { ArchiveView } from './archive';
import { ChecksumView } from './checksum';
import { CsvView } from './csv';
import { FontView } from './font';
import { HexView } from './hex';
import { JsonView } from './json';
import { MarkdownView } from './markdown';
import { PdfView } from './pdf';
import { SqliteView } from './sqlite';
import { TextView } from './text';

export type { DocDeps, KindName } from './types';

const MARKDOWN = new Set(['md', 'markdown', 'mdown', 'mkd']);
const CSV = new Set(['csv', 'tsv', 'tab']);
const JSON_EXT = new Set(['json', 'jsonl', 'ndjson', 'geojson', 'webmanifest', 'jsonc']);
const SQLITE = new Set(['sqlite', 'sqlite3', 'db', 'db3', 's3db']);

export function docKindOf(entry: Entry): KindName {
  if (entry.type === 'pdf') return 'pdf';
  if (entry.type === 'font') return 'font';
  if (entry.type === 'archive') return 'archive';
  if (MARKDOWN.has(entry.ext)) return 'markdown';
  if (CSV.has(entry.ext)) return 'csv';
  if (JSON_EXT.has(entry.ext)) return 'json';
  if (SQLITE.has(entry.ext)) return 'sqlite';
  if (entry.type === 'text') return 'text';
  return 'hex';
}

export function docHandles(entry: Entry): boolean {
  if (entry.kind === 'dir') return false;
  return entry.type === 'text' || entry.type === 'pdf' || entry.type === 'font' || entry.type === 'archive' || SQLITE.has(entry.ext) || CSV.has(entry.ext) || JSON_EXT.has(entry.ext) || MARKDOWN.has(entry.ext);
}

const VIEW_LABEL: Record<KindName, string> = {
  text: 'Text', markdown: 'Document', csv: 'Table', json: 'Data', sqlite: 'Database', pdf: 'Document', font: 'Font', hex: 'Hex', archive: 'Contents', checksum: 'Checksums',
};

type Mode = 'view' | 'hex' | 'checksum';

export class DocViewer {
  readonly root = el<HTMLElement>(`<section class="dv-root ft-page" aria-label="Document viewer" hidden>
      <div class="dv-top">
        <span class="dv-top-name"></span>
        <span class="dv-top-size"></span>
        <span class="dv-gap"></span>
        <span class="ft-seg" role="tablist">
          <button class="ft-seg-btn is-on" type="button" data-mode="view"><span class="dv-top-view">View</span></button>
          <button class="ft-seg-btn" type="button" data-mode="hex" title="Show the raw bytes (H)">${icon('dvHex', 14)}Hex</button>
          <button class="ft-seg-btn" type="button" data-mode="checksum" title="Checksums (K)">${icon('dvHash', 14)}Checksums</button>
        </span>
        <span class="ft-busy dv-top-spin"></span>
      </div>
      <div class="dv-stage"></div>
    </section>`);
  private readonly stage = q(this.root, '.dv-stage');
  private readonly spin = q(this.root, '.dv-top-spin');
  private readonly kinds = new Map<KindName, DocKind>();
  private readonly seq = new Seq();
  private readonly opened = new Set<KindName>();
  private entry: Entry | null = null;
  private viewKind: KindName = 'text';
  private mode: Mode = 'view';
  private shown: KindName | null = null;
  private stopSpin: Disposer | null = null;

  constructor(private readonly deps: DocDeps) {
    this.root.querySelector('.dv-top')?.addEventListener('click', (e) => {
      const b = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-mode]') : null;
      const m = b?.dataset.mode;
      if (m === 'view' || m === 'hex' || m === 'checksum') void this.setMode(m);
    });
  }

  static handles(entry: Entry): boolean { return docHandles(entry); }

  async open(entry: Entry): Promise<void> {
    const my = this.seq.next();
    this.entry = entry;
    this.mode = 'view';
    this.viewKind = docKindOf(entry);
    setHidden(this.root, false);
    setText(q(this.root, '.dv-top-name'), entry.name);
    setText(q(this.root, '.dv-top-size'), fmtBytes(entry.size));
    setText(q(this.root, '.dv-top-view'), VIEW_LABEL[this.viewKind]);
    setHidden(q(this.root, '[data-mode="hex"]'), this.viewKind === 'hex');
    this.syncSeg();
    const stale = [...this.opened].filter((k) => k !== this.viewKind);
    this.opened.delete(this.viewKind);
    await this.activate(this.viewKind, entry, my, stale);
  }

  close(): void {
    this.seq.bump();
    this.stopSpin?.();
    this.stopSpin = null;
    for (const k of this.opened) this.kinds.get(k)?.close();
    this.opened.clear();
    if (this.shown) setHidden(this.kinds.get(this.shown)?.root ?? this.root, true);
    this.shown = null;
    this.entry = null;
    setHidden(this.root, true);
  }

  key(e: KeyboardEvent): boolean {
    if (!this.entry) return false;
    const active = this.shown ? this.kinds.get(this.shown) : undefined;
    if (active?.key(e)) return true;
    if (typeOnly(e) || e.metaKey || e.ctrlKey || e.altKey) return false;
    if (e.key === 'h' || e.key === 'H') { if (this.viewKind !== 'hex') void this.setMode(this.mode === 'hex' ? 'view' : 'hex'); return true; }
    if (e.key === 'k' || e.key === 'K') { void this.setMode(this.mode === 'checksum' ? 'view' : 'checksum'); return true; }
    return false;
  }

  private kind(name: KindName): DocKind {
    let k = this.kinds.get(name);
    if (!k) {
      const d = this.deps;
      switch (name) {
        case 'text': k = new TextView(d); break;
        case 'markdown': k = new MarkdownView(d); break;
        case 'csv': k = new CsvView(d); break;
        case 'json': k = new JsonView(d); break;
        case 'sqlite': k = new SqliteView(d); break;
        case 'pdf': k = new PdfView(d); break;
        case 'font': k = new FontView(d); break;
        case 'archive': k = new ArchiveView(d); break;
        case 'checksum': k = new ChecksumView(d); break;
        default: k = new HexView(d); break;
      }
      this.stage.appendChild(k.root);
      this.kinds.set(name, k);
    }
    return k;
  }

  private async setMode(mode: Mode): Promise<void> {
    if (!this.entry || mode === this.mode) return;
    this.mode = mode;
    this.syncSeg();
    const name: KindName = mode === 'view' ? this.viewKind : mode === 'hex' ? 'hex' : 'checksum';
    await this.activate(name, this.entry, this.seq.next());
  }

  private async activate(name: KindName, entry: Entry, my: number, stale: KindName[] = []): Promise<void> {
    const kind = this.kind(name);
    this.stopSpin?.();
    this.stopSpin = delayedIndicator(
      () => { this.spin.classList.add('is-on'); this.stage.classList.add('is-loading'); },
      () => { this.spin.classList.remove('is-on'); this.stage.classList.remove('is-loading'); },
    );
    try {
      if (!this.opened.has(name)) {
        this.opened.add(name);
        await kind.open(entry);
      }
    } finally {
      if (this.seq.is(my)) {
        this.stopSpin?.();
        this.stopSpin = null;
      }
    }
    if (!this.seq.is(my)) return;
    if (this.shown && this.shown !== name) setHidden(this.kinds.get(this.shown)?.root ?? this.root, true);
    setHidden(kind.root, false);
    kind.shown?.();
    this.shown = name;
    for (const k of stale) {
      if (k === name) continue;
      this.kinds.get(k)?.close();
      this.opened.delete(k);
    }
  }

  private syncSeg(): void {
    for (const b of this.root.querySelectorAll<HTMLElement>('[data-mode]')) setClass(b, 'is-on', b.dataset.mode === this.mode);
  }
}

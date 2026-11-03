import type { Entry } from '../../io/api';
import { docApi } from '../../io/doc-api';
import { el, q, setClass, setText } from '../dom';
import { icon } from '../icons';
import './icons';
import { errText, fmtBytes, fmtInt, typeOnly } from './common';
import type { DocDeps, DocKind } from './types';
import { VirtualList } from './vlist';

const ROW_BYTES = 16;
const ROW_H = 20;
const PAGE_BYTES = 65536;
const KEEP = 48;

const HEX: string[] = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));
const layout = (parts: string[]): string => parts.reduce((acc, p, i) => acc + (i === 0 ? '' : i === 8 ? '  ' : ' ') + p, '');
const PENDING_HEX = layout(Array.from({ length: ROW_BYTES }, () => '..'));

function parseOffset(s: string): number | null {
  const t = s.trim().toLowerCase().replace(/[_\s]/g, '');
  if (!t) return null;
  if (/^0x[0-9a-f]+$/.test(t)) return parseInt(t.slice(2), 16);
  if (/^[0-9a-f]+h$/.test(t)) return parseInt(t.slice(0, -1), 16);
  if (/^[0-9]+$/.test(t)) return parseInt(t, 10);
  return null;
}

export class HexView implements DocKind {
  readonly root = el<HTMLElement>(`<section class="dv-panel dv-hex" hidden>
      <div class="dv-bar">
        <input class="ft-input ft-mono dv-goto" type="text" spellcheck="false" placeholder="Go to offset" aria-label="Go to offset (decimal, 0x hex, or 1Fh)">
        <button class="cv-tt-btn" type="button" data-h="go" title="Go to the offset" aria-label="Go to the offset">${icon('dvJump', 16)}</button>
        <span class="dv-at ft-mono"></span>
        <span class="dv-gap"></span>
        <span class="dv-note"></span>
        <span class="dv-info"></span>
      </div>
      <div class="dv-hexhead ft-mono"><span class="dv-hx-off">Offset</span><span class="dv-hx-hex"></span><span class="dv-hx-asc">Text</span></div>
      <div class="dv-hexscroll"></div>
    </section>`);
  private readonly scroller = q(this.root, '.dv-hexscroll');
  private readonly goto = q<HTMLInputElement>(this.root, '.dv-goto');
  private readonly list: VirtualList;
  private readonly cache = new Map<number, Uint8Array>();
  private readonly pending = new Set<number>();
  private entry: Entry | null = null;
  private size = 0;
  private token = 0;

  constructor(private readonly deps: DocDeps) {
    setText(q(this.root, '.dv-hexhead .dv-hx-hex'), layout(HEX.slice(0, ROW_BYTES)));
    this.list = new VirtualList(this.scroller, ROW_H, () => {
      const r = document.createElement('div');
      r.className = 'dv-hex-row ft-mono';
      r.innerHTML = '<span class="dv-hx-off"></span><span class="dv-hx-hex"></span><span class="dv-hx-asc"></span>';
      return r;
    }, (n, i) => this.fill(n, i));
    this.list.onRender = (first, last) => {
      setText(q(this.root, '.dv-at'), this.size ? `0x${(first * ROW_BYTES).toString(16).toUpperCase().padStart(8, '0')}` : '');
      const p0 = Math.floor((first * ROW_BYTES) / PAGE_BYTES), p1 = Math.floor((last * ROW_BYTES) / PAGE_BYTES);
      for (let p = p0; p <= p1 + 1; p++) if (p * PAGE_BYTES < this.size) this.fetch(p);
    };
    q(this.root, '[data-h="go"]').addEventListener('click', () => this.jump());
    this.goto.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { this.jump(); e.preventDefault(); }
      else if (e.key === 'Escape') { this.goto.blur(); e.stopPropagation(); }
    });
  }

  async open(entry: Entry): Promise<void> {
    this.token++;
    this.entry = entry;
    this.size = entry.size;
    this.cache.clear();
    this.pending.clear();
    this.scroller.scrollTop = 0;
    this.list.setCount(Math.ceil(this.size / ROW_BYTES));
    setText(q(this.root, '.dv-info'), `${fmtBytes(this.size)} · ${fmtInt(this.size)} bytes`);
    setText(q(this.root, '.dv-note'), this.size ? '' : 'The file is empty.');
    setClass(this.root, 'is-empty', this.size === 0);
  }

  close(): void {
    this.token++;
    this.cache.clear();
    this.pending.clear();
    this.entry = null;
    this.size = 0;
    this.list.setCount(0);
  }

  key(e: KeyboardEvent): boolean {
    if (typeOnly(e)) return false;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'g') { e.preventDefault(); this.goto.focus(); this.goto.select(); return true; }
    if (e.metaKey || e.ctrlKey || e.altKey) return false;
    const page = Math.max(1, this.list.rows() - 1);
    const at = this.list.firstVisible();
    if (e.key === 'PageDown') { this.list.scrollToIndex(at + page); return true; }
    if (e.key === 'PageUp') { this.list.scrollToIndex(at - page); return true; }
    if (e.key === 'Home') { this.list.scrollToIndex(0); return true; }
    if (e.key === 'End') { this.list.scrollToIndex(this.list.total); return true; }
    return false;
  }

  private jump(): void {
    const off = parseOffset(this.goto.value);
    if (off === null || off < 0 || off >= this.size) { this.deps.status('That offset is outside the file.'); return; }
    this.list.scrollToIndex(Math.floor(off / ROW_BYTES));
  }

  private fill(node: HTMLElement, i: number): void {
    const off = i * ROW_BYTES;
    const offEl = node.children[0], hexEl = node.children[1] as HTMLElement, ascEl = node.children[2];
    if (off >= this.size) { setText(offEl, ''); setText(hexEl, ''); setText(ascEl, ''); return; }
    setText(offEl, off.toString(16).toUpperCase().padStart(8, '0'));
    const page = Math.floor(off / PAGE_BYTES);
    const data = this.cache.get(page);
    if (!data) {
      setText(hexEl, PENDING_HEX);
      setText(ascEl, '.'.repeat(Math.min(ROW_BYTES, this.size - off)));
      setClass(node, 'is-pending', true);
      return;
    }
    setClass(node, 'is-pending', false);
    const base = off - page * PAGE_BYTES;
    const n = Math.min(ROW_BYTES, data.length - base);
    const parts: string[] = [];
    let asc = '';
    for (let k = 0; k < ROW_BYTES; k++) {
      if (k < n) {
        const b = data[base + k];
        parts.push(HEX[b]);
        asc += b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.';
      } else parts.push('  ');
    }
    setText(hexEl, layout(parts));
    setText(ascEl, asc);
  }

  private fetch(page: number): void {
    const entry = this.entry;
    if (!entry || this.cache.has(page) || this.pending.has(page)) return;
    const token = this.token;
    this.pending.add(page);
    const start = page * PAGE_BYTES;
    void docApi.range(entry.path, start, Math.min(this.size, start + PAGE_BYTES), entry.mtime).then((buf) => {
      if (token !== this.token) return;
      this.pending.delete(page);
      this.cache.set(page, buf);
      if (this.cache.size > KEEP) {
        const mid = Math.floor((this.list.firstVisible() * ROW_BYTES) / PAGE_BYTES);
        const far = [...this.cache.keys()].sort((a, b) => Math.abs(b - mid) - Math.abs(a - mid))[0];
        if (far !== page) this.cache.delete(far);
      }
      this.list.refresh();
    }).catch((err) => {
      if (token !== this.token) return;
      this.pending.delete(page);
      setText(q(this.root, '.dv-note'), errText(err));
    });
  }
}

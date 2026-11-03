import type { Entry, Job } from '../../io/api';
import { docApi, type HashAlgo, type HashResult } from '../../io/doc-api';
import { el, q, setClass, setDisabled, setHidden, setText } from '../dom';
import { icon } from '../icons';
import './icons';
import { Seq, busy, copyText, errText, fmtBytes, fmtInt } from './common';
import type { DocDeps, DocKind } from './types';

const ALGOS: Array<[HashAlgo, string]> = [
  ['md5', 'MD5'], ['sha1', 'SHA-1'], ['sha256', 'SHA-256'], ['sha512', 'SHA-512'],
  ['sha3_256', 'SHA3-256'], ['blake3', 'BLAKE3'], ['xxh64', 'XXH64'], ['crc32', 'CRC32'],
];

function normalize(raw: string): string {
  const m = raw.toLowerCase().match(/[0-9a-f]{8,128}/);
  return m ? m[0] : raw.trim().toLowerCase().replace(/\s+/g, '');
}

export class ChecksumView implements DocKind {
  readonly root = el<HTMLElement>(`<section class="dv-panel dv-checksum" hidden>
      <div class="dv-bar">
        <span class="dv-title"></span>
        <span class="dv-gap"></span>
        <span class="dv-note"></span>
        <span class="dv-info"></span>
        <span class="ft-busy dv-spin"></span>
      </div>
      <div class="dv-ck-scroll"><div class="dv-ck-body">
        <div class="ft-panel">
          <div class="ft-panel-head"><span class="ft-panel-title">Algorithms</span><button class="ft-btn is-primary" type="button" data-k="run">${icon('dvHash', 14)}<span>Compute</span></button></div>
          <div class="dv-ck-algos">${ALGOS.map(([id, label]) => `<label class="dv-ck-algo"><input type="checkbox" value="${id}"${id === 'sha256' || id === 'md5' ? ' checked' : ''}><span>${label}</span></label>`).join('')}</div>
          <div class="dv-ck-progress"><i></i></div>
        </div>
        <div class="ft-panel">
          <div class="ft-panel-head"><span class="ft-panel-title">Checksums</span></div>
          <div class="dv-ck-rows">${ALGOS.map(([id, label]) => `<div class="dv-ck-row" data-algo="${id}" hidden><span class="dv-ck-name">${label}</span><code class="dv-ck-hex" tabindex="0" title="Click to copy"></code><span class="dv-ck-badge"></span><button class="cv-tt-btn" type="button" data-k="copy" aria-label="Copy ${label}">${icon('dvCopy', 14)}</button></div>`).join('')}</div>
          <p class="dv-ck-empty">Choose algorithms and press Compute.</p>
        </div>
        <div class="ft-panel">
          <div class="ft-panel-head"><span class="ft-panel-title">Compare</span></div>
          <input class="ft-input ft-mono dv-ck-paste" type="text" spellcheck="false" placeholder="Paste a checksum to compare" aria-label="Checksum to compare">
          <p class="dv-ck-verdict" aria-live="polite"></p>
        </div>
      </div></div>
    </section>`);
  private readonly spin = q(this.root, '.dv-spin');
  private readonly paste = q<HTMLInputElement>(this.root, '.dv-ck-paste');
  private readonly run = q<HTMLButtonElement>(this.root, '[data-k="run"]');
  private readonly seq = new Seq();
  private entry: Entry | null = null;
  private hashes: Record<string, string> = {};
  private stopBusy: (() => void) | null = null;

  constructor(private readonly deps: DocDeps) {
    this.run.addEventListener('click', () => void this.compute());
    this.paste.addEventListener('input', () => this.verdict());
    this.paste.addEventListener('keydown', (e) => { if (e.key === 'Escape') { this.paste.blur(); e.stopPropagation(); } });
    this.root.addEventListener('click', (e) => {
      const t = e.target instanceof Element ? e.target : null;
      const row = t?.closest<HTMLElement>('.dv-ck-row');
      if (row && (t?.closest('[data-k="copy"]') || t?.closest('.dv-ck-hex'))) {
        const v = this.hashes[row.dataset.algo ?? ''];
        if (v) void copyText(v).then((ok) => this.deps.status(ok ? `${row.dataset.algo} copied.` : 'Could not copy.'));
      }
    });
  }

  async open(entry: Entry): Promise<void> {
    this.seq.bump();
    this.stopBusy?.();
    this.stopBusy = null;
    this.entry = entry;
    this.hashes = {};
    setText(q(this.root, '.dv-title'), entry.name);
    setText(q(this.root, '.dv-info'), fmtBytes(entry.size));
    setText(q(this.root, '.dv-note'), '');
    this.render();
    setDisabled(this.run, false);
    q(this.root, '.dv-ck-progress').style.setProperty('--p', '0%');
  }

  close(): void {
    this.seq.bump();
    this.stopBusy?.();
    this.stopBusy = null;
    this.entry = null;
    this.hashes = {};
  }

  key(_e: KeyboardEvent): boolean { return false; }

  private chosen(): HashAlgo[] {
    return Array.from(this.root.querySelectorAll<HTMLInputElement>('.dv-ck-algo input:checked')).map((i) => i.value as HashAlgo);
  }

  private async compute(): Promise<void> {
    const entry = this.entry;
    if (!entry) return;
    const algos = this.chosen();
    if (!algos.length) { setText(q(this.root, '.dv-note'), 'Choose at least one algorithm.'); return; }
    const my = this.seq.next();
    this.stopBusy?.();
    this.stopBusy = busy(this.spin);
    setDisabled(this.run, true);
    setText(q(this.root, '.dv-note'), '');
    this.hashes = {};
    this.render();
    const progress = q(this.root, '.dv-ck-progress');
    try {
      const job = await docApi.hash([entry.path], algos);
      if (!this.seq.is(my)) return;
      this.deps.jobs.track(job, (j: Job) => {
        if (!this.seq.is(my)) return;
        if (j.state === 'running') {
          progress.style.setProperty('--p', `${j.total ? Math.round((j.done / j.total) * 100) : 0}%`);
          return;
        }
        this.stopBusy?.();
        this.stopBusy = null;
        setDisabled(this.run, false);
        progress.style.setProperty('--p', j.state === 'done' ? '100%' : '0%');
        if (j.state === 'done') {
          const res = j.result as HashResult | null;
          this.hashes = res?.items[0]?.hashes ?? {};
          if (j.errors.length) setText(q(this.root, '.dv-note'), j.errors[0].error);
          this.render();
        } else setText(q(this.root, '.dv-note'), j.state === 'failed' ? `Hashing failed: ${j.errors[0]?.error ?? 'unknown error'}.` : 'Hashing was stopped.');
      });
    } catch (err) {
      if (this.seq.is(my)) {
        this.stopBusy?.();
        this.stopBusy = null;
        setDisabled(this.run, false);
        setText(q(this.root, '.dv-note'), errText(err));
      }
    }
  }

  private render(): void {
    let shown = 0;
    this.root.querySelectorAll<HTMLElement>('.dv-ck-row').forEach((row) => {
      const v = this.hashes[row.dataset.algo ?? ''];
      setHidden(row, !v);
      if (v) { shown++; setText(row.children[1], v); }
    });
    setHidden(q(this.root, '.dv-ck-empty'), shown > 0);
    this.verdict();
  }

  private verdict(): void {
    const want = normalize(this.paste.value);
    const out = q(this.root, '.dv-ck-verdict');
    const have = Object.entries(this.hashes);
    let hit = '';
    this.root.querySelectorAll<HTMLElement>('.dv-ck-row').forEach((row) => {
      const v = this.hashes[row.dataset.algo ?? ''];
      const ok = !!want && !!v && v.toLowerCase() === want;
      if (ok) hit = hit ? `${hit}, ${row.children[0].textContent}` : row.children[0].textContent ?? '';
      setText(row.children[2], want && v ? (ok ? 'Match' : '') : '');
      setClass(row, 'is-match', ok);
    });
    let text = '';
    let state = '';
    if (want) {
      if (!have.length) { text = 'Compute the checksums first, then they are compared.'; }
      else if (hit) { text = `Matches ${hit}.`; state = 'is-ok'; }
      else { text = `No match with ${fmtInt(have.length)} computed checksum${have.length === 1 ? '' : 's'}.`; state = 'is-bad'; }
    }
    setText(out, text);
    setClass(out, 'is-ok', state === 'is-ok');
    setClass(out, 'is-bad', state === 'is-bad');
  }
}

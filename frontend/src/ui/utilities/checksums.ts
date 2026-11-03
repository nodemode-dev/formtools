import { api } from '../../io/api';
import { baseName, fmtBytes, HASH_ALGOS, utilApi, type HashItem, type VerifyItem, type VerifyResult } from '../../io/util-api';
import { el, escapeHtml, patchList, q, setClass, setDisabled, setHidden, setText } from '../dom';
import { icon } from '../icons';
import { toast } from '../toast';
import { InputList } from '../tools/inputs';
import { progressText, RunButton, track, type UtilDeps } from './common';

const SUM_NAME: Record<string, string> = { sha256: 'SHA256SUMS', sha1: 'SHA1SUMS', md5: 'MD5SUMS', sha512: 'SHA512SUMS', blake3: 'B3SUMS', sha3_256: 'SHA3-256SUMS', xxh64: 'XXH64SUMS', crc32: 'CRC32SUMS' };

export class ChecksumsView {
  readonly root = el<HTMLElement>(`<div class="ft-util-view" data-util="hash" hidden>
      <div class="ft-util-side">
        <div class="ft-inputs-slot"></div>
        <section class="ft-panel">
          <header class="ft-panel-head"><span class="ft-panel-title">Algorithms</span></header>
          <div class="ft-h-algos">${HASH_ALGOS.map(([id, label], i) => `<label class="ft-h-algo"><input type="checkbox" class="ft-check" data-algo="${id}" ${i < 2 ? 'checked' : ''}> ${label}</label>`).join('')}</div>
          <p class="ft-note">SHA-256 is what most download pages publish. BLAKE3 and XXH64 are much faster for comparing your own copies.</p>
        </section>
        <div class="ft-run-bar"><span class="ft-run-state ft-h-state"></span><button class="ft-btn is-primary" type="button" data-u="run" data-mode="run">${icon('ftHash', 14)} <span class="ft-u-run-label">Compute</span></button></div>
        <section class="ft-panel">
          <header class="ft-panel-head"><span class="ft-panel-title">Verify a checksum file</span></header>
          <input type="text" class="ft-input ft-input-wide ft-h-sums" spellcheck="false" placeholder="Path to SHA256SUMS, .md5, .sfv and similar" aria-label="Checksum file path">
          <div class="ft-run-bar"><span class="ft-run-state ft-v-state"></span><button class="ft-btn" type="button" data-h="verify">${icon('check', 14)} Verify</button></div>
        </section>
      </div>
      <div class="ft-util-main">
        <section class="ft-panel ft-util-results">
          <header class="ft-panel-head"><span class="ft-panel-title ft-h-title">Checksums</span><span class="ft-panel-count ft-h-sum"></span>
            <button class="ft-btn" type="button" data-h="save" disabled>${icon('download', 14)} Save as a sums file</button></header>
          <label class="ft-row ft-h-cmp-row"><span class="ft-row-label">Compare with</span><input type="text" class="ft-input ft-input-wide ft-mono ft-h-cmp" spellcheck="false" placeholder="Paste a published checksum"></label>
          <p class="ft-note ft-h-cmp-out"></p>
          <p class="ft-note ft-h-empty">Add files or folders on the left, then press Compute. Click any checksum to copy it.</p>
          <div class="ft-h-items"></div>
          <div class="ft-h-verify" hidden></div>
        </section>
      </div>
    </div>`);
  readonly inputs: InputList;
  private items: HashItem[] = [];
  private algos: string[] = [];
  private readonly run: RunButton;

  constructor(private readonly deps: UtilDeps) {
    this.inputs = new InputList(deps.selection, false);
    q(this.root, '.ft-inputs-slot').replaceWith(this.inputs.root);
    this.run = new RunButton(this.root, 'Compute', (id) => void api.cancelJob(id).catch(() => undefined));
    this.root.addEventListener('click', (e) => {
      const t = e.target instanceof Element ? e.target : null;
      if (t?.closest('[data-u="run"]')) { if (this.run.busy) this.run.stop(); else void this.compute(); return; }
      if (t?.closest('[data-h="verify"]')) { void this.verify(); return; }
      if (t?.closest('[data-h="save"]')) { this.save(); return; }
      const copy = t?.closest<HTMLElement>('[data-copy]')?.dataset.copy;
      if (copy) void navigator.clipboard.writeText(copy).then(() => toast('Checksum copied.')).catch(() => toast('The clipboard is not available here.', 'error'));
    });
    q(this.root, '.ft-h-cmp').addEventListener('input', () => this.compare());
    q<HTMLInputElement>(this.root, '.ft-h-sums').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); void this.verify(); } });
  }

  show(inputs?: string[]): void { if (inputs?.length) this.inputs.set(inputs); }

  private async compute(): Promise<void> {
    if (!this.inputs.value.length) { toast('Add files or a folder first.', 'error'); return; }
    const algos = [...this.root.querySelectorAll<HTMLInputElement>('[data-algo]')].filter((n) => n.checked).map((n) => n.dataset.algo!);
    if (!algos.length) { toast('Choose at least one algorithm.', 'error'); return; }
    const state = q(this.root, '.ft-h-state');
    try {
      const job = await utilApi.hash(this.inputs.value, algos);
      this.run.start(job);
      const end = await track(this.deps.jobs, job, (j) => setText(state, progressText(j, 'files')));
      this.run.finish();
      if (end.state !== 'done') return;
      this.algos = algos;
      this.items = (end.result as { items: HashItem[] }).items;
      setText(state, end.errors.length ? `${end.errors.length} could not be read` : '');
      this.render();
    } catch (e) { this.run.finish(); toast(e instanceof Error ? e.message : 'The hashing did not start.', 'error'); }
  }

  private render(): void {
    setHidden(q(this.root, '.ft-h-empty'), this.items.length > 0);
    setHidden(q(this.root, '.ft-h-verify'), true);
    setHidden(q(this.root, '.ft-h-items'), false);
    setHidden(q(this.root, '.ft-h-cmp-row'), false);
    setHidden(q(this.root, '.ft-h-cmp-out'), false);
    setText(q(this.root, '.ft-h-title'), 'Checksums');
    const bytes = this.items.reduce((s, i) => s + i.size, 0);
    setText(q(this.root, '.ft-h-sum'), this.items.length ? `${this.items.length.toLocaleString()} files · ${fmtBytes(bytes)}` : '');
    setDisabled(q<HTMLButtonElement>(this.root, '[data-h="save"]'), this.items.length === 0);
    const sig = this.algos.join(',');
    patchList(q(this.root, '.ft-h-items'), this.items.slice(0, 2000), {
      key: (it) => `${it.path}|${sig}`,
      create: (it) => {
        const n = el<HTMLElement>(`<div class="ft-h-item"><div class="ft-h-head"><span class="ft-h-name"></span><span class="ft-h-size"></span></div>${this.algos.map((a) => `<button type="button" class="ft-h-line" data-algo-line="${a}" data-copy="${escapeHtml(it.hashes[a] ?? '')}"><span class="ft-h-algo-name">${escapeHtml(HASH_ALGOS.find((x) => x[0] === a)?.[1] ?? a)}</span><code class="ft-h-hex"></code></button>`).join('')}</div>`);
        setText(q(n, '.ft-h-name'), baseName(it.path));
        n.title = it.path;
        setText(q(n, '.ft-h-size'), fmtBytes(it.size));
        for (const a of this.algos) setText(q(n, `[data-algo-line="${a}"] .ft-h-hex`), it.hashes[a] ?? '');
        return n;
      },
      update: () => undefined,
    });
    this.compare();
  }

  private compare(): void {
    const raw = q<HTMLInputElement>(this.root, '.ft-h-cmp').value.trim().toLowerCase().replace(/^[a-z0-9-]+[:=]\s*/, '').replace(/\s+/g, '');
    const out = q(this.root, '.ft-h-cmp-out');
    let hits = 0;
    for (const line of this.root.querySelectorAll<HTMLElement>('.ft-h-line')) {
      const hit = raw.length >= 8 && (line.dataset.copy ?? '').toLowerCase() === raw;
      setClass(line, 'is-match', hit);
      if (hit) hits += 1;
    }
    setClass(out, 'is-ok', hits > 0);
    setClass(out, 'is-bad', raw.length >= 8 && hits === 0 && this.items.length > 0);
    setText(out, raw.length < 8 ? '' : hits ? `Matches ${hits === 1 ? 'one file' : `${hits} lines`}.` : this.items.length ? 'No file matches this checksum.' : 'Compute first, then compare.');
  }

  private save(): void {
    const algo = this.algos[0];
    if (!algo) return;
    const text = this.items.map((i) => `${i.hashes[algo]}  ${baseName(i.path)}`).join('\n') + '\n';
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = SUM_NAME[algo] ?? 'CHECKSUMS';
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  private async verify(): Promise<void> {
    const path = q<HTMLInputElement>(this.root, '.ft-h-sums').value.trim();
    if (!path) { toast('Type the path of a checksum file.', 'error'); return; }
    const state = q(this.root, '.ft-v-state');
    const btn = q<HTMLButtonElement>(this.root, '[data-h="verify"]');
    setDisabled(btn, true);
    try {
      const job = await utilApi.hashVerify(path);
      const end = await track(this.deps.jobs, job, (j) => setText(state, progressText(j, 'files')));
      setDisabled(btn, false);
      if (end.state !== 'done') return;
      const r = end.result as VerifyResult;
      setText(state, `${r.ok} good · ${r.failed} changed · ${r.missing} missing`);
      this.showVerify(r);
    } catch (e) { setDisabled(btn, false); toast(e instanceof Error ? e.message : 'The check did not start.', 'error'); }
  }

  private showVerify(r: VerifyResult): void {
    setHidden(q(this.root, '.ft-h-empty'), true);
    setHidden(q(this.root, '.ft-h-items'), true);
    setHidden(q(this.root, '.ft-h-cmp-row'), true);
    setHidden(q(this.root, '.ft-h-cmp-out'), true);
    setText(q(this.root, '.ft-h-title'), 'Verification');
    setText(q(this.root, '.ft-h-sum'), `${r.items.length.toLocaleString()} entries`);
    const box = q(this.root, '.ft-h-verify');
    setHidden(box, false);
    const rank = (i: VerifyItem): number => i.missing ? 1 : i.ok ? 2 : 0;
    const items = [...r.items].sort((a, b) => rank(a) - rank(b));
    patchList(box, items.slice(0, 2000), {
      key: (i) => i.path,
      create: (i) => {
        const n = el<HTMLElement>(`<div class="ft-v-item"><span class="ft-v-badge"></span><span class="ft-v-name"></span><code class="ft-v-hex"></code></div>`);
        this.paintVerify(n, i);
        return n;
      },
      update: (n, i) => this.paintVerify(n, i),
    });
  }

  private paintVerify(n: HTMLElement, i: VerifyItem): void {
    n.dataset.state = i.missing ? 'missing' : i.ok ? 'ok' : 'bad';
    setText(q(n, '.ft-v-badge'), i.missing ? 'Missing' : i.ok ? 'Good' : 'Changed');
    setText(q(n, '.ft-v-name'), i.path);
    setText(q(n, '.ft-v-hex'), i.ok || i.missing ? i.expected : `expected ${i.expected}, found ${i.actual ?? ''}`);
  }
}

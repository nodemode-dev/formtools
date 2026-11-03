import type { Entry, Job } from '../../io/api';
import { modelApi, type ConvertFormat, type ModelInfo } from '../../io/model-api';
import { delayedIndicator, el, patchList, q, setClass, setHidden, setText, setValue, type Disposer } from '../dom';
import { icon } from '../icons';
import { toast } from '../toast';
import './icons';
import { ScenePanel } from './panel';
import type { Measurement, PlaybackState, RenderMode, StatsData, ViewName } from './types';

type EngineModule = typeof import('./engine');
type LoadersModule = typeof import('./loaders');
type Stage = InstanceType<EngineModule['Stage']>;

export interface ModelViewerDeps {
  status: (t: string) => void;
  jobs: { track(job: unknown, cb?: (j: any) => void): void };
}

const MODES: Array<[RenderMode, string]> = [['lit', 'Lit'], ['wireframe', 'Wireframe'], ['normals', 'Normals'], ['matcap', 'Matcap']];
const VIEWS: Array<[ViewName, string]> = [['front', 'Front'], ['right', 'Right'], ['top', 'Top'], ['iso', 'Isometric']];
const FORMATS: Array<[ConvertFormat, string]> = [['glb', 'GLB (glTF binary)'], ['obj', 'OBJ'], ['stl', 'STL'], ['ply', 'PLY'], ['off', 'OFF']];
const SPEEDS = ['0.25', '0.5', '1', '2'];

const num = (n: number): string => n.toLocaleString('en-US');
const dim = (n: number): string => (Math.abs(n) < 1e-9 ? '0' : Number(n.toPrecision(5)).toString());

export class ModelViewer {
  readonly root = el<HTMLElement>(`<section class="ft-mv" aria-label="3D model" hidden>
      <div class="ft-mv-bar">
        <button class="cv-tt-btn" type="button" data-act="fit" title="Fit to view (F)" aria-label="Fit to view">${icon('ftFit', 16)}</button>
        <label class="ft-m-field" title="Camera view (1 front, 3 right, 7 top, 9 isometric)"><select class="cv-hf-sort" data-sel="view"><option value="">View</option>${VIEWS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
        <span class="ft-vbar-sep"></span>
        <label class="ft-m-field" title="Display mode (M)">Mode <select class="cv-hf-sort" data-sel="mode">${MODES.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
        <button class="cv-tt-btn is-on" type="button" data-act="grid" title="Grid (G)" aria-label="Grid">${icon('mvGrid', 16)}</button>
        <button class="cv-tt-btn" type="button" data-act="axes" title="Axes (X)" aria-label="Axes">${icon('mvAxes', 16)}</button>
        <button class="cv-tt-btn" type="button" data-act="up" title="Treat Z as up (U)" aria-label="Z axis up">${icon('mvUp', 16)}</button>
        <span class="ft-vbar-sep"></span>
        <button class="cv-tt-btn" type="button" data-act="measure" title="Measure distance (D)" aria-label="Measure">${icon('ftRuler', 16)}</button>
        <button class="cv-tt-btn" type="button" data-act="shot" title="Save a PNG of this view (P)" aria-label="Screenshot">${icon('ftCamera', 16)}</button>
        <span class="ft-mv-conv">
          <button class="cv-tt-btn" type="button" data-act="convert" title="Convert to another format" aria-label="Convert" aria-haspopup="true">${icon('mvConvert', 16)}</button>
          <div class="ft-mv-menu" role="menu" hidden>${FORMATS.map(([v, l]) => `<button class="ft-mv-menu-item" type="button" role="menuitem" data-fmt="${v}">${l}</button>`).join('')}</div>
        </span>
        <span class="ft-mv-gap"></span>
        <span class="ft-mv-note"></span>
        <span class="ft-busy ft-mv-busy" aria-hidden="true"></span>
        <button class="cv-tt-btn" type="button" data-act="panel" title="Scene panel (H)" aria-label="Scene panel">${icon('mvTree', 16)}</button>
      </div>
      <div class="ft-mv-body">
        <div class="ft-mv-stage" tabindex="0" aria-label="3D view">
          <canvas class="ft-mv-canvas"></canvas>
          <p class="ft-mv-msg" hidden></p>
          <div class="ft-mv-readout" hidden></div>
          <div class="ft-mv-anim" hidden>
            <button class="cv-tt-btn" type="button" data-act="play" title="Play or pause (Space)" aria-label="Play or pause"><span class="ft-mv-play">${icon('ftPlay', 16)}</span><span class="ft-mv-pause" hidden>${icon('ftPause', 16)}</span></button>
            <select class="cv-hf-sort ft-mv-clip" data-sel="clip" aria-label="Animation"></select>
            <input class="ft-mv-scrub" type="range" min="0" max="1000" value="0" step="1" aria-label="Animation time">
            <span class="ft-mv-time"></span>
            <label class="ft-m-field" title="Playback speed">Speed <select class="cv-hf-sort" data-sel="speed">${SPEEDS.map((s) => `<option value="${s}"${s === '1' ? ' selected' : ''}>${s}x</option>`).join('')}</select></label>
          </div>
        </div>
      </div>
    </section>`);
  private readonly stageEl = q(this.root, '.ft-mv-stage');
  private readonly canvas = q<HTMLCanvasElement>(this.root, '.ft-mv-canvas');
  private readonly message = q(this.root, '.ft-mv-msg');
  private readonly readout = q(this.root, '.ft-mv-readout');
  private readonly anim = q(this.root, '.ft-mv-anim');
  private readonly scrub = q<HTMLInputElement>(this.root, '.ft-mv-scrub');
  private readonly menu = q(this.root, '.ft-mv-menu');
  private readonly note = q(this.root, '.ft-mv-note');
  private readonly busy = q(this.root, '.ft-mv-busy');
  private readonly panel: ScenePanel;
  private modules: Promise<[EngineModule, LoadersModule]> | null = null;
  private stage: Stage | null = null;
  private entry: Entry | null = null;
  private info: ModelInfo | null = null;
  private seq = 0;
  private abort: AbortController | null = null;
  private stopBusy: Disposer | null = null;
  private duration = 0;
  private mode: RenderMode = 'lit';
  private grid = true;
  private axes = false;
  private zUp = false;
  private measuring = false;

  constructor(private readonly deps: ModelViewerDeps) {
    this.panel = new ScenePanel({
      select: (id) => this.stage?.select(id),
      visible: (id, on) => this.stage?.setVisible(id, on),
    });
    q(this.root, '.ft-mv-body').appendChild(this.panel.root);
    this.root.querySelector('.ft-mv-bar')?.addEventListener('click', (e) => {
      const t = e.target instanceof Element ? e.target : null;
      const fmt = t?.closest<HTMLElement>('[data-fmt]')?.dataset.fmt as ConvertFormat | undefined;
      if (fmt) { this.convert(fmt); return; }
      const act = t?.closest<HTMLElement>('[data-act]')?.dataset.act;
      if (act) this.act(act);
    });
    this.anim.addEventListener('click', (e) => {
      const act = (e.target instanceof Element ? e.target.closest<HTMLElement>('[data-act]') : null)?.dataset.act;
      if (act) this.act(act);
    });
    this.root.addEventListener('change', (e) => {
      const sel = e.target instanceof HTMLSelectElement ? e.target : null;
      const kind = sel?.dataset.sel;
      if (!sel || !kind) return;
      if (kind === 'view') { if (sel.value) this.stage?.view(sel.value as ViewName); sel.value = ''; this.stageEl.focus({ preventScroll: true }); }
      else if (kind === 'mode') this.setMode(sel.value as RenderMode);
      else if (kind === 'clip') this.stage?.setClip(Number(sel.value));
      else if (kind === 'speed') this.stage?.setSpeed(Number(sel.value));
    });
    this.scrub.addEventListener('input', () => this.stage?.seek((Number(this.scrub.value) / 1000) * this.duration));
    this.stageEl.addEventListener('pointerdown', () => this.stageEl.focus({ preventScroll: true }));
    document.addEventListener('pointerdown', (e) => {
      if (!this.menu.hidden && !(e.target instanceof Node && this.menu.parentElement?.contains(e.target))) setHidden(this.menu, true);
    });
  }

  async open(entry: Entry): Promise<void> {
    const seq = ++this.seq;
    this.abort?.abort();
    const ctl = new AbortController();
    this.abort = ctl;
    this.entry = entry;
    this.info = null;
    setHidden(this.root, false);
    setHidden(this.menu, true);
    this.syncMenu();
    this.beginBusy();
    try {
      const [engine, loaders] = await this.load();
      if (seq !== this.seq) return;
      const stage = this.ensureStage(engine);
      stage.resize();
      stage.applyTheme();
      void modelApi.info(entry.path).then((info) => {
        if (seq !== this.seq) return;
        this.info = info;
        this.panel.setInfo(info);
      }).catch(() => undefined);
      const loaded = await loaders.loadModel(entry.ext, entry.path, entry.mtime, ctl.signal);
      if (seq !== this.seq) { engine.disposeTree(loaded.object); return; }
      this.measuring = false;
      this.zUp = loaders.zUpByDefault(entry.ext);
      stage.show(loaded, this.zUp);
      this.syncToolbar();
      this.panel.setInfo(this.info);
      this.panel.setDump(stage.dump());
      this.panel.setSelected(null);
      this.panel.setGridCell(stage.gridCell());
      this.syncClips(stage);
      setHidden(this.message, true);
      const s = stage.stats();
      this.deps.status(`${entry.name} · ${entry.ext.toUpperCase()} · ${num(s.triangles)} triangles`);
      stage.render();
    } catch (e) {
      if (seq !== this.seq || ctl.signal.aborted) return;
      this.fail(e instanceof Error && e.message ? e.message : 'The model could not be opened.');
    } finally {
      if (seq === this.seq) this.endBusy();
    }
  }

  close(): void {
    this.seq++;
    this.abort?.abort();
    this.abort = null;
    this.entry = null;
    this.info = null;
    this.endBusy();
    this.stage?.clear();
    this.panel.clear();
    setHidden(this.anim, true);
    setHidden(this.readout, true);
    setHidden(this.message, true);
    setHidden(this.menu, true);
    setText(this.note, '');
    this.measuring = false;
    this.syncToolbar();
    setHidden(this.root, true);
  }

  resize(): void {
    this.stage?.resize();
  }

  key(e: KeyboardEvent): boolean {
    if (this.root.hidden || e.ctrlKey || e.metaKey || e.altKey) return false;
    const tag = e.target instanceof Element ? e.target.tagName : '';
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return false;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    switch (k) {
      case 'Escape':
        if (!this.menu.hidden) { setHidden(this.menu, true); return true; }
        if (this.measuring) { this.act('measure'); return true; }
        return false;
      case 'f': case 'Home': this.act('fit'); return true;
      case '1': this.stage?.view('front'); return true;
      case '3': this.stage?.view('right'); return true;
      case '7': this.stage?.view('top'); return true;
      case '9': this.stage?.view('iso'); return true;
      case 'm': this.setMode(MODES[(MODES.findIndex(([v]) => v === this.mode) + 1) % MODES.length][0]); return true;
      case 'g': this.act('grid'); return true;
      case 'x': this.act('axes'); return true;
      case 'u': this.act('up'); return true;
      case 'd': this.act('measure'); return true;
      case 'p': this.act('shot'); return true;
      case 'h': this.act('panel'); return true;
      case ' ':
        if (this.stage?.hasClips()) { this.stage.toggle(); return true; }
        return false;
      default: return false;
    }
  }

  private load(): Promise<[EngineModule, LoadersModule]> {
    if (!this.modules) {
      this.modules = Promise.all([import('./engine'), import('./loaders')]);
      this.modules.catch(() => { this.modules = null; });
    }
    return this.modules;
  }

  private ensureStage(engine: EngineModule): Stage {
    if (this.stage) return this.stage;
    try {
      this.stage = new engine.Stage(this.canvas, this.stageEl, {
        stats: (s) => this.onStats(s),
        measure: (m) => this.onMeasure(m),
        playback: (p) => this.onPlayback(p),
        selected: (id) => this.panel.setSelected(id),
      });
    } catch {
      throw new Error('3D drawing is not available on this computer.');
    }
    this.stage.setGrid(this.grid);
    this.stage.setAxes(this.axes);
    this.stage.setMode(this.mode);
    return this.stage;
  }

  private beginBusy(): void {
    this.endBusy();
    this.stopBusy = delayedIndicator(
      () => { setClass(this.busy, 'is-on', true); this.showMessage(this.entry ? `Loading ${this.entry.name}` : 'Loading'); },
      () => { setClass(this.busy, 'is-on', false); if (this.message.dataset.kind !== 'error') setHidden(this.message, true); },
    );
  }

  private endBusy(): void {
    this.stopBusy?.();
    this.stopBusy = null;
  }

  private showMessage(text: string, kind: 'info' | 'error' = 'info'): void {
    this.message.dataset.kind = kind;
    setText(this.message, text);
    setHidden(this.message, false);
  }

  private fail(text: string): void {
    this.stage?.clear();
    this.panel.clear();
    setHidden(this.anim, true);
    setText(this.note, '');
    this.showMessage(text, 'error');
    this.deps.status(`${this.entry?.name ?? ''} · ${text}`);
  }

  private onStats(s: StatsData): void {
    if (s.triangles + s.vertices === 0) { setText(this.note, ''); return; }
    setText(this.note, `${num(s.triangles)} triangles · ${num(s.vertices)} vertices · ${num(s.calls)} draw calls`);
    this.panel.setStats(s);
  }

  private onMeasure(m: Measurement | null): void {
    setHidden(this.readout, m === null);
    if (!m) return;
    const unit = this.info?.units ? ` ${this.info.units}` : ' units';
    if (!m.a) setText(this.readout, 'Click two points on the model.');
    else if (!m.b) setText(this.readout, 'Click a second point.');
    else {
      const d = [0, 1, 2].map((i) => Math.abs((m.b as number[])[i] - (m.a as number[])[i]));
      setText(this.readout, `Distance ${dim(m.distance)}${unit}   dx ${dim(d[0])}   dy ${dim(d[1])}   dz ${dim(d[2])}`);
    }
  }

  private onPlayback(p: PlaybackState): void {
    this.duration = p.duration;
    setHidden(q(this.anim, '.ft-mv-play'), p.playing);
    setHidden(q(this.anim, '.ft-mv-pause'), !p.playing);
    setText(q(this.anim, '.ft-mv-time'), `${p.time.toFixed(2)} / ${p.duration.toFixed(2)} s`);
    setValue(this.scrub, String(p.duration > 0 ? Math.round((p.time / p.duration) * 1000) : 0));
  }

  private syncClips(stage: Stage): void {
    const clips = stage.clipList();
    setHidden(this.anim, clips.length === 0);
    const sel = q<HTMLSelectElement>(this.anim, '.ft-mv-clip');
    patchList(sel, clips.map((c, i) => ({ i, name: c.name })), {
      key: (c) => String(c.i),
      create: (c) => {
        const o = document.createElement('option');
        o.value = String(c.i);
        o.textContent = c.name || `Clip ${c.i + 1}`;
        return o;
      },
      update: (o, c) => setText(o, c.name || `Clip ${c.i + 1}`),
    });
    sel.value = '0';
    setHidden(sel, clips.length < 2);
    setValue(q(this.anim, '[data-sel="speed"]'), '1');
    stage.setSpeed(1);
  }

  private syncToolbar(): void {
    setClass(q(this.root, '[data-act="grid"]'), 'is-on', this.grid);
    setClass(q(this.root, '[data-act="axes"]'), 'is-on', this.axes);
    setClass(q(this.root, '[data-act="up"]'), 'is-on', this.zUp);
    setClass(q(this.root, '[data-act="measure"]'), 'is-on', this.measuring);
    setClass(this.stageEl, 'is-measuring', this.measuring);
    setValue(q(this.root, '[data-sel="mode"]'), this.mode);
  }

  private syncMenu(): void {
    this.menu.querySelectorAll<HTMLElement>('[data-fmt]').forEach((b) => setHidden(b, b.dataset.fmt === this.entry?.ext));
  }

  private setMode(mode: RenderMode): void {
    this.mode = mode;
    this.stage?.setMode(mode);
    this.syncToolbar();
  }

  private act(act: string): void {
    const stage = this.stage;
    switch (act) {
      case 'fit': stage?.fit(); break;
      case 'grid': this.grid = !this.grid; stage?.setGrid(this.grid); break;
      case 'axes': this.axes = !this.axes; stage?.setAxes(this.axes); break;
      case 'up': if (stage) { this.zUp = !this.zUp; stage.setUp(this.zUp); this.panel.setGridCell(stage.gridCell()); } break;
      case 'measure': if (stage) { this.measuring = !this.measuring; stage.setMeasuring(this.measuring); } break;
      case 'shot': void this.shot(); break;
      case 'convert': setHidden(this.menu, !this.menu.hidden); break;
      case 'panel': {
        const on = this.panel.toggle();
        setClass(q(this.root, '[data-act="panel"]'), 'is-on', on);
        window.requestAnimationFrame(() => this.stage?.resize());
        break;
      }
      case 'play': stage?.toggle(); break;
      default: break;
    }
    if (act !== 'convert' && act !== 'panel') this.syncToolbar();
  }

  private async shot(): Promise<void> {
    const e = this.entry;
    const blob = await this.stage?.screenshot();
    if (!e || !blob) { toast('The picture could not be saved.', 'error'); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${e.name.replace(/\.[^.]+$/, '') || 'model'}.png`;
    this.root.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  private convert(format: ConvertFormat): void {
    const e = this.entry;
    setHidden(this.menu, true);
    if (!e) return;
    void modelApi.convert(e.path, format).then((job) => {
      this.deps.status(`Converting ${e.name} to ${format.toUpperCase()}`);
      let done = false;
      this.deps.jobs.track(job, (j: Job) => {
        if (done) return;
        if (j.state === 'done') {
          done = true;
          const out = (j.result as { path?: string } | null)?.path ?? '';
          const name = out.split(/[\\/]/).pop() ?? '';
          toast(name ? `Saved ${name}.` : 'The conversion finished.');
          this.deps.status(name ? `Saved ${name}` : 'Conversion finished');
        } else if (j.state === 'failed' || j.state === 'cancelled') {
          done = true;
          toast(j.errors[0]?.error ?? 'The conversion did not finish.', 'error');
        }
      });
    }).catch((err) => toast(err instanceof Error ? err.message : 'The conversion did not start.', 'error'));
  }
}

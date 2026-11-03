import { api, type Entry, type MediaInfo } from '../io/api';
import { el, q, setClass, setHidden, setStyleVar, setText, setValue } from './dom';
import { icon } from './icons';
import { toast } from './toast';
import type { Jobs } from './jobs';

const SPEEDS = ['0.25', '0.5', '0.75', '1', '1.25', '1.5', '2', '3', '4'];

const clock = (t: number): string => {
  if (!Number.isFinite(t)) return '0:00';
  const s = Math.max(0, t), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const ss = sec.toFixed(2).padStart(5, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
};

export class MediaBar {
  readonly root = el<HTMLElement>(`<div class="ft-mbar" hidden>
      <button class="cv-tt-btn" type="button" data-m="play" title="Play or pause (K)" aria-label="Play or pause"><span class="ft-m-play">${icon('ftPlay', 16)}</span><span class="ft-m-pause" hidden>${icon('ftPause', 16)}</span></button>
      <button class="cv-tt-btn" type="button" data-m="frame-prev" title="Previous frame (,)" aria-label="Previous frame">${icon('ftFramePrev', 16)}</button>
      <button class="cv-tt-btn" type="button" data-m="frame-next" title="Next frame (.)" aria-label="Next frame">${icon('ftFrameNext', 16)}</button>
      <span class="ft-m-time"></span>
      <span class="ft-vbar-sep"></span>
      <label class="ft-m-field" title="Playback speed">Speed <select class="cv-hf-sort ft-m-speed">${SPEEDS.map((s) => `<option value="${s}">${s}x</option>`).join('')}</select></label>
      <button class="cv-tt-btn ft-m-loop" type="button" data-m="loop" title="A-B loop: set A, set B, clear (B)" aria-label="A-B loop">${icon('ftLoop', 16)}</button>
      <span class="ft-m-ab"></span>
      <button class="cv-tt-btn" type="button" data-m="clip" title="Save A-B as a clip without re-encoding" aria-label="Save A-B as a clip">${icon('ftScissors', 16)}</button>
      <span class="ft-vbar-sep"></span>
      <label class="ft-m-field ft-m-subs-box" title="Subtitles">${icon('ftSubtitle', 16)}<select class="cv-hf-sort ft-m-subs"><option value="">Off</option></select></label>
      <button class="cv-tt-btn" type="button" data-m="snap" title="Save this frame as a PNG beside the video" aria-label="Snapshot">${icon('ftCamera', 16)}</button>
      <button class="cv-tt-btn" type="button" data-m="audio" title="Save the audio track without re-encoding" aria-label="Extract audio">${icon('ftAudio', 16)}</button>
      <span class="ft-m-note"></span>
    </div>`);
  readonly wave = el<HTMLElement>(`<div class="ft-wave" hidden><canvas class="ft-wave-canvas" width="1200" height="120"></canvas><i class="ft-wave-head"></i><i class="ft-wave-a"></i><i class="ft-wave-b"></i></div>`);
  private media: HTMLMediaElement | null = null;
  private entry: Entry | null = null;
  private info: MediaInfo | null = null;
  private a: number | null = null;
  private b: number | null = null;
  private fps = 25;
  private seq = 0;
  private readonly onTime = (): void => this.tick();

  constructor(private readonly jobs: Jobs, private readonly refresh: () => void) {
    this.root.addEventListener('click', (e) => {
      const act = (e.target instanceof Element ? e.target.closest<HTMLElement>('[data-m]') : null)?.dataset.m;
      if (act) this.act(act);
    });
    q<HTMLSelectElement>(this.root, '.ft-m-speed').addEventListener('change', (e) => { if (this.media) this.media.playbackRate = Number((e.target as HTMLSelectElement).value); });
    q<HTMLSelectElement>(this.root, '.ft-m-subs').addEventListener('change', (e) => this.pickSub((e.target as HTMLSelectElement).value));
    this.wave.addEventListener('pointerdown', (e) => {
      if (!this.media || !Number.isFinite(this.media.duration)) return;
      const r = this.wave.getBoundingClientRect();
      this.media.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * this.media.duration;
    });
  }

  attach(media: HTMLMediaElement, entry: Entry): void {
    this.detach();
    this.seq++;
    this.media = media;
    this.entry = entry;
    this.info = null;
    this.a = this.b = null;
    this.fps = 25;
    media.playbackRate = 1;
    setValue(q(this.root, '.ft-m-speed'), '1');
    for (const ev of ['timeupdate', 'play', 'pause', 'loadedmetadata', 'seeked']) media.addEventListener(ev, this.onTime);
    const isVideo = media instanceof HTMLVideoElement;
    for (const k of ['frame-prev', 'frame-next', 'snap', 'audio']) setHidden(q(this.root, `[data-m="${k}"]`), !isVideo);
    setHidden(q(this.root, '.ft-m-subs-box'), !isVideo);
    setHidden(this.root, false);
    setHidden(this.wave, isVideo);
    this.clearTracks();
    setText(q(this.root, '.ft-m-note'), '');
    this.tick();
  }

  detach(): void {
    if (this.media) for (const ev of ['timeupdate', 'play', 'pause', 'loadedmetadata', 'seeked']) this.media.removeEventListener(ev, this.onTime);
    this.media = null;
    setHidden(this.root, true);
    setHidden(this.wave, true);
  }

  setInfo(info: MediaInfo | null): void {
    this.info = info;
    const v = info?.streams.find((s) => s.type === 'video');
    if (v?.fps) this.fps = v.fps;
  }

  note(text: string): void { setText(q(this.root, '.ft-m-note'), text); }

  async loadSubtitles(path: string): Promise<void> {
    const seq = this.seq;
    try {
      const list = await api.subtitles(path);
      if (seq !== this.seq || !(this.media instanceof HTMLVideoElement)) return;
      const sel = q<HTMLSelectElement>(this.root, '.ft-m-subs');
      const video = this.media;
      const add = (value: string, label: string, src: string, lang: string): void => {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = label;
        sel.appendChild(opt);
        const track = document.createElement('track');
        track.kind = 'subtitles';
        track.label = label;
        track.srclang = lang || 'und';
        track.src = src;
        track.dataset.key = value;
        video.appendChild(track);
      };
      list.embedded.forEach((s) => add(`e${s.index}`, s.title || s.language || `Track ${s.index}`, api.subtitleUrl(path, s.index), s.language ?? ''));
      list.external.forEach((f) => add(`f${f}`, f.split(/[\\/]/).pop() ?? f, api.subtitleFileUrl(path, f), ''));
      setClass(q(this.root, '.ft-m-subs-box'), 'is-empty', list.embedded.length + list.external.length === 0);
      for (const t of Array.from(video.textTracks)) t.mode = 'disabled';
    } catch {
      return;
    }
  }

  private clearTracks(): void {
    const sel = q<HTMLSelectElement>(this.root, '.ft-m-subs');
    while (sel.options.length > 1) sel.remove(1);
    sel.value = '';
    if (this.media) for (const t of Array.from(this.media.querySelectorAll('track'))) t.remove();
  }

  private pickSub(value: string): void {
    if (!(this.media instanceof HTMLVideoElement)) return;
    const tracks = Array.from(this.media.querySelectorAll('track'));
    for (const t of tracks) t.track.mode = t.dataset.key === value ? 'showing' : 'disabled';
  }

  async loadWave(path: string): Promise<void> {
    const seq = this.seq;
    const canvas = q<HTMLCanvasElement>(this.wave, 'canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    try {
      const w = await api.waveform(path, 1200);
      if (seq !== this.seq) return;
      const H = canvas.height, W = canvas.width, mid = H / 2;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = getComputedStyle(this.wave).getPropertyValue('--accent-color').trim() || '#f97316';
      const step = W / w.peaks.length;
      w.peaks.forEach((p, i) => { const h = Math.max(1, p * (H - 8)); ctx.fillRect(i * step, mid - h / 2, Math.max(1, step - 0.5), h); });
    } catch {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  private tick(): void {
    const m = this.media;
    if (!m) return;
    setText(q(this.root, '.ft-m-time'), `${clock(m.currentTime)} / ${clock(m.duration)}`);
    setHidden(q(this.root, '.ft-m-play'), !m.paused);
    setHidden(q(this.root, '.ft-m-pause'), m.paused);
    if (this.a !== null && this.b !== null && m.currentTime >= this.b) m.currentTime = this.a;
    const d = Number.isFinite(m.duration) && m.duration > 0 ? m.duration : 0;
    setStyleVar(this.wave, '--head', d ? `${(m.currentTime / d) * 100}%` : '0%');
    setStyleVar(this.wave, '--a', d && this.a !== null ? `${(this.a / d) * 100}%` : '-10%');
    setStyleVar(this.wave, '--b', d && this.b !== null ? `${(this.b / d) * 100}%` : '-10%');
  }

  private syncLoop(): void {
    setClass(q(this.root, '.ft-m-loop'), 'is-on', this.a !== null);
    setText(q(this.root, '.ft-m-ab'), this.a === null ? '' : this.b === null ? `A ${clock(this.a)}` : `${clock(this.a)} to ${clock(this.b)}`);
    q<HTMLButtonElement>(this.root, '[data-m="clip"]').disabled = this.a === null || this.b === null;
    this.tick();
  }

  key(e: KeyboardEvent): boolean {
    const m = this.media;
    if (!m) return false;
    const map: Record<string, () => void> = {
      k: () => this.act('play'), ' ': () => this.act('play'),
      ',': () => this.act('frame-prev'), '.': () => this.act('frame-next'),
      j: () => { m.currentTime = Math.max(0, m.currentTime - 5); },
      l: () => { m.currentTime = Math.min(m.duration || 0, m.currentTime + 5); },
      b: () => this.act('loop'),
      '[': () => this.speed(-1), ']': () => this.speed(1),
      m: () => { m.muted = !m.muted; },
    };
    const fn = map[e.key];
    if (!fn) return false;
    fn();
    return true;
  }

  private speed(d: number): void {
    const sel = q<HTMLSelectElement>(this.root, '.ft-m-speed');
    const i = Math.max(0, Math.min(SPEEDS.length - 1, SPEEDS.indexOf(sel.value) + d));
    sel.value = SPEEDS[i];
    if (this.media) this.media.playbackRate = Number(SPEEDS[i]);
  }

  private act(act: string): void {
    const m = this.media, e = this.entry;
    if (!m || !e) return;
    switch (act) {
      case 'play': if (m.paused) void m.play().catch(() => undefined); else m.pause(); break;
      case 'frame-prev': m.pause(); m.currentTime = Math.max(0, m.currentTime - 1 / this.fps); break;
      case 'frame-next': m.pause(); m.currentTime = Math.min(m.duration || 0, m.currentTime + 1 / this.fps); break;
      case 'loop':
        if (this.a === null) this.a = m.currentTime;
        else if (this.b === null) { if (m.currentTime > this.a) this.b = m.currentTime; else { this.b = this.a; this.a = m.currentTime; } }
        else { this.a = this.b = null; }
        this.syncLoop();
        break;
      case 'clip':
        if (this.a === null || this.b === null) return;
        void api.mediaCopy(e.path, 'trim', { start: this.a, end: this.b }).then((j) => this.jobs.track(j, (job) => { if (job.state === 'done') this.refresh(); })).catch((err) => toast(err instanceof Error ? err.message : 'The clip was not saved.', 'error'));
        break;
      case 'snap':
        void api.snapshot(e.path, m.currentTime).then((r) => { toast(`Saved ${r.path.split(/[\\/]/).pop()}.`); this.refresh(); }).catch((err) => toast(err instanceof Error ? err.message : 'The frame was not saved.', 'error'));
        break;
      case 'audio': {
        const a = this.info?.streams.find((s) => s.type === 'audio');
        const container = a?.codec === 'aac' ? 'm4a' : a?.codec === 'mp3' ? 'mp3' : a?.codec === 'flac' ? 'flac' : a?.codec === 'opus' ? 'opus' : 'mka';
        void api.mediaCopy(e.path, 'extract-audio', { container }).then((j) => this.jobs.track(j, (job) => { if (job.state === 'done') this.refresh(); })).catch((err) => toast(err instanceof Error ? err.message : 'The audio was not saved.', 'error'));
        break;
      }
      default: break;
    }
  }
}

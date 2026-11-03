import { el, q, setClass, setDisabled, setText } from '../dom';
import { icon } from '../icons';
import { accelFromEvent, accelLabel, modifiersOf, modsLabel } from './accel';

export class ShortcutField {
  readonly root: HTMLElement;
  private readonly input: HTMLInputElement;
  private readonly clearBtn: HTMLButtonElement;
  private readonly note: HTMLElement;
  private accel = '';
  private changed: (accel: string) => void = () => undefined;

  constructor(label: string) {
    this.root = el<HTMLElement>(`<div class="ft-desk-key">
        <div class="ft-desk-key-box">
          <input type="text" class="ft-input ft-desk-key-input" readonly spellcheck="false" autocomplete="off" placeholder="Not set" aria-label="Shortcut for ${label.replace(/[^A-Za-z0-9 ]/g, '')}">
          <button type="button" class="ft-icon-x ft-desk-key-clear" title="Clear the shortcut" aria-label="Clear the shortcut">${icon('close', 12)}</button>
        </div>
        <span class="ft-desk-key-note" role="status"></span>
      </div>`);
    this.input = q<HTMLInputElement>(this.root, '.ft-desk-key-input');
    this.clearBtn = q<HTMLButtonElement>(this.root, '.ft-desk-key-clear');
    this.note = q(this.root, '.ft-desk-key-note');
    this.input.addEventListener('focus', () => { setClass(this.root, 'is-rec', true); this.input.placeholder = 'Press the keys'; this.input.value = ''; });
    this.input.addEventListener('blur', () => { setClass(this.root, 'is-rec', false); this.input.placeholder = 'Not set'; this.paint(); });
    this.input.addEventListener('keydown', (e) => this.key(e));
    this.input.addEventListener('keyup', (e) => {
      if (!this.root.classList.contains('is-rec')) return;
      const mods = modifiersOf(e);
      this.input.value = mods.length ? modsLabel(mods) : '';
    });
    this.clearBtn.addEventListener('click', () => this.commit(''));
  }

  get value(): string { return this.accel; }

  onChange(fn: (accel: string) => void): void { this.changed = fn; }

  set(accel: string): void {
    this.accel = accel;
    if (document.activeElement !== this.input) this.paint();
    this.syncClear();
  }

  setError(text: string): void {
    setText(this.note, text);
    setClass(this.root, 'is-bad', text !== '');
  }

  setDisabled(off: boolean): void {
    setDisabled(this.input, off);
    this.syncClear(off);
  }

  private paint(): void {
    const label = accelLabel(this.accel);
    if (this.input.value !== label) this.input.value = label;
    this.input.title = this.accel;
  }

  private syncClear(off = this.input.disabled): void {
    setDisabled(this.clearBtn, off || this.accel === '');
  }

  private commit(accel: string): void {
    const different = accel !== this.accel;
    this.accel = accel;
    this.paint();
    this.syncClear();
    if (different) this.changed(accel);
  }

  private key(e: KeyboardEvent): void {
    const bare = !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey;
    if (e.key === 'Tab' && bare) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.repeat) return;
    if (bare && e.key === 'Escape') { this.input.blur(); return; }
    if (bare && (e.key === 'Backspace' || e.key === 'Delete')) { this.commit(''); this.input.blur(); return; }
    const accel = accelFromEvent(e);
    if (accel) { this.commit(accel); this.input.blur(); return; }
    const mods = modifiersOf(e);
    this.input.value = mods.length ? modsLabel(mods) : '';
  }
}

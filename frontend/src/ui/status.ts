import { el, q, setClass, setText, setTitle } from './dom';

export class StatusBar {
  readonly root = el<HTMLElement>(`<footer class="cv-status" role="status">
      <span class="cv-st-hint ft-st-hint"></span>
      <span class="ft-st-slot"></span>
      <span class="ft-st-engine"><i class="ft-dot"></i><span class="ft-st-engine-text">Engine starting</span></span>
    </footer>`);
  private readonly hint = q(this.root, '.ft-st-hint');
  private readonly engine = q(this.root, '.ft-st-engine');

  mount(node: HTMLElement): void { q(this.root, '.ft-st-slot').replaceWith(node); }

  setHint(text: string): void { setText(this.hint, text); setTitle(this.hint, text); }

  setEngine(state: 'up' | 'down' | 'wait', text: string): void {
    setClass(this.engine, 'is-up', state === 'up');
    setClass(this.engine, 'is-down', state === 'down');
    setText(q(this.engine, '.ft-st-engine-text'), text);
  }
}

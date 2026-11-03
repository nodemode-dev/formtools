import { el, q, setClass, setHidden, setText } from '../ui/dom';

export type HintItem = [string, string];

export interface Hint {
  set(items: HintItem[]): void;
  say(text: string): void;
}

const FADE_MS = 3000;

export function createHint(host: HTMLElement): Hint {
  const root = el<HTMLElement>('<div class="ov-hint is-faded" role="status"><div class="ov-hint-row"></div><div class="ov-hint-say" hidden></div></div>');
  const row = q(root, '.ov-hint-row');
  const say = q(root, '.ov-hint-say');
  host.append(root);
  let timer = 0;

  const show = (): void => {
    setClass(root, 'is-faded', false);
    window.clearTimeout(timer);
    timer = window.setTimeout(() => setClass(root, 'is-faded', true), FADE_MS);
  };

  return {
    set(items) {
      const parts = items.map(([key, label]) => el(`<span class="ov-hint-item"><kbd>${key}</kbd><span>${label}</span></span>`));
      row.replaceChildren(...parts);
      setHidden(say, true);
      setHidden(row, false);
      show();
    },
    say(text) {
      setText(say, text);
      setHidden(say, false);
      setHidden(row, true);
      show();
    },
  };
}

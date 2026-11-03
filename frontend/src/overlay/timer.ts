import { el, q, setClass, setStyleVar, setText } from '../ui/dom';
import type { BaseCtx, Disposer } from './ctx';

const clock = (seconds: number): string => {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return `${h ? `${h}:` : ''}${mm}:${String(r).padStart(2, '0')}`;
};

export function mountTimer(ctx: BaseCtx): Disposer {
  const asked = Number(ctx.params.options.minutes);
  let total = (Number.isFinite(asked) && asked > 0 ? Math.min(asked, 600) : 5) * 60000;
  let end = Date.now() + total;

  const root = el<HTMLElement>('<div class="ov-timer"><div class="ov-timer-card"><div class="ov-timer-label">Break</div><div class="ov-timer-time"></div><div class="ov-timer-bar"><i></i></div><div class="ov-timer-sub"></div></div></div>');
  const label = q(root, '.ov-timer-label');
  const time = q(root, '.ov-timer-time');
  const sub = q(root, '.ov-timer-sub');
  const bar = q(root, '.ov-timer-bar');
  q(document, '#ov-root').append(root);

  const tick = (): void => {
    const left = end - Date.now();
    const over = left <= 0;
    setClass(root, 'is-over', over);
    setText(label, over ? 'Time is up' : 'Break');
    setText(time, over ? `+${clock(-left / 1000)}` : clock(Math.ceil(left / 1000)));
    setText(sub, over ? 'Overtime' : `${Math.round(total / 60000)} min break`);
    setStyleVar(bar, '--p', String(over ? 0 : Math.max(0, Math.min(1, left / total))));
  };

  const adjust = (minutes: number): void => {
    total = Math.max(60000, total + minutes * 60000);
    end = Math.max(Date.now() + 1000, end + minutes * 60000);
    tick();
  };

  const ac = new AbortController();
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') void ctx.cancel();
    else if (e.key === 'ArrowUp') { e.preventDefault(); adjust(1); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); adjust(-1); }
  }, { signal: ac.signal });

  ctx.hint.set([['Up Down', 'add or remove a minute'], ['Esc', 'close']]);
  tick();
  const timer = window.setInterval(tick, 200);

  return () => {
    ac.abort();
    window.clearInterval(timer);
    root.remove();
  };
}

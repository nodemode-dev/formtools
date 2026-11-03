import { ICONS } from '../icons';

const s = (body: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

const DESK_ICONS: Record<string, string> = {
  ftDesk: s('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M9 20h6M12 16v4"/><path d="M7 9h4M7 12h7"/>'),
  ftZoomDraw: s('<circle cx="10" cy="10" r="6"/><path d="M14.5 14.5 20 20"/><path d="M7.5 11.5c1-2.5 2-2.5 2.5-1s1.5 1.5 2.5-1"/>'),
  ftTimer: s('<circle cx="12" cy="13.5" r="7"/><path d="M12 13.5V9.5"/><path d="M10 3h4"/><path d="M12 3v3.5"/><path d="M18.5 7l1.5-1.5"/>'),
  ftAwake: s('<path d="M7 18h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7 8.8 4.6 4.6 0 0 0 7 18z"/><path d="M12 12v2.5"/><circle cx="12" cy="11" r=".4"/>'),
  ftTopmost: s('<rect x="3.5" y="9" width="13" height="11" rx="1.5"/><path d="M8 9V6.5a1.5 1.5 0 0 1 1.5-1.5H20v10a1.5 1.5 0 0 1-1.5 1.5H16.5"/><path d="M3.5 12.5h13"/>'),
  ftHosts: s('<rect x="3.5" y="4" width="17" height="6" rx="1.5"/><rect x="3.5" y="14" width="17" height="6" rx="1.5"/><path d="M7 7h.01M7 17h.01"/><path d="M11 7h6M11 17h6"/>'),
  ftEnv: s('<path d="M8 4C6 4 5 5 5 7v3c0 1.2-.6 2-2 2 1.4 0 2 .8 2 2v3c0 2 1 3 3 3"/><path d="M16 4c2 0 3 1 3 3v3c0 1.2.6 2 2 2-1.4 0-2 .8-2 2v3c0 2-1 3-3 3"/><path d="M9.5 12h5"/>'),
  ftKeyboard: s('<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h1M10 10h1M14 10h1M18 10h.01M6 14h.01M9 14h6M18 14h.01"/>'),
  ftCopy: s('<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5"/>'),
  ftTrashCan: s('<path d="M4.5 7h15"/><path d="M9 7V4.5h6V7"/><path d="M6.5 7l.9 12.5h9.2L17.5 7"/>'),
};

Object.assign(ICONS, DESK_ICONS);

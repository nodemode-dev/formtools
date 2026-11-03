import { ICONS } from '../icons';

const s = (body: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

const DV_ICONS: Record<string, string> = {
  dvWrap: s('<path d="M4 6h16"/><path d="M4 12h13a3 3 0 0 1 0 6h-4"/><path d="M15 15.5L12.5 18l2.5 2.5"/><path d="M4 18h4"/>'),
  dvCaseUp: s('<path d="M3 17l4-10 4 10"/><path d="M4.4 13.5h5.2"/><circle cx="17" cy="14" r="3"/><path d="M20 11v6"/>'),
  dvCopy: s('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3"/>'),
  dvFile: s('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>'),
  dvFolder: s('<path d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>'),
  dvSortUp: s('<path d="M12 18V6"/><path d="M7 11l5-5 5 5"/>'),
  dvSortDown: s('<path d="M12 6v12"/><path d="M7 13l5 5 5-5"/>'),
  dvTable: s('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M3 14h18M9 4v16"/>'),
  dvDb: s('<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>'),
  dvHex: s('<path d="M5 6v6M5 9h3M8 6v6"/><path d="M12 6h4M12 6v6h4M12 9h3"/><path d="M5 15h14M5 18h9"/>'),
  dvTree: s('<rect x="3" y="4" width="6" height="4" rx="1"/><rect x="12" y="10" width="6" height="4" rx="1"/><rect x="12" y="16" width="6" height="4" rx="1"/><path d="M6 8v10h6M6 12h6"/>'),
  dvDoc: s('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 12h6M9 15h6M9 18h4"/>'),
  dvLock: s('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  dvLink: s('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
  dvExtract: s('<path d="M12 4v11"/><path d="M7 11l5 5 5-5"/><path d="M5 20h14"/>'),
  dvThumbs: s('<rect x="3" y="4" width="6" height="7" rx="1"/><rect x="3" y="14" width="6" height="7" rx="1"/><rect x="12" y="4" width="9" height="17" rx="1"/>'),
  dvHash: s('<path d="M9 3L7 21M17 3l-2 18M4 9h17M3 15h17"/>'),
  dvJump: s('<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>'),
  dvInstall: s('<path d="M12 4v10"/><path d="M8 10l4 4 4-4"/><rect x="4" y="16" width="16" height="4" rx="1"/>'),
  dvUp: s('<path d="M12 19V5"/><path d="M6 11l6-6 6 6"/>'),
  dvDown: s('<path d="M12 5v14"/><path d="M6 13l6 6 6-6"/>'),
  dvExpand: s('<path d="M7 9l5-5 5 5"/><path d="M7 15l5 5 5-5"/>'),
  dvCollapse: s('<path d="M7 5l5 5 5-5"/><path d="M7 19l5-5 5 5"/>'),
};

Object.assign(ICONS, DV_ICONS);

export const DV_ICON_NAMES = Object.keys(DV_ICONS);

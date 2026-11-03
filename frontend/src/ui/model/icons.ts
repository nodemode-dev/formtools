import { ICONS } from '../icons';
import '../ft-icons';

const s = (body: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

const MODEL_ICONS: Record<string, string> = {
  mvGrid: s('<path d="M8 5h8l5 14H3z"/><path d="M5.5 12h13M4.2 15.5h15.6M12 5v14M10 5L7.5 19M14 5l2.5 14"/>'),
  mvAxes: s('<path d="M7 17V4M4.5 6.5L7 4l2.5 2.5"/><path d="M7 17h13M17.5 14.5L20 17l-2.5 2.5"/><path d="M7 17l-4.5 4.5"/>'),
  mvUp: s('<path d="M12 3.5v12M7.5 8L12 3.5 16.5 8"/><path d="M4.5 20h15"/>'),
  mvTree: s('<rect x="3.5" y="4" width="6" height="4.5" rx="1"/><rect x="13.5" y="10" width="7" height="4.5" rx="1"/><rect x="13.5" y="17.5" width="7" height="4" rx="1"/><path d="M6.5 8.5v9a2 2 0 0 0 2 2h5M6.5 12.25h7"/>'),
  mvConvert: s('<path d="M10 3l6 3.4v6.8L10 16.6 4 13.2V6.4z"/><path d="M4 6.4l6 3.4 6-3.4M10 9.8v6.8"/><path d="M15 19.5h6M18.5 17l2.5 2.5-2.5 2.5"/>'),
  mvChevronDown: s('<path d="M7 9.5l5 5 5-5"/>'),
  mvChevronRight: s('<path d="M9.5 7l5 5-5 5"/>'),
  mvEye: s('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>'),
  mvEyeOff: s('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" opacity="0.4"/><path d="M4 20L20 4"/>'),
};

Object.assign(ICONS, MODEL_ICONS);

export const MODEL_ICON_NAMES = Object.keys(MODEL_ICONS);

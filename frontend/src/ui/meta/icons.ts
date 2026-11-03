import { ICONS } from '../icons';

const s = (body: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

const META_ICONS: Record<string, string> = {
  metaBraces: s('<path d="M9 4C7 4 6.5 5 6.5 6.5v2C6.5 10 5.5 12 4 12c1.5 0 2.5 2 2.5 3.5v2C6.5 19 7 20 9 20"/><path d="M15 4c2 0 2.5 1 2.5 2.5v2c0 1.5 1 3.5 2.5 3.5-1.5 0-2.5 2-2.5 3.5v2c0 1.5-.5 2.5-2.5 2.5"/>'),
  metaChevron: s('<path d="M9.5 7l5 5-5 5"/>'),
};

Object.assign(ICONS, META_ICONS);

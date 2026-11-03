import { ICONS } from '../icons';

const s = (body: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

const UTIL_ICONS: Record<string, string> = {
  ftTrash: s('<path d="M4 7h16"/><path d="M9 7V4.5h6V7"/><path d="M6.5 7l1 13h9l1-13"/><path d="M10 11v5.5M14 11v5.5"/>'),
  ftTemplate: s('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M12 11v6M9 14h6"/>'),
  ftLocked: s('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/><circle cx="12" cy="16" r="1.3"/>'),
  ftSweep: s('<path d="M14 3l-4 9"/><path d="M6.5 12h7l2 9h-11z"/><path d="M8.5 16.5v4.5M12 16.5v4.5"/>'),
  ftScan: s('<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M4 12h16"/>'),
  ftUtilities: s('<path d="M14.5 6.5a3.5 3.5 0 0 0-4.6 4.4L4 16.8 7.2 20l5.9-5.9a3.5 3.5 0 0 0 4.4-4.6l-2.1 2.1-2.4-.6-.6-2.4z"/>'),
};

Object.assign(ICONS, UTIL_ICONS);

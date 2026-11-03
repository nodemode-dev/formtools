import { ICONS } from './icons';

const s = (body: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

const FT_ICONS: Record<string, string> = {
  ftHome: s('<path d="M4 11l8-6 8 6"/><path d="M6 10v9h12v-9"/><path d="M10 19v-5h4v5"/>'),
  ftBrowse: s('<rect x="3" y="4" width="7" height="7" rx="1.5"/><rect x="14" y="4" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
  ftViewer: s('<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/><path d="M8 10.5h5M10.5 8v5"/>'),
  ftBatch: s('<rect x="7" y="3" width="13" height="13" rx="2"/><path d="M4 7v11a2 2 0 0 0 2 2h11"/><path d="M11 12l2.5-3 3 4"/>'),
  ftResize: s('<rect x="3" y="9" width="12" height="12" rx="1.5"/><path d="M13 3h8v8"/><path d="M21 3l-8 8"/>'),
  ftRename: s('<path d="M4 7h10"/><path d="M4 12h7"/><path d="M4 17h5"/><path d="M14 19l1-3.5 5.5-5.5 2.5 2.5-5.5 5.5z"/>'),
  ftMedia: s('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9.5v5l4.5-2.5z"/>'),
  ftAudio: s('<path d="M9 18V6l10-2v12"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="16" r="2"/>'),
  ftCube: s('<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5"/><path d="M12 12v9"/>'),
  ftText: s('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 12h6M9 15h6M9 18h4"/>'),
  ftCode: s('<path d="M8 8l-4 4 4 4"/><path d="M16 8l4 4-4 4"/><path d="M13.5 5l-3 14"/>'),
  ftArchive: s('<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10h14V9"/><path d="M10 13h4"/>'),
  ftHash: s('<path d="M9 3L7 21M17 3l-2 18M4 9h17M3 15h17"/>'),
  ftFont: s('<path d="M4 20L10 4h1l6 16"/><path d="M6.5 14h8"/><path d="M17 20h4"/>'),
  ftDuplicate: s('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>'),
  ftDisk: s('<circle cx="12" cy="12" r="8.5"/><path d="M12 12V3.5"/><path d="M12 12l6 6"/>'),
  ftPicker: s('<path d="M14.5 4.5l5 5"/><path d="M17 2l5 5-3 3-5-5z"/><path d="M14 8L5 17l-1 3 3-1 9-9"/>'),
  ftRuler: s('<rect x="2.5" y="8" width="19" height="8" rx="1.5"/><path d="M6 8v3M9.5 8v4M13 8v3M16.5 8v4"/>'),
  ftOcr: s('<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M8 10h8M8 14h5"/>'),
  ftFamily: s('<circle cx="7" cy="7" r="3"/><circle cx="17" cy="7" r="3"/><circle cx="12" cy="17" r="3"/><path d="M9.5 9l1.5 5.5M14.5 9L13 14.5M10 7h4"/>'),
  ftOpenIn: s('<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
  ftUp: s('<path d="M12 19V5"/><path d="M6 11l6-6 6 6"/>'),
  ftFit: s('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  ftActual: s('<path d="M7 8v8M5.5 9.5L7 8M17 8v8M15.5 9.5L17 8"/><path d="M12 10v.01M12 14v.01"/>'),
  ftCompare: s('<rect x="3" y="5" width="8" height="14" rx="1.5"/><rect x="13" y="5" width="8" height="14" rx="1.5"/>'),
  ftSlides: s('<rect x="3" y="5" width="18" height="12" rx="1.5"/><path d="M10 9v5l4-2.5z"/><path d="M8 20h8"/>'),
  ftFullscreen: s('<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>'),
  ftPrev: s('<path d="M15 5l-7 7 7 7"/>'),
  ftNext: s('<path d="M9 5l7 7-7 7"/>'),
  ftStar: s('<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.6l1-5.8L3.5 9.7l5.9-.9z"/>'),
  ftStarFill: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.6l1-5.8L3.5 9.7l5.9-.9z"/></svg>',
  ftCrop: s('<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M2 6h14a2 2 0 0 1 2 2v14"/>'),
  ftScale: s('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 15l6-6"/><path d="M11 9h4v4"/>'),
  ftSave: s('<path d="M5 3h11l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M8 3v5h7"/><rect x="7" y="13" width="10" height="7" rx="1"/>'),
  ftPixel: s('<rect x="4" y="4" width="16" height="16" rx="1.5"/><path d="M4 10h16M4 16h16M10 4v16M16 4v16"/>'),
  ftLoop: s('<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>'),
  ftFrameNext: s('<path d="M6 5l9 7-9 7z"/><path d="M18 5v14"/>'),
  ftFramePrev: s('<path d="M18 5l-9 7 9 7z"/><path d="M6 5v14"/>'),
  ftCamera: s('<path d="M4 7h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="4"/>'),
  ftSubtitle: s('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 13h4M13 13h4M7 16h7"/>'),
  ftScissors: s('<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.5 8.5L20 20M8.5 15.5L20 4"/>'),
  ftPlay: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l12-7.5z"/></svg>',
  ftPause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4.5" width="4" height="15" rx="1"/><rect x="14" y="4.5" width="4" height="15" rx="1"/></svg>',
  ftVolume: s('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/>'),
  ftMute: s('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l5 6M22 9l-5 6"/>'),
  ftDrag: s('<path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01"/>'),
  ftPlus: s('<path d="M12 5v14M5 12h14"/>'),
  ftUndo: s('<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>'),
};

Object.assign(ICONS, FT_ICONS);

export const FT_ICON_NAMES = Object.keys(FT_ICONS);

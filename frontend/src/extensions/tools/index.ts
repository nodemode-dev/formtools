import { registerTool, type ToolDef } from '../registry';

const TOOLS: ToolDef[] = [
  { id: 'browser', name: 'Browser', group: 'view', icon: 'ftBrowse', summary: 'Folders and thumbnails, sorted and filtered, with a quick look on Space.', status: 'ready', command: 'go-browse' },
  { id: 'viewer', name: 'Image viewer', group: 'view', icon: 'ftViewer', summary: 'Fit, fill or 1:1, smooth zoom, compare, slideshow and full metadata.', status: 'ready', command: 'open-files' },
  { id: 'player', name: 'Player', group: 'media', icon: 'ftMedia', summary: 'Plays the video and audio your system can decode, with seeking.', status: 'ready', command: 'open-files' },
  { id: 'family-reader', name: 'Form projects', group: 'family', icon: 'ftFamily', summary: 'Preview formvis projects without formvis, then open them in their app.', status: 'ready', command: 'go-browse' },
  { id: 'family-more', name: 'More Form formats', group: 'family', icon: 'ftOpenIn', summary: 'formcut, formwav, formsculpt, formencoder and formlit files.', status: 'planned', phase: 'Phase 2b' },
  { id: 'convert', name: 'Batch convert', group: 'batch', icon: 'ftBatch', summary: 'An ordered action list with a live preview, presets and naming tokens.', status: 'planned', phase: 'Phase 3' },
  { id: 'resize', name: 'Resize', group: 'batch', icon: 'ftResize', summary: 'Fit, fill, longest side or megapixels, in one step.', status: 'planned', phase: 'Phase 3' },
  { id: 'rename', name: 'Rename', group: 'batch', icon: 'ftRename', summary: 'Regex, counters, dates and EXIF tokens with a live preview.', status: 'planned', phase: 'Phase 3' },
  { id: 'media-info', name: 'Media info', group: 'media', icon: 'ftAudio', summary: 'Streams, codecs, HDR metadata, chapters and subtitles.', status: 'planned', phase: 'Phase 4' },
  { id: 'model-viewer', name: '3D viewer', group: '3d', icon: 'ftCube', summary: 'glTF, OBJ, STL, FBX, USD and splats, inspected and measured.', status: 'planned', phase: 'Phase 5' },
  { id: 'quick-text', name: 'Text, code and data', group: 'files', icon: 'ftCode', summary: 'Code, Markdown, CSV, JSON, SQLite and hex.', status: 'planned', phase: 'Phase 6' },
  { id: 'archives', name: 'Archives', group: 'files', icon: 'ftArchive', summary: 'Browse, extract and create, with safe extraction.', status: 'planned', phase: 'Phase 6' },
  { id: 'fonts', name: 'Fonts', group: 'files', icon: 'ftFont', summary: 'Glyph grid, waterfall and metadata.', status: 'planned', phase: 'Phase 6' },
  { id: 'hash', name: 'Checksums', group: 'files', icon: 'ftHash', summary: 'SHA-256, BLAKE3, XXH64 and more, with verify.', status: 'planned', phase: 'Phase 6' },
  { id: 'duplicates', name: 'Duplicates', group: 'files', icon: 'ftDuplicate', summary: 'Exact and similar files, reviewed before anything moves.', status: 'planned', phase: 'Phase 7' },
  { id: 'disk-usage', name: 'Disk usage', group: 'files', icon: 'ftDisk', summary: 'Treemap of what takes the space.', status: 'planned', phase: 'Phase 7' },
  { id: 'color-picker', name: 'Colour picker', group: 'desktop', icon: 'ftPicker', summary: 'Pick any pixel on screen in HEX, RGB, HSL, OKLCH and more.', status: 'planned', phase: 'Phase 8' },
  { id: 'screen-ruler', name: 'Screen ruler', group: 'desktop', icon: 'ftRuler', summary: 'Measure bounds and spacing on screen.', status: 'planned', phase: 'Phase 8' },
  { id: 'text-extractor', name: 'Text extractor', group: 'desktop', icon: 'ftOcr', summary: 'Copy text from anything on screen, recognised locally.', status: 'planned', phase: 'Phase 8' },
];

for (const t of TOOLS) registerTool(t);

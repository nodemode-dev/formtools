import { registerTool, type ToolDef } from '../registry';

const TOOLS: ToolDef[] = [
  { id: 'browser', name: 'Browser', group: 'view', icon: 'ftBrowse', summary: 'Folders and thumbnails, sorted and filtered, with a quick look on Space.', status: 'ready', command: 'go-browse' },
  { id: 'viewer', name: 'Image viewer', group: 'view', icon: 'ftViewer', summary: 'Fit, fill or 1:1, smooth zoom, compare, slideshow and full metadata.', status: 'ready', command: 'open-files' },
  { id: 'player', name: 'Player', group: 'media', icon: 'ftMedia', summary: 'Video and audio with speed, A-B loop, frame steps, subtitles, snapshots and lossless clips.', status: 'ready', command: 'open-files' },
  { id: 'family-reader', name: 'Form projects', group: 'family', icon: 'ftFamily', summary: 'Preview formvis projects without formvis, then open them in their app.', status: 'ready', command: 'go-browse' },
  { id: 'family-more', name: 'More Form formats', group: 'family', icon: 'ftOpenIn', summary: 'formcut, formwav, formsculpt, formencoder and formlit files.', status: 'planned', phase: 'Phase 2b' },
  { id: 'convert', name: 'Batch convert', group: 'batch', icon: 'ftBatch', summary: 'An ordered action list with a live preview, presets and naming tokens.', status: 'ready', command: 'tool-convert' },
  { id: 'resize', name: 'Resize', group: 'batch', icon: 'ftResize', summary: 'Fit, fill, longest side or megapixels, in one step.', status: 'ready', command: 'tool-resize' },
  { id: 'rename', name: 'Rename', group: 'batch', icon: 'ftRename', summary: 'Regex, counters, dates and EXIF tokens with a live preview.', status: 'ready', command: 'tool-rename' },
  { id: 'media-info', name: 'Media info', group: 'media', icon: 'ftAudio', summary: 'Streams, codecs, HDR metadata, chapters and subtitles in the viewer\'s information panel.', status: 'ready', command: 'go-browse' },
  { id: 'model-viewer', name: '3D viewer', group: '3d', icon: 'ftCube', summary: 'glTF, OBJ, STL, PLY, FBX, 3MF, DAE and USDZ, inspected, measured and converted.', status: 'ready', command: 'open-files' },
  { id: 'quick-text', name: 'Text, code and data', group: 'files', icon: 'ftCode', summary: 'Code, Markdown, CSV, JSON, SQLite, PDF and hex.', status: 'ready', command: 'open-files' },
  { id: 'archives', name: 'Archives', group: 'files', icon: 'ftArchive', summary: 'Browse, preview and extract, with safe extraction.', status: 'ready', command: 'open-files' },
  { id: 'fonts', name: 'Fonts', group: 'files', icon: 'ftFont', summary: 'Glyph grid, waterfall, variable axes and metadata.', status: 'ready', command: 'open-files' },
  { id: 'hash', name: 'Checksums', group: 'files', icon: 'ftHash', summary: 'SHA-256, BLAKE3, XXH64 and more, with compare and verify.', status: 'ready', command: 'util-hash' },
  { id: 'duplicates', name: 'Duplicates', group: 'files', icon: 'ftDuplicate', summary: 'Exact and similar files, reviewed before anything moves.', status: 'ready', command: 'util-dupes' },
  { id: 'disk-usage', name: 'Disk usage', group: 'files', icon: 'ftDisk', summary: 'Treemap of what takes the space.', status: 'ready', command: 'util-disk' },
  { id: 'cleanup', name: 'Clean up', group: 'files', icon: 'ftSweep', summary: 'Empty folders and broken pictures or media, sent to the trash.', status: 'ready', command: 'util-cleanup' },
  { id: 'templates', name: 'New from template', group: 'files', icon: 'ftTemplate', summary: 'Starter files and project folders from your own templates folder.', status: 'ready', command: 'util-templates' },
  { id: 'locks', name: 'Who has this open', group: 'files', icon: 'ftLocked', summary: 'The programs holding a file that will not delete or move.', status: 'ready', command: 'util-locks' },
  { id: 'color-picker', name: 'Colour picker', group: 'desktop', icon: 'ftPicker', summary: 'Pick any pixel on screen in HEX, RGB, HSL, OKLCH and more.', status: 'planned', phase: 'Phase 8' },
  { id: 'screen-ruler', name: 'Screen ruler', group: 'desktop', icon: 'ftRuler', summary: 'Measure bounds and spacing on screen.', status: 'planned', phase: 'Phase 8' },
  { id: 'text-extractor', name: 'Text extractor', group: 'desktop', icon: 'ftOcr', summary: 'Copy text from anything on screen, recognised locally.', status: 'planned', phase: 'Phase 8' },
];

for (const t of TOOLS) registerTool(t);

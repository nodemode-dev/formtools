import type { Entry, FileType } from '../../io/api';

export type DropType = FileType | 'folder';

export interface Suggestion {
  id: string;
  command: string;
  label: string;
  hint: string;
  icon: string;
  group: DropType | 'any';
  types: DropType[];
  count: number;
  paths: string[];
  primary: boolean;
}

interface Rule {
  command: string;
  label: string;
  hint: string;
  icon: string;
  on: DropType[] | 'any';
}

export const TYPE_LABELS: Record<DropType, [string, string]> = {
  image: ['picture', 'pictures'],
  video: ['video', 'videos'],
  audio: ['audio file', 'audio files'],
  model: ['3D model', '3D models'],
  text: ['text or data file', 'text or data files'],
  archive: ['archive', 'archives'],
  font: ['font', 'fonts'],
  pdf: ['PDF', 'PDFs'],
  family: ['Form project', 'Form projects'],
  other: ['other file', 'other files'],
  folder: ['folder', 'folders'],
};

export const RULES: Rule[] = [
  { command: 'browse', label: 'Browse', hint: 'Look through the folder with thumbnails', icon: 'ftBrowse', on: ['folder'] },
  { command: 'util-disk', label: 'Disk usage', hint: 'See what takes the space', icon: 'ftDisk', on: ['folder'] },
  { command: 'util-dupes', label: 'Duplicates', hint: 'Find identical files and similar pictures', icon: 'ftDuplicate', on: ['folder'] },
  { command: 'util-cleanup', label: 'Clean up', hint: 'Find empty folders and broken files', icon: 'ftSweep', on: ['folder'] },
  { command: 'tool-rename', label: 'Rename', hint: 'Rename with rules and a live preview', icon: 'ftRename', on: ['folder'] },

  { command: 'view', label: 'View', hint: 'Open in the viewer', icon: 'ftViewer', on: ['image'] },
  { command: 'view-info', label: 'All metadata', hint: 'Open in the viewer with the information panel', icon: 'info', on: ['image'] },
  { command: 'tool-convert', label: 'Batch convert', hint: 'Change format with an action list', icon: 'ftBatch', on: ['image'] },
  { command: 'tool-resize', label: 'Resize', hint: 'Fit, fill or set megapixels', icon: 'ftResize', on: ['image'] },
  { command: 'tool-rename', label: 'Rename', hint: 'Rename with rules and a live preview', icon: 'ftRename', on: ['image'] },
  { command: 'util-dupes', label: 'Duplicates', hint: 'Find identical or similar pictures', icon: 'ftDuplicate', on: ['image'] },

  { command: 'view', label: 'Play', hint: 'Open in the player', icon: 'play', on: ['video', 'audio'] },
  { command: 'view-info', label: 'Media info', hint: 'Streams, codecs and chapters', icon: 'info', on: ['video', 'audio'] },
  { command: 'view', label: 'Lossless clip', hint: 'Mark A and B in the player, save without re-encoding', icon: 'ftMedia', on: ['video', 'audio'] },

  { command: 'view', label: 'View', hint: 'Open in the 3D viewer', icon: 'ftCube', on: ['model'] },
  { command: 'view', label: 'Convert', hint: 'Convert to another 3D format in the viewer', icon: 'ftBatch', on: ['model'] },

  { command: 'view', label: 'Browse', hint: 'Look inside the archive', icon: 'ftArchive', on: ['archive'] },
  { command: 'view', label: 'Extract', hint: 'Extract all or selected items safely', icon: 'ftOpenIn', on: ['archive'] },

  { command: 'view', label: 'View', hint: 'Glyph grid, waterfall and metadata', icon: 'ftFont', on: ['font'] },
  { command: 'view', label: 'Install', hint: 'Install for this user from the font viewer', icon: 'ftOpenIn', on: ['font'] },

  { command: 'view', label: 'View', hint: 'Open in the viewer', icon: 'ftCode', on: ['text', 'pdf', 'other'] },
  { command: 'view', label: 'View project', hint: 'Preview the Form project', icon: 'ftFamily', on: ['family'] },

  { command: 'util-hash', label: 'Checksums', hint: 'SHA-256, BLAKE3 and more', icon: 'ftHash', on: 'any' },
  { command: 'open-in', label: 'Open in its app', hint: 'Hand to the app that makes it', icon: 'ftOpenIn', on: 'any' },
  { command: 'reveal', label: 'Show in folder', hint: 'Show in the file manager', icon: 'folderOpen', on: 'any' },
];

const EXT: Record<string, DropType> = {};
const add = (type: DropType, list: string): void => { for (const x of list.split(' ')) EXT[x] = type; };
add('image', 'jpg jpeg jpe png webp avif tif tiff gif bmp heic heif svg ico jxl psd exr hdr cr2 cr3 nef arw dng orf rw2 raf pef srw');
add('video', 'mp4 mov mkv webm avi m4v wmv flv mpg mpeg 3gp mxf');
add('audio', 'mp3 wav flac aac m4a ogg opus wma aiff aif');
add('model', 'glb gltf obj stl ply fbx 3mf dae usdz');
add('archive', 'zip 7z rar tar gz tgz bz2 xz zst');
add('font', 'ttf otf woff woff2 ttc');
add('pdf', 'pdf');
add('text', 'txt md json csv tsv xml yaml yml html css js ts log sql sqlite db ini toml');
add('family', 'fvd');

export function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 && i < name.length - 1 ? name.slice(i + 1).toLowerCase() : '';
}

export function typeOfName(name: string): FileType {
  const t = EXT[extOf(name)];
  return t && t !== 'folder' ? t : 'other';
}

export function dropTypeOf(e: Entry): DropType {
  return e.kind === 'dir' ? 'folder' : e.type;
}

const folderOf = (e: Entry): string => e.kind === 'dir' || !e.path ? e.path : e.path.replace(/[^\\/]+[\\/]*$/, '') || e.path;

export function countTypes(entries: Entry[]): Array<[DropType, number]> {
  const counts = new Map<DropType, number>();
  for (const e of entries) {
    const t = dropTypeOf(e);
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

export function suggestTools(entries: Entry[]): Suggestion[] {
  const out: Suggestion[] = [];
  const seen = new Set<string>();
  for (const r of RULES) {
    const hit = entries.filter((e) => r.on === 'any' || r.on.includes(dropTypeOf(e)));
    if (!hit.length) continue;
    const group: DropType | 'any' = r.on === 'any' ? 'any' : (r.on.find((t) => hit.some((e) => dropTypeOf(e) === t)) ?? 'any');
    const id = `${group}:${r.command}:${r.label}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const paths = r.command === 'util-dupes' ? [...new Set(hit.map(folderOf))] : hit.map((e) => e.path);
    out.push({ id, command: r.command, label: r.label, hint: r.hint, icon: r.icon, group, types: [...new Set(hit.map(dropTypeOf))], count: hit.length, paths: paths.filter(Boolean), primary: false });
  }
  const first = out.find((s) => s.group !== 'any');
  if (first) first.primary = true;
  return out;
}

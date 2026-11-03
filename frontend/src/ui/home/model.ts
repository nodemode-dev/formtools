import { GROUPS, toolsIn, type ToolDef, type ToolGroup } from '../../extensions/registry';
import { inDesktop } from '../../io/host';

export interface TileInfo { def: ToolDef; off: boolean; badge: string }
export interface GroupInfo { id: ToolGroup; label: string; icon: string; tiles: TileInfo[] }

export const GROUP_ICONS: Record<ToolGroup, string> = {
  view: 'ftViewer',
  family: 'ftFamily',
  batch: 'ftBatch',
  media: 'ftMedia',
  '3d': 'ftCube',
  files: 'ftArchive',
  desktop: 'ftPicker',
};

export const COLUMNS: ToolGroup[][] = [['view', 'family', '3d'], ['batch', 'media'], ['files'], ['desktop']];

export function groupInfos(): GroupInfo[] {
  const desktop = inDesktop();
  return GROUPS.map((g) => ({
    id: g.id,
    label: g.label,
    icon: GROUP_ICONS[g.id],
    tiles: toolsIn(g.id).map((def) => {
      const off = def.status === 'planned' || (!!def.needs && !desktop);
      return { def, off, badge: def.status === 'planned' ? (def.phase ?? 'Planned') : off ? 'Desktop app' : '' };
    }),
  })).filter((g) => g.tiles.length > 0);
}

export function toolAttrs(t: TileInfo): string {
  const needs = t.def.needs ? ` data-needs="${t.def.needs}"` : '';
  return t.def.command && !t.off ? `${needs} data-cmd="${t.def.command}"` : `${needs} aria-disabled="true"`;
}

export function applyTips(root: ParentNode, keyOf: (command: string) => string): void {
  for (const node of root.querySelectorAll<HTMLElement>('[data-tip]')) {
    const key = node.dataset.cmd ? keyOf(node.dataset.cmd) : '';
    const title = key ? `${node.dataset.tip} (${key})` : (node.dataset.tip ?? '');
    if (node.title !== title && !node.classList.contains('ft-nav-toggle')) node.title = title;
    const chip = node.querySelector<HTMLElement>('.ft-key');
    if (chip && chip.textContent !== key) chip.textContent = key;
  }
}

export function readStore(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

export function writeStore(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { return; }
}

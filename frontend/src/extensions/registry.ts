export type ToolGroup = 'view' | 'batch' | 'media' | '3d' | 'files' | 'desktop' | 'family';

export interface ToolDef {
  id: string;
  name: string;
  group: ToolGroup;
  icon: string;
  summary: string;
  status: 'ready' | 'planned';
  phase?: string;
  command?: string;
}

export const GROUPS: Array<{ id: ToolGroup; label: string }> = [
  { id: 'view', label: 'View' },
  { id: 'family', label: 'Form family' },
  { id: 'batch', label: 'Batch images' },
  { id: 'media', label: 'Media' },
  { id: '3d', label: '3D' },
  { id: 'files', label: 'Files' },
  { id: 'desktop', label: 'Desktop' },
];

const tools = new Map<string, ToolDef>();

export function registerTool(def: ToolDef): void { tools.set(def.id, def); }

export function allTools(): ToolDef[] { return [...tools.values()]; }

export function toolsIn(group: ToolGroup): ToolDef[] { return allTools().filter((t) => t.group === group); }

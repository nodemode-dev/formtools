export type RenderMode = 'lit' | 'wireframe' | 'normals' | 'matcap';
export type ViewName = 'front' | 'right' | 'top' | 'iso';
export type NodeKind = 'mesh' | 'group' | 'light' | 'camera' | 'bone' | 'points' | 'line' | 'other';

export interface NodeRow {
  id: string;
  parent: string | null;
  name: string;
  kind: NodeKind;
  depth: number;
  visible: boolean;
  children: number;
  triangles: number;
}

export interface TextureRow { slot: string; name: string; width: number; height: number }

export interface MaterialRow {
  id: string;
  name: string;
  type: string;
  color: string;
  uses: number;
  textures: TextureRow[];
}

export interface SceneDump { nodes: NodeRow[]; materials: MaterialRow[]; truncated: boolean }

export interface StatsData {
  triangles: number;
  vertices: number;
  meshes: number;
  calls: number;
  textures: number;
  geometries: number;
}

export interface ClipRow { name: string; duration: number }

export interface Measurement {
  a: [number, number, number] | null;
  b: [number, number, number] | null;
  distance: number;
}

export interface PlaybackState { playing: boolean; time: number; duration: number }

export interface StageHooks {
  stats: (s: StatsData) => void;
  measure: (m: Measurement | null) => void;
  playback: (p: PlaybackState) => void;
  selected: (id: string | null) => void;
}

export interface Loaded {
  object: import('three').Object3D;
  clips: import('three').AnimationClip[];
}

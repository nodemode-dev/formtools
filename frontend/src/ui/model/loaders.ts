import { BufferGeometry, Color, LoadingManager, Mesh, MeshStandardMaterial, Object3D, Points, PointsMaterial } from 'three';
import { ApiError } from '../../io/api';
import { fetchBytes, fetchText, modelApi } from '../../io/model-api';
import type { Loaded } from './types';

export const NATIVE = new Set(['glb', 'gltf', 'obj', 'stl', 'ply', 'fbx', '3mf', 'dae', 'usdz']);

const BASE = 'ftasset://m/';
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=';

function manager(path: string): LoadingManager {
  const m = new LoadingManager();
  m.setURLModifier((url) => {
    if (url.startsWith('data:') || url.startsWith('blob:')) return url;
    if (url.startsWith(BASE)) {
      let rel = url.slice(BASE.length);
      try { rel = decodeURIComponent(rel); } catch { rel = url.slice(BASE.length); }
      return modelApi.assetUrl(path, rel.replace(/\\/g, '/'));
    }
    return BLANK;
  });
  return m;
}

function prepare(object: Object3D): void {
  object.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const g = mesh.geometry as BufferGeometry;
    if (g && !g.getAttribute('normal') && g.getAttribute('position')) g.computeVertexNormals();
  });
}

const clay = (colors: boolean): MeshStandardMaterial => new MeshStandardMaterial({ color: new Color(0xb9bdc6), metalness: 0.05, roughness: 0.62, vertexColors: colors });

async function gltf(buffer: ArrayBuffer | string, path: string): Promise<Loaded> {
  const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([
    import('three/examples/jsm/loaders/GLTFLoader.js'),
    import('three/examples/jsm/libs/meshopt_decoder.module.js'),
  ]);
  const loader = new GLTFLoader(manager(path));
  loader.setMeshoptDecoder(MeshoptDecoder);
  const out = await loader.parseAsync(buffer, BASE);
  return { object: out.scene, clips: out.animations };
}

async function obj(text: string, path: string, signal: AbortSignal): Promise<Loaded> {
  const [{ OBJLoader }, { MTLLoader }] = await Promise.all([
    import('three/examples/jsm/loaders/OBJLoader.js'),
    import('three/examples/jsm/loaders/MTLLoader.js'),
  ]);
  const m = manager(path);
  const loader = new OBJLoader(m);
  const lib = /^\s*mtllib\s+(.+?)\s*$/m.exec(text);
  if (lib) {
    try {
      const name = lib[1].replace(/\\/g, '/');
      const mtl = new MTLLoader(m);
      mtl.setResourcePath(BASE);
      const creator = mtl.parse(await fetchText(modelApi.assetUrl(path, name), signal), BASE);
      creator.preload();
      loader.setMaterials(creator);
    } catch (e) {
      if (signal.aborted) throw e;
    }
  }
  return { object: loader.parse(text), clips: [] };
}

async function stl(buffer: ArrayBuffer): Promise<Loaded> {
  const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js');
  const g = new STLLoader().parse(buffer);
  return { object: new Mesh(g, clay(g.hasAttribute('color'))), clips: [] };
}

async function ply(buffer: ArrayBuffer): Promise<Loaded> {
  const { PLYLoader } = await import('three/examples/jsm/loaders/PLYLoader.js');
  const g = new PLYLoader().parse(buffer);
  const colors = g.hasAttribute('color');
  if (g.index) return { object: new Mesh(g, clay(colors)), clips: [] };
  g.computeBoundingSphere();
  const r = g.boundingSphere?.radius ?? 1;
  return { object: new Points(g, new PointsMaterial({ size: Math.max(r / 400, 1e-6), sizeAttenuation: true, vertexColors: colors, color: colors ? 0xffffff : 0xb9bdc6 })), clips: [] };
}

async function fbx(buffer: ArrayBuffer, path: string): Promise<Loaded> {
  const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
  const g = new FBXLoader(manager(path)).parse(buffer, BASE);
  return { object: g, clips: g.animations };
}

async function threeMf(buffer: ArrayBuffer, path: string): Promise<Loaded> {
  const { ThreeMFLoader } = await import('three/examples/jsm/loaders/3MFLoader.js');
  return { object: new ThreeMFLoader(manager(path)).parse(buffer), clips: [] };
}

async function dae(text: string, path: string): Promise<Loaded> {
  const { ColladaLoader } = await import('three/examples/jsm/loaders/ColladaLoader.js');
  const out = new ColladaLoader(manager(path)).parse(text, BASE);
  if (!out) throw new Error('The Collada file could not be read.');
  return { object: out.scene, clips: out.scene.animations };
}

async function usdz(buffer: ArrayBuffer, path: string): Promise<Loaded> {
  const { USDLoader } = await import('three/examples/jsm/loaders/USDLoader.js');
  return { object: new USDLoader(manager(path)).parse(buffer), clips: [] };
}

async function native(ext: string, path: string, stamp: number, signal: AbortSignal): Promise<Loaded> {
  const url = modelApi.rawUrl(path, stamp);
  switch (ext) {
    case 'glb': return gltf(await fetchBytes(url, signal), path);
    case 'gltf': return gltf(await fetchText(url, signal), path);
    case 'obj': return obj(await fetchText(url, signal), path, signal);
    case 'stl': return stl(await fetchBytes(url, signal));
    case 'ply': return ply(await fetchBytes(url, signal));
    case 'fbx': return fbx(await fetchBytes(url, signal), path);
    case '3mf': return threeMf(await fetchBytes(url, signal), path);
    case 'dae': return dae(await fetchText(url, signal), path);
    case 'usdz': return usdz(await fetchBytes(url, signal), path);
    default: throw new Error('This format is read by the engine.');
  }
}

export async function loadModel(ext: string, path: string, stamp: number, signal: AbortSignal): Promise<Loaded> {
  let first: unknown = null;
  if (NATIVE.has(ext)) {
    try {
      const out = await native(ext, path, stamp, signal);
      prepare(out.object);
      return out;
    } catch (e) {
      if (signal.aborted) throw e;
      first = e;
    }
  }
  try {
    const out = await gltf(await fetchBytes(modelApi.viewUrl(path, stamp), signal), path);
    prepare(out.object);
    return out;
  } catch (e) {
    if (signal.aborted) throw e;
    const err = e instanceof ApiError ? e : first ?? e;
    throw err instanceof Error ? err : new Error('The model could not be read.');
  }
}

export function zUpByDefault(ext: string): boolean {
  return ext === 'stl' || ext === '3mf';
}

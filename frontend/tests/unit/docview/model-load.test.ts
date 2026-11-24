import { describe, it, expect, vi } from 'vitest';
import { Box3, BufferGeometry, Mesh, Vector3 } from 'three';
import { loadModel } from '../../../src/ui/model/loaders';

function serve(routes: Record<string, Uint8Array | string>): void {
  vi.stubGlobal('fetch', async (input: unknown): Promise<Response> => {
    const url = String(input);
    for (const [prefix, body] of Object.entries(routes)) {
      if (url.startsWith(prefix)) return new Response(typeof body === 'string' ? new TextEncoder().encode(body) : body, { status: 200 });
    }
    return new Response(JSON.stringify({ ok: false, error: 'The engine cannot convert this.' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
  });
}

function binaryStl(tris: number[][][]): Uint8Array {
  const buf = new ArrayBuffer(84 + 50 * tris.length);
  const dv = new DataView(buf);
  dv.setUint32(80, tris.length, true);
  tris.forEach((t, i) => {
    const o = 84 + 50 * i;
    t.forEach((p, k) => p.forEach((c, j) => dv.setFloat32(o + 12 + k * 12 + j * 4, c, true)));
  });
  return new Uint8Array(buf);
}

const box = (o: import('three').Object3D): Box3 => new Box3().setFromObject(o);
const arr = (v: Vector3): number[] => v.toArray().map((x) => Math.round(x * 1e6) / 1e6);
const signal = (): AbortSignal => new AbortController().signal;

const CUBE_OBJ = [
  'v -1 -2 -3', 'v 1 -2 -3', 'v 1 2 -3', 'v -1 2 -3', 'v -1 -2 3', 'v 1 -2 3', 'v 1 2 3', 'v -1 2 3',
  'f 1 2 3 4', 'f 5 6 7 8', 'f 1 2 6 5', 'f 2 3 7 6', 'f 3 4 8 7', 'f 4 1 5 8',
].join('\n');

describe('model loading and bounds', () => {
  it('reads an ASCII STL triangle and bounds it by its three corners', async () => {
    serve({ '/api/file/raw?': 'solid t\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 2 0 0\nvertex 0 3 0\nendloop\nendfacet\nendsolid t\n' });
    const out = await loadModel('stl', '/w/t.stl', 0, signal());
    const b = box(out.object);
    expect(arr(b.min)).toEqual([0, 0, 0]);
    expect(arr(b.max)).toEqual([2, 3, 0]);
  });
  it('reads a binary STL written by hand and bounds both triangles together', async () => {
    serve({ '/api/file/raw?': binaryStl([[[0, 0, 0], [1, 0, 0], [0, 1, 0]], [[-4, 5, 6], [7, -8, 9], [0, 0, -10]]]) });
    const out = await loadModel('stl', '/w/t.stl', 0, signal());
    const b = box(out.object);
    expect(arr(b.min)).toEqual([-4, -8, -10]);
    expect(arr(b.max)).toEqual([7, 5, 9]);
    const g = (out.object as Mesh).geometry as BufferGeometry;
    expect(g.getAttribute('position').count).toBe(6);
  });
  it('bounds an OBJ box by its extreme vertices and centres it on the origin', async () => {
    serve({ '/api/file/raw?': CUBE_OBJ });
    const out = await loadModel('obj', '/w/c.obj', 0, signal());
    const b = box(out.object);
    expect(arr(b.min)).toEqual([-1, -2, -3]);
    expect(arr(b.max)).toEqual([1, 2, 3]);
    expect(arr(b.getCenter(new Vector3()))).toEqual([0, 0, 0]);
    expect(arr(b.getSize(new Vector3()))).toEqual([2, 4, 6]);
  });
  it('gives a bounding sphere radius of half the box diagonal for a centred box', async () => {
    serve({ '/api/file/raw?': CUBE_OBJ });
    const out = await loadModel('obj', '/w/c.obj', 0, signal());
    let mesh: Mesh | null = null;
    out.object.traverse((o) => { if ((o as Mesh).isMesh) mesh = o as Mesh; });
    expect(mesh).not.toBeNull();
    const g = (mesh as unknown as Mesh).geometry;
    g.computeBoundingSphere();
    expect(g.boundingSphere?.radius).toBeCloseTo(Math.sqrt(1 + 4 + 9), 6);
  });
  it('adds face normals to a mesh that has none, pointing out of the counter-clockwise face', async () => {
    serve({ '/api/file/raw?': 'v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n' });
    const out = await loadModel('obj', '/w/t.obj', 0, signal());
    let mesh: Mesh | null = null;
    out.object.traverse((o) => { if ((o as Mesh).isMesh) mesh = o as Mesh; });
    const n = (mesh as unknown as Mesh).geometry.getAttribute('normal');
    expect(n).toBeDefined();
    for (let i = 0; i < n.count; i++) expect([n.getX(i), n.getY(i), n.getZ(i)].map((x) => Math.round(x))).toEqual([0, 0, 1]);
  });
  it('passes on the engine refusal when a format is neither native nor convertible', async () => {
    serve({});
    await expect(loadModel('xyz', '/w/a.xyz', 0, signal())).rejects.toThrow('The engine cannot convert this.');
  });
  it('stops at once when the load was cancelled', async () => {
    serve({ '/api/file/raw?': CUBE_OBJ });
    const c = new AbortController();
    c.abort();
    vi.stubGlobal('fetch', async (_u: unknown, init?: RequestInit): Promise<Response> => {
      if (init?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      return new Response(CUBE_OBJ);
    });
    await expect(loadModel('obj', '/w/c.obj', 0, c.signal)).rejects.toThrow();
  });
});

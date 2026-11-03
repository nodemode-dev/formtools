import type { UsageNode } from '../../io/util-api';

export interface Rect { x: number; y: number; w: number; h: number }

export interface Tile {
  node: UsageNode;
  depth: number;
  x: number; y: number; w: number; h: number;
  leaf: boolean;
  top: number;
  s0: number; s1: number; s2: number; s3: number;
}

export interface NestOptions { pad: number; minSide: number; ridge: number; falloff: number; maxTiles: number; band: number; labelW: number; labelH: number }

export const navigable = (n: UsageNode): boolean => !n.other && !!n.children?.length;

export function nest(root: UsageNode, box: Rect, opts: NestOptions): Tile[] {
  const tiles: Tile[] = [];
  if (box.w <= 0 || box.h <= 0 || root.size <= 0) return tiles;
  const make = (node: UsageNode, depth: number, r: Rect, parent: Tile | null, leaf: boolean, top: number): Tile => {
    const h = opts.ridge * Math.pow(opts.falloff, depth);
    const t: Tile = {
      node, depth, x: r.x, y: r.y, w: r.w, h: r.h, leaf, top,
      s0: parent ? parent.s0 : 0, s1: parent ? parent.s1 : 0, s2: parent ? parent.s2 : 0, s3: parent ? parent.s3 : 0,
    };
    const wf = (4 * h) / r.w;
    const hf = (4 * h) / r.h;
    t.s2 += wf * (2 * r.x + r.w);
    t.s0 -= wf;
    t.s3 += hf * (2 * r.y + r.h);
    t.s1 -= hf;
    tiles.push(t);
    return t;
  };
  const rootTile = make(root, 0, box, null, false, 0);
  rootTile.top = 0;
  const stack: Tile[] = [rootTile];
  while (stack.length) {
    const parent = stack.pop() as Tile;
    const kids = (parent.node.children ?? []).filter((c) => c.size > 0).sort((a, b) => b.size - a.size);
    if (!kids.length) { parent.leaf = true; continue; }
    const band = parent.depth === 1 && parent.w >= opts.labelW && parent.h >= opts.labelH ? opts.band : 0;
    const inner: Rect = parent.depth === 0
      ? { x: parent.x, y: parent.y, w: parent.w, h: parent.h }
      : { x: parent.x + opts.pad, y: parent.y + opts.pad + band, w: parent.w - opts.pad * 2, h: parent.h - opts.pad * 2 - band };
    if (inner.w <= 0 || inner.h <= 0) { parent.leaf = true; continue; }
    const rects = squarify(kids.map((c) => c.size), inner);
    const pending: Tile[] = [];
    for (let i = 0; i < kids.length; i += 1) {
      const r = rects[i];
      if (!r || r.w < 1 || r.h < 1) continue;
      const kid = kids[i];
      const dir = navigable(kid);
      const split = dir && r.w >= opts.minSide * 2 && r.h >= opts.minSide * 2 && tiles.length < opts.maxTiles;
      const top = parent.depth === 0 ? tiles.length : parent.top;
      const tile = make(kid, parent.depth + 1, r, parent, !split, top);
      if (split) pending.push(tile);
    }
    for (let i = pending.length - 1; i >= 0; i -= 1) stack.push(pending[i]);
  }
  return tiles;
}

function worst(row: number[], side: number): number {
  let sum = 0, max = 0, min = Infinity;
  for (const v of row) { sum += v; if (v > max) max = v; if (v < min) min = v; }
  const s2 = side * side, sum2 = sum * sum;
  return Math.max((s2 * max) / sum2, sum2 / (s2 * min));
}

export function squarify(values: number[], box: Rect): Rect[] {
  const out: Rect[] = new Array(values.length);
  const total = values.reduce((s, v) => s + v, 0);
  if (!values.length || total <= 0 || box.w <= 0 || box.h <= 0) return values.map(() => ({ x: box.x, y: box.y, w: 0, h: 0 }));
  const scale = (box.w * box.h) / total;
  const areas = values.map((v) => v * scale);
  let free: Rect = { ...box };
  let i = 0;
  while (i < areas.length) {
    const side = Math.min(free.w, free.h);
    if (side <= 0) { for (; i < areas.length; i += 1) out[i] = { x: free.x, y: free.y, w: 0, h: 0 }; break; }
    const row: number[] = [areas[i]];
    let j = i + 1;
    while (j < areas.length && areas[j] > 0) {
      const next = [...row, areas[j]];
      if (worst(next, side) > worst(row, side)) break;
      row.push(areas[j]);
      j += 1;
    }
    const sum = row.reduce((s, v) => s + v, 0);
    if (sum <= 0) { for (; i < areas.length; i += 1) out[i] = { x: free.x, y: free.y, w: 0, h: 0 }; break; }
    const horizontal = free.w >= free.h;
    const thick = sum / side;
    let offset = 0;
    for (let k = 0; k < row.length; k += 1) {
      const len = row[k] / thick;
      out[i + k] = horizontal
        ? { x: free.x, y: free.y + offset, w: thick, h: len }
        : { x: free.x + offset, y: free.y, w: len, h: thick };
      offset += len;
    }
    free = horizontal
      ? { x: free.x + thick, y: free.y, w: free.w - thick, h: free.h }
      : { x: free.x, y: free.y + thick, w: free.w, h: free.h - thick };
    i = j;
  }
  return out;
}

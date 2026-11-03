export interface Rect { x: number; y: number; w: number; h: number }

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

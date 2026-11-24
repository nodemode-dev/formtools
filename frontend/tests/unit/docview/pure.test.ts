import { describe, it, expect } from 'vitest';
import { Group, Mesh, BoxGeometry, MeshBasicMaterial } from 'three';
import { fmtBytes, fmtInt, baseName, dirName, Seq, errText } from '../../../src/ui/docview/common';
import { splitHighlighted, ensureLanguage } from '../../../src/ui/docview/highlight';
import { docKindOf, docHandles } from '../../../src/ui/docview/index';
import { VirtualList } from '../../../src/ui/docview/vlist';
import { VGrid } from '../../../src/ui/docview/grid';
import { BLOCKS } from '../../../src/ui/docview/blocks';
import { zUpByDefault, NATIVE } from '../../../src/ui/model/loaders';
import { disposeTree } from '../../../src/ui/model/engine';
import { entry } from './helpers';

describe('byte and number formatting', () => {
  it('shows sizes under 1024 as whole bytes', () => {
    expect(fmtBytes(0)).toBe('0 B');
    expect(fmtBytes(1023)).toBe('1023 B');
  });
  it('shows 1024 bytes as 1.0 KB and 1536 as 1.5 KB', () => {
    expect(fmtBytes(1024)).toBe('1.0 KB');
    expect(fmtBytes(1536)).toBe('1.5 KB');
  });
  it('shows 2 to the 20 bytes as 1.0 MB and 2 to the 30 as 1.0 GB', () => {
    expect(fmtBytes(2 ** 20)).toBe('1.0 MB');
    expect(fmtBytes(2 ** 30)).toBe('1.0 GB');
  });
  it('drops the decimal from 100 units upward', () => {
    expect(fmtBytes(100 * 2 ** 20)).toBe('100 MB');
  });
  it('shows nothing for a negative or non-finite size', () => {
    expect(fmtBytes(-1)).toBe('');
    expect(fmtBytes(Number.NaN)).toBe('');
  });
  it('groups thousands with commas whatever the machine locale', () => {
    expect(fmtInt(1234567)).toBe('1,234,567');
    expect(fmtInt(999)).toBe('999');
  });
});

describe('path helpers', () => {
  it('takes the last segment as the base name for both slash kinds', () => {
    expect(baseName('/a/b/c.txt')).toBe('c.txt');
    expect(baseName('C:\\x\\y.bin')).toBe('y.bin');
  });
  it('takes the parent folder as the directory name', () => {
    expect(dirName('/a/b/c.txt')).toBe('/a/b');
    expect(dirName('C:\\x\\y.bin')).toBe('C:\\x');
  });
  it('gives the root for a file directly under the root', () => {
    expect(dirName('/c.txt')).toBe('/');
  });
  it('uses the message of an Error and a plain sentence for anything else', () => {
    expect(errText(new Error('Disk gone.'))).toBe('Disk gone.');
    expect(errText(42)).toBe('Something went wrong.');
  });
  it('a sequence token is current only until the next one is taken', () => {
    const s = new Seq();
    const a = s.next();
    expect(s.is(a)).toBe(true);
    const b = s.next();
    expect(s.is(a)).toBe(false);
    expect(s.is(b)).toBe(true);
    s.bump();
    expect(s.is(b)).toBe(false);
  });
});

describe('highlight line splitting', () => {
  const strip = (h: string): string => h.replace(/<[^>]+>/g, '');
  it('closes and reopens a span that crosses a line break', () => {
    expect(splitHighlighted('<span class="a">x\ny</span>z')).toEqual(['<span class="a">x</span>', '<span class="a">y</span>z']);
  });
  it('keeps the visible text of every line the same as splitting the plain text', () => {
    const html = 'a<span class="k">b\n<span class="s">c\nd</span>e</span>\nf';
    expect(splitHighlighted(html).map(strip)).toEqual(strip(html).split('\n'));
  });
  it('leaves every produced line with balanced span tags', () => {
    for (const line of splitHighlighted('<span class="k">1\n<span class="s">2\n3</span>\n4</span>5')) {
      expect((line.match(/<span/g) ?? []).length).toBe((line.match(/<\/span>/g) ?? []).length);
    }
  });
  it('resolves short language names to their full name and refuses unknown ones', async () => {
    expect(await ensureLanguage('py')).toBe('python');
    expect(await ensureLanguage('HTML')).toBe('xml');
    expect(await ensureLanguage('klingon')).toBeNull();
    expect(await ensureLanguage(null)).toBeNull();
  });
});

describe('which viewer opens a file', () => {
  it('opens md as markdown, csv and tsv as a table, json and jsonl as data', () => {
    expect(docKindOf(entry('/a/readme.md', 'text'))).toBe('markdown');
    expect(docKindOf(entry('/a/t.csv', 'text'))).toBe('csv');
    expect(docKindOf(entry('/a/t.tsv', 'text'))).toBe('csv');
    expect(docKindOf(entry('/a/d.json', 'text'))).toBe('json');
    expect(docKindOf(entry('/a/d.jsonl', 'text'))).toBe('json');
  });
  it('opens a database file as sqlite, plain text as text and unknown bytes as hex', () => {
    expect(docKindOf(entry('/a/x.sqlite', 'other'))).toBe('sqlite');
    expect(docKindOf(entry('/a/x.log', 'text'))).toBe('text');
    expect(docKindOf(entry('/a/x.bin', 'other'))).toBe('hex');
  });
  it('lets the pdf, font and archive types win over the extension', () => {
    expect(docKindOf(entry('/a/x.json', 'pdf'))).toBe('pdf');
    expect(docKindOf(entry('/a/x.md', 'font'))).toBe('font');
    expect(docKindOf(entry('/a/x.csv', 'archive'))).toBe('archive');
  });
  it('does not handle folders or unknown binary files', () => {
    expect(docHandles({ ...entry('/a/dir.md', 'text'), kind: 'dir' })).toBe(false);
    expect(docHandles(entry('/a/x.bin', 'other'))).toBe(false);
    expect(docHandles(entry('/a/x.csv', 'other'))).toBe(true);
  });
});

describe('virtual list paging maths', () => {
  const make = (rowH: number): { sc: HTMLElement; list: VirtualList; filled: number[] } => {
    const sc = document.createElement('div');
    const filled: number[] = [];
    const list = new VirtualList(sc, rowH, () => document.createElement('div'), (n, i) => { filled.push(i); n.textContent = `row ${i}`; });
    return { sc, list, filled };
  };
  it('makes the body as tall as the row count times the row height', () => {
    const { list } = make(10);
    list.setCount(1000);
    expect(list.body.style.height).toBe('10000px');
    expect(list.total).toBe(1000);
  });
  it('caps the body at eight million pixels for huge lists', () => {
    const { list } = make(10);
    list.setCount(1_000_000);
    expect(list.body.style.height).toBe('8000000px');
  });
  it('scrolls to row times row height and reports that row as first visible', () => {
    const { sc, list } = make(10);
    list.setCount(1000);
    list.scrollToIndex(37);
    expect(sc.scrollTop).toBe(370);
    expect(list.firstVisible()).toBe(37);
  });
  it('clamps a scroll target to the last row and to zero', () => {
    const { sc, list } = make(10);
    list.setCount(50);
    list.scrollToIndex(999);
    expect(sc.scrollTop).toBe(490);
    list.scrollToIndex(-5);
    expect(sc.scrollTop).toBe(0);
  });
  it('never builds more row nodes than there are rows', () => {
    const { list } = make(10);
    list.setCount(2);
    expect(list.body.children.length).toBe(2);
    list.setCount(0);
    expect(list.body.children.length).toBe(0);
  });
  it('fills rows starting at index zero with their own index', () => {
    const { list } = make(10);
    list.setCount(3);
    expect(Array.from(list.body.children).map((c) => c.textContent)).toEqual(['row 0', 'row 1', 'row 2']);
  });
});

describe('grid', () => {
  it('shows a one-based row number, the cell text, and NULL for a null cell', () => {
    const g = new VGrid();
    const data: Array<Array<string | null>> = [['a', null], ['b', 'c']];
    g.cell = (r, c) => data[r][c];
    g.setColumns([{ label: 'L', width: 80 }, { label: 'R', width: 90, right: true }]);
    g.setCount(2);
    const rows = Array.from(g.root.querySelectorAll('.dv-grid-row')).map((r) => Array.from(r.children).map((c) => c.textContent));
    expect(rows).toEqual([['1', 'a', 'NULL'], ['2', 'b', 'c']]);
    expect(g.root.querySelectorAll('.is-null').length).toBe(1);
  });
  it('labels the header and sums the column widths plus the 56px gutter', () => {
    const g = new VGrid();
    g.setColumns([{ label: 'L', width: 80 }, { label: 'R', width: 90 }]);
    expect(Array.from(g.root.querySelectorAll('.dv-gh-label')).map((n) => n.textContent)).toEqual(['L', 'R']);
    expect(g.root.style.getPropertyValue('--w')).toBe('226px');
  });
  it('reports the clicked header column to the sort handler', () => {
    const g = new VGrid();
    g.setColumns([{ label: 'L', width: 80 }, { label: 'R', width: 90 }]);
    const got: number[] = [];
    g.onSort = (c) => got.push(c);
    (g.root.querySelectorAll('.dv-gh-label')[1] as HTMLElement).click();
    expect(got).toEqual([1]);
  });
});

describe('unicode block table', () => {
  it('has ordered, non-overlapping ranges', () => {
    for (let i = 0; i < BLOCKS.length; i++) {
      expect(BLOCKS[i][1]).toBeLessThanOrEqual(BLOCKS[i][2]);
      if (i > 0) expect(BLOCKS[i][1]).toBeGreaterThan(BLOCKS[i - 1][2]);
    }
  });
  it('puts the letter A in Basic Latin and the Greek alpha in Greek and Coptic', () => {
    const of = (cp: number): string | undefined => BLOCKS.find((b) => cp >= b[1] && cp <= b[2])?.[0];
    expect(of(0x41)).toBe('Basic Latin');
    expect(of(0x3b1)).toBe('Greek and Coptic');
    expect(of(0x416)).toBe('Cyrillic');
  });
});

describe('3D model helpers', () => {
  it('treats STL and 3MF as Z-up and glTF as Y-up, as those formats define', () => {
    expect(zUpByDefault('stl')).toBe(true);
    expect(zUpByDefault('3mf')).toBe(true);
    expect(zUpByDefault('glb')).toBe(false);
    expect(zUpByDefault('obj')).toBe(false);
  });
  it('lists the natively loaded model formats', () => {
    for (const e of ['glb', 'gltf', 'obj', 'stl', 'ply', 'fbx']) expect(NATIVE.has(e)).toBe(true);
    expect(NATIVE.has('txt')).toBe(false);
  });
  it('disposes every geometry and material in a tree', () => {
    const g = new Group();
    const inner = new Group();
    const m1 = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
    const m2 = new Mesh(new BoxGeometry(2, 2, 2), [new MeshBasicMaterial(), new MeshBasicMaterial()]);
    g.add(m1, inner);
    inner.add(m2);
    let n = 0;
    m1.geometry.addEventListener('dispose', () => { n++; });
    m2.geometry.addEventListener('dispose', () => { n++; });
    (m1.material as MeshBasicMaterial).addEventListener('dispose', () => { n++; });
    for (const m of m2.material as MeshBasicMaterial[]) m.addEventListener('dispose', () => { n++; });
    disposeTree(g);
    expect(n).toBe(5);
  });
});

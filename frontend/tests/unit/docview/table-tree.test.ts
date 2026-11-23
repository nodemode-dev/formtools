import { describe, it, expect } from 'vitest';
import { CsvView } from '../../../src/ui/docview/csv';
import { JsonView } from '../../../src/ui/docview/json';
import { deps, entry, settle, stubEngine, textDoc, txt } from './helpers';

interface Csv { delimiter?: string; header: string[] | null; rows: string[][]; total_rows?: number; truncated?: boolean }

async function openCsv(c: Csv): Promise<CsvView> {
  stubEngine({ csv: { delimiter: c.delimiter ?? ',', header: c.header, rows: c.rows, total_rows: c.total_rows ?? c.rows.length, truncated: c.truncated ?? false } });
  const v = new CsvView(deps());
  document.body.appendChild(v.root);
  await v.open(entry('/w/t.csv', 'text'));
  await settle();
  return v;
}

const labels = (root: HTMLElement): string[] => Array.from(root.querySelectorAll('.dv-gh-label')).map((n) => n.textContent ?? '');
const rows = (root: HTMLElement): string[][] => Array.from(root.querySelectorAll('.dv-grid-row')).map((r) => Array.from(r.children).slice(1).map((c) => c.textContent ?? ''));
const col = (root: HTMLElement, c: number): string[] => rows(root).map((r) => r[c]);
const sortBy = (root: HTMLElement, c: number): void => { (root.querySelectorAll('.dv-gh-label')[c] as HTMLElement).click(); };

function filter(v: CsvView, s: string): void {
  const f = v.root.querySelector<HTMLInputElement>('.dv-find');
  if (!f) throw new Error('no filter');
  f.value = s;
  f.dispatchEvent(new Event('input'));
}

const PEOPLE: Csv = { header: ['name', 'age'], rows: [['Ann', '10'], ['Bob', '9'], ['Cy', '100']] };

describe('table viewer for CSV', () => {
  it('uses the header row as column labels and shows the data rows in file order', async () => {
    const v = await openCsv(PEOPLE);
    expect(labels(v.root)).toEqual(['name', 'age']);
    expect(rows(v.root)).toEqual([['Ann', '10'], ['Bob', '9'], ['Cy', '100']]);
  });
  it('describes the delimiter, row count and column count', async () => {
    const v = await openCsv(PEOPLE);
    expect(txt(v.root, '.dv-info')).toBe('Comma-separated \u00b7 3 rows \u00b7 2 columns');
  });
  it('names a tab-separated file as such', async () => {
    const v = await openCsv({ ...PEOPLE, delimiter: '\t' });
    expect(txt(v.root, '.dv-info')).toMatch(/^Tab-separated/);
  });
  it('sorts a numeric column by value, not as text, then descending, then back to file order', async () => {
    const v = await openCsv(PEOPLE);
    sortBy(v.root, 1);
    expect(col(v.root, 1)).toEqual(['9', '10', '100']);
    sortBy(v.root, 1);
    expect(col(v.root, 1)).toEqual(['100', '10', '9']);
    sortBy(v.root, 1);
    expect(col(v.root, 1)).toEqual(['10', '9', '100']);
  });
  it('sorts a text column alphabetically ignoring case', async () => {
    const v = await openCsv({ header: ['w'], rows: [['pear'], ['Apple'], ['banana']] });
    sortBy(v.root, 0);
    expect(col(v.root, 0)).toEqual(['Apple', 'banana', 'pear']);
  });
  it('puts empty cells last when sorting', async () => {
    const v = await openCsv({ header: ['n'], rows: [['3'], [''], ['1']] });
    sortBy(v.root, 0);
    expect(col(v.root, 0)).toEqual(['1', '3', '']);
  });
  it('keeps only rows containing the filter text, ignoring case, and counts them', async () => {
    const v = await openCsv(PEOPLE);
    filter(v, 'BO');
    expect(rows(v.root)).toEqual([['Bob', '9']]);
    expect(txt(v.root, '.dv-count')).toBe('1 of 3 rows');
  });
  it('turns the header back into a data row when the header toggle is switched off', async () => {
    const v = await openCsv(PEOPLE);
    v.root.querySelector<HTMLElement>('[data-c="header"]')?.click();
    expect(labels(v.root)).toEqual(['A', 'B']);
    expect(rows(v.root)[0]).toEqual(['name', 'age']);
    expect(rows(v.root).length).toBe(4);
  });
  it('labels columns A, B, ... Z, AA, AB like a spreadsheet when there is no header', async () => {
    const wide = Array.from({ length: 28 }, (_, i) => String(i));
    const v = await openCsv({ header: null, rows: [wide] });
    const l = labels(v.root);
    expect(l[0]).toBe('A');
    expect(l[25]).toBe('Z');
    expect(l[26]).toBe('AA');
    expect(l[27]).toBe('AB');
    expect(v.root.querySelector<HTMLButtonElement>('[data-c="header"]')?.disabled).toBe(true);
  });
  it('says how many of the total rows are shown for a truncated file', async () => {
    const v = await openCsv({ ...PEOPLE, total_rows: 5000, truncated: true });
    expect(txt(v.root, '.dv-note')).toBe('Showing the first 3 of 5,000 rows.');
  });
});

async function openJson(text: string, name = '/w/d.json'): Promise<JsonView> {
  stubEngine({ text: textDoc(text, 'json') });
  const v = new JsonView(deps());
  document.body.appendChild(v.root);
  await v.open(entry(name, 'text'));
  await settle();
  return v;
}

const tree = (v: JsonView): HTMLElement => v.root.querySelector<HTMLElement>('.dv-jtree') as HTMLElement;
const kids = (n: Element): HTMLElement[] => Array.from(n.querySelectorAll<HTMLElement>(':scope > .dv-jkids > .dv-jn'));
const rowText = (n: Element): string => Array.from(n.querySelector(':scope > .dv-jrow')?.querySelectorAll('.dv-jk,.dv-jc,.dv-jv') ?? []).map((s) => s.textContent).join('');
const top = (v: JsonView): HTMLElement => tree(v).firstElementChild as HTMLElement;
const pathOf = (v: JsonView, n: Element): string => {
  (n.querySelector(':scope > .dv-jrow .dv-jv') as HTMLElement).click();
  return v.root.querySelector<HTMLInputElement>('.dv-path')?.value ?? '';
};

describe('JSON tree viewer', () => {
  it('summarises the top level and shows each key with a typed value preview', async () => {
    const v = await openJson('{"a": 1, "s": "hi", "n": null, "t": true, "o": {"x": 1, "y": 2}, "l": [1]}');
    expect(rowText(top(v))).toBe('{ 6 keys }');
    expect(kids(top(v)).map(rowText)).toEqual(['a:1', 's:"hi"', 'n:null', 't:true', 'o:{ 2 keys }', 'l:[ 1 item ]']);
    expect(txt(v.root, '.dv-info')).toBe('6 keys at the top level');
  });
  it('opens a nested object when its caret is clicked and closes it again', async () => {
    const v = await openJson('{"o": {"x": 1}}');
    const o = kids(top(v))[0];
    (o.querySelector('.dv-jcaret') as HTMLElement).click();
    expect(o.classList.contains('is-open')).toBe(true);
    expect(kids(o).map(rowText)).toEqual(['x:1']);
    (o.querySelector('.dv-jcaret') as HTMLElement).click();
    expect(o.classList.contains('is-open')).toBe(false);
  });
  it('shows the selected node path in dot, bracket and quoted-key form', async () => {
    const v = await openJson('{"list": [10, 20], "a b": 1}');
    const [list, spaced] = kids(top(v));
    expect(pathOf(v, list)).toBe('$.list');
    expect(pathOf(v, spaced)).toBe('$["a b"]');
    (list.querySelector('.dv-jcaret') as HTMLElement).click();
    expect(pathOf(v, kids(list)[1])).toBe('$.list[1]');
  });
  it('pages a long array one hundred children at a time', async () => {
    const v = await openJson(JSON.stringify(Array.from({ length: 250 }, (_, i) => i)));
    const r = top(v);
    expect(kids(r).length).toBe(100);
    expect(r.querySelector('.dv-jmore')?.textContent).toBe('Show 100 more of 150 left');
    (r.querySelector('.dv-jmore') as HTMLElement).click();
    expect(kids(r).length).toBe(200);
    expect(rowText(kids(r)[199])).toBe('199:199');
    (r.querySelector('.dv-jmore') as HTMLElement).click();
    expect(kids(r).length).toBe(250);
    expect(r.querySelector('.dv-jmore')).toBeNull();
  });
  it('reads a JSON Lines file as one array item per non-empty line', async () => {
    const v = await openJson('{"a":1}\n\n{"a":2}\n', '/w/d.jsonl');
    expect(txt(v.root, '.dv-info')).toBe('2 items at the top level');
    expect(kids(top(v)).map(rowText)).toEqual(['0:{ 1 key }', '1:{ 1 key }']);
  });
  it('names the broken line of a JSON Lines file', async () => {
    const v = await openJson('{"a":1}\n{oops\n', '/w/d.jsonl');
    expect(txt(v.root, '.dv-note')).toMatch(/^Line 2: /);
    expect(tree(v).children.length).toBe(0);
  });
  it('falls back to the text view with the parse error for invalid JSON', async () => {
    const v = await openJson('{"a": }');
    expect(txt(v.root, '.dv-note')).not.toBe('');
    expect(v.root.querySelector<HTMLButtonElement>('[data-j="tree"]')?.disabled).toBe(true);
    expect((v.root.querySelector('.dv-jscroll') as HTMLElement).hidden).toBe(true);
    expect(Array.from(v.root.querySelectorAll('.dv-ln')).map((n) => n.textContent)).toEqual(['{"a": }']);
  });
  it('describes a bare scalar document as a single value', async () => {
    const v = await openJson('42');
    expect(txt(v.root, '.dv-info')).toBe('A single value');
    expect(rowText(top(v))).toBe('42');
  });
  it('gives empty containers no caret', async () => {
    const v = await openJson('{"e": [], "f": {}}');
    expect(kids(top(v)).map(rowText)).toEqual(['e:[ ]', 'f:{ }']);
    for (const k of kids(top(v))) expect(k.querySelector('.dv-jcaret')?.innerHTML).toBe('');
  });
  it('shows a key holding markup as plain text', async () => {
    const v = await openJson('{"<img src=x>": "<script>1</script>"}');
    expect(tree(v).querySelector('img')).toBeNull();
    expect(tree(v).querySelector('script')).toBeNull();
    expect(rowText(kids(top(v))[0])).toBe('<img src=x>:"<script>1</script>"');
  });
});

import { describe, it, expect } from 'vitest';
import { TextView } from '../../../src/ui/docview/text';
import { deps, entry, settle, stubEngine, textDoc, txt } from './helpers';

async function openText(text: string, language: string | null = null, extra: Record<string, unknown> = {}): Promise<TextView> {
  stubEngine({ text: textDoc(text, language, extra) });
  const v = new TextView(deps());
  document.body.appendChild(v.root);
  await v.open(entry('/w/notes.txt', 'text'));
  await settle();
  return v;
}

const lineTexts = (v: TextView): string[] => Array.from(v.root.querySelectorAll<HTMLElement>('.dv-ln')).map((n) => n.textContent ?? '');
const lineNums = (v: TextView): string[] => Array.from(v.root.querySelectorAll<HTMLElement>('.dv-ln')).map((n) => n.dataset.n ?? '');

function find(v: TextView, needle: string): void {
  const box = v.root.querySelector<HTMLInputElement>('.dv-find');
  if (!box) throw new Error('no find box');
  box.value = needle;
  box.dispatchEvent(new Event('input'));
}

const press = (v: TextView, t: string): void => { v.root.querySelector<HTMLElement>(`[data-t="${t}"]`)?.click(); };

describe('text viewer', () => {
  it('shows every line of the file in its own row numbered from one', async () => {
    const v = await openText('alpha\nbeta\ngamma');
    expect(lineTexts(v)).toEqual(['alpha', 'beta', 'gamma']);
    expect(lineNums(v)).toEqual(['1', '2', '3']);
  });
  it('does not show an extra empty row for a final newline', async () => {
    const v = await openText('one\ntwo\n');
    expect(lineTexts(v)).toEqual(['one', 'two']);
  });
  it('splits Windows and old Mac line endings into separate rows', async () => {
    const v = await openText('a\r\nb\rc', null, { eol: 'mixed' });
    expect(lineTexts(v)).toEqual(['a', 'b', 'c']);
  });
  it('states encoding, line ending and line count in the info line', async () => {
    const v = await openText('x\ny\nz');
    expect(txt(v.root, '.dv-info')).toBe('utf-8 \u00b7 LF \u00b7 3 lines');
    expect(txt(v.root, '.dv-note')).toBe('No highlighting for this file type.');
  });
  it('mentions a byte order mark and CRLF endings', async () => {
    const v = await openText('x\r\ny', null, { bom: true, eol: 'crlf', lines: 2 });
    expect(txt(v.root, '.dv-info')).toBe('utf-8 with BOM \u00b7 CRLF \u00b7 2 lines');
  });
  it('shows markup inside a plain text file as literal characters', async () => {
    const v = await openText('<b>bold</b><img src=x onerror="window.__ftx=1">');
    expect(v.root.querySelector('.dv-code b')).toBeNull();
    expect(v.root.querySelector('.dv-code img')).toBeNull();
    expect(lineTexts(v)).toEqual(['<b>bold</b><img src=x onerror="window.__ftx=1">']);
    expect((window as unknown as { __ftx?: number }).__ftx).toBeUndefined();
  });
  it('keeps the visible text of a highlighted source file identical to the file', async () => {
    const src = 'def f(x):\n    return "a\\nb" + str(x)\n';
    const v = await openText(src, 'python');
    expect(lineTexts(v)).toEqual(['def f(x):', '    return "a\\nb" + str(x)']);
    expect(txt(v.root, '.dv-info')).toContain('python');
    expect(v.root.querySelector('.dv-ln span')).not.toBeNull();
  });
  it('says when only the first part of a long file is shown', async () => {
    const v = await openText('abcd', null, { truncated: true });
    expect(txt(v.root, '.dv-note')).toContain('Showing the first 4 B of the file.');
  });
  it('shows the engine refusal message when the file cannot be read', async () => {
    stubEngine({});
    const v = new TextView(deps());
    await v.open(entry('/w/gone.txt', 'text'));
    expect(txt(v.root, '.dv-note')).toBe('No such thing here.');
    expect(v.root.querySelectorAll('.dv-ln').length).toBe(0);
  });
});

describe('text search', () => {
  it('counts every occurrence ignoring case, including several on one line', async () => {
    const v = await openText('Banana\nplan\nnothing');
    find(v, 'an');
    expect(txt(v.root, '.dv-count')).toBe('1 of 3');
  });
  it('marks the line that holds the current match', async () => {
    const v = await openText('zero\nhere is the needle\nmore');
    find(v, 'needle');
    const hit = v.root.querySelector<HTMLElement>('.dv-ln.is-hit');
    expect(hit?.dataset.n).toBe('2');
  });
  it('steps to the next match and wraps from the last back to the first', async () => {
    const v = await openText('ab\nab\nab');
    find(v, 'b');
    press(v, 'next');
    expect(txt(v.root, '.dv-count')).toBe('2 of 3');
    press(v, 'next');
    press(v, 'next');
    expect(txt(v.root, '.dv-count')).toBe('1 of 3');
  });
  it('steps back from the first match to the last one', async () => {
    const v = await openText('x1\nx2\nx3\nx4');
    find(v, 'x');
    press(v, 'prev');
    expect(txt(v.root, '.dv-count')).toBe('4 of 4');
    expect(v.root.querySelector<HTMLElement>('.dv-ln.is-hit')?.dataset.n).toBe('4');
  });
  it('finds only exact-case matches once match case is on', async () => {
    const v = await openText('Aa\naA\na');
    find(v, 'A');
    expect(txt(v.root, '.dv-count')).toBe('1 of 5');
    press(v, 'case');
    expect(txt(v.root, '.dv-count')).toBe('1 of 2');
  });
  it('says no matches for text that is not in the file and clears when emptied', async () => {
    const v = await openText('hello world');
    find(v, 'zebra');
    expect(txt(v.root, '.dv-count')).toBe('No matches');
    find(v, '');
    expect(txt(v.root, '.dv-count')).toBe('');
  });
  it('does not count overlapping occurrences twice', async () => {
    const v = await openText('aaaa');
    find(v, 'aa');
    expect(txt(v.root, '.dv-count')).toBe('1 of 2');
  });
});

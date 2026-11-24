import { describe, it, expect } from 'vitest';
import { HexView } from '../../../src/ui/docview/hex';
import { MarkdownView } from '../../../src/ui/docview/markdown';
import { deps, entry, settle, stubEngine, textDoc, txt } from './helpers';

function refHex(bytes: Uint8Array, off: number): { off: string; hex: string; asc: string } {
  const slice = Array.from(bytes.slice(off, off + 16));
  const cells = Array.from({ length: 16 }, (_, k) => (k < slice.length ? slice[k].toString(16).padStart(2, '0') : '  '));
  return {
    off: off.toString(16).toUpperCase().padStart(8, '0'),
    hex: cells.slice(0, 8).join(' ') + '  ' + cells.slice(8).join(' '),
    asc: slice.map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.')).join(''),
  };
}

async function openHex(bytes: Uint8Array): Promise<{ v: HexView; said: string[]; seen: string[] }> {
  const seen = stubEngine({ raw: bytes });
  const d = deps();
  const v = new HexView(d);
  document.body.appendChild(v.root);
  await v.open(entry('/w/blob.bin', 'other', bytes.length));
  await settle();
  return { v, said: d.said, seen };
}

const hexRows = (v: HexView): Array<{ off: string; hex: string; asc: string }> =>
  Array.from(v.root.querySelectorAll('.dv-hex-row')).map((r) => ({ off: r.children[0].textContent ?? '', hex: r.children[1].textContent ?? '', asc: r.children[2].textContent ?? '' }));

function goTo(v: HexView, s: string): void {
  const box = v.root.querySelector<HTMLInputElement>('.dv-goto');
  if (!box) throw new Error('no goto');
  box.value = s;
  v.root.querySelector<HTMLElement>('[data-h="go"]')?.click();
}

const BYTES = new Uint8Array([0x48, 0x69, 0x21, 0x0a, 0x00, 0x7f, 0x20, 0x7e, 0x80, 0xff, 0x41, 0x42, 0x43, 0x09, 0x0d, 0x31, 0xde, 0xad, 0xbe, 0xef]);

describe('hex viewer', () => {
  it('shows offsets, bytes and printable text that match the input for every row', async () => {
    const { v } = await openHex(BYTES);
    expect(hexRows(v)).toEqual([refHex(BYTES, 0), refHex(BYTES, 16)]);
  });
  it('writes the first row exactly in the classic 8 plus 8 layout', async () => {
    const { v } = await openHex(BYTES);
    expect(hexRows(v)[0]).toEqual({ off: '00000000', hex: '48 69 21 0a 00 7f 20 7e  80 ff 41 42 43 09 0d 31', asc: 'Hi!... ~..ABC..1' });
  });
  it('shows only the remaining bytes on a short last row', async () => {
    const { v } = await openHex(BYTES);
    const last = hexRows(v)[1];
    expect(last.off).toBe('00000010');
    expect(last.hex.trim()).toBe('de ad be ef');
    expect(last.asc).toBe('....');
  });
  it('fetches a small file in one single read', async () => {
    const { seen } = await openHex(BYTES);
    expect(seen.filter((u) => u.startsWith('/api/file/raw?')).length).toBe(1);
  });
  it('labels the header columns with the sixteen column offsets', async () => {
    const { v } = await openHex(BYTES);
    expect(txt(v.root, '.dv-hexhead .dv-hx-hex')).toBe('00 01 02 03 04 05 06 07  08 09 0a 0b 0c 0d 0e 0f');
  });
  it('reports the size in short and exact form', async () => {
    const { v } = await openHex(BYTES);
    expect(txt(v.root, '.dv-info')).toBe('20 B \u00b7 20 bytes');
  });
  it('gives one row per sixteen bytes, rounding up', async () => {
    const bytes = new Uint8Array(33).map((_, i) => i);
    const { v } = await openHex(bytes);
    expect(hexRows(v).map((r) => r.off)).toEqual(['00000000', '00000010', '00000020']);
    expect(hexRows(v)[2]).toEqual(refHex(bytes, 32));
  });
  it('says an empty file is empty and draws no rows', async () => {
    const { v } = await openHex(new Uint8Array(0));
    expect(txt(v.root, '.dv-note')).toBe('The file is empty.');
    expect(hexRows(v).length).toBe(0);
  });
  it('jumps to the row holding an offset given as 0x hex, h suffix or decimal', async () => {
    const bytes = new Uint8Array(160);
    const { v } = await openHex(bytes);
    const sc = v.root.querySelector('.dv-hexscroll') as HTMLElement;
    goTo(v, '0x20');
    expect(sc.scrollTop).toBe(2 * 20);
    goTo(v, '50h');
    expect(sc.scrollTop).toBe(5 * 20);
    goTo(v, '17');
    expect(sc.scrollTop).toBe(1 * 20);
  });
  it('refuses an offset past the end of the file or unreadable text', async () => {
    const { v, said } = await openHex(BYTES);
    goTo(v, '20');
    goTo(v, 'zz');
    expect(said).toEqual(['That offset is outside the file.', 'That offset is outside the file.']);
  });
});

async function openMd(text: string, path = '/docs/readme.md', extra: Record<string, unknown> = {}): Promise<MarkdownView> {
  stubEngine({ text: textDoc(text, 'markdown', extra) });
  const v = new MarkdownView(deps());
  document.body.appendChild(v.root);
  await v.open(entry(path, 'text'));
  await settle();
  return v;
}

const article = (v: MarkdownView): HTMLElement => v.root.querySelector('.dv-md') as HTMLElement;

describe('markdown viewer', () => {
  it('renders headings, emphasis and lists as elements', async () => {
    const v = await openMd('# Title\n\nSome *soft* text.\n\n- one\n- two\n');
    const a = article(v);
    expect(a.querySelector('h1')?.textContent).toBe('Title');
    expect(a.querySelector('em')?.textContent).toBe('soft');
    expect(Array.from(a.querySelectorAll('li')).map((n) => n.textContent)).toEqual(['one', 'two']);
  });
  it('never inserts or runs a script block written in the file', async () => {
    const v = await openMd('Hello\n\n<script>window.__ftmd = 1</script>\n');
    expect(article(v).querySelector('script')).toBeNull();
    expect(article(v).textContent).toContain('<script>window.__ftmd = 1</script>');
    expect((window as unknown as { __ftmd?: number }).__ftmd).toBeUndefined();
  });
  it('shows raw HTML tags with event handlers as text instead of live elements', async () => {
    const v = await openMd('<img src="x" onerror="window.__ftmd2=1"> <iframe src="/x"></iframe>');
    expect(article(v).querySelector('img')).toBeNull();
    expect(article(v).querySelector('iframe')).toBeNull();
    expect(article(v).querySelector('[onerror]')).toBeNull();
  });
  it('does not turn a javascript: link into a live link', async () => {
    const v = await openMd('[click](javascript:alert(1))');
    for (const a of Array.from(article(v).querySelectorAll('a'))) expect(a.getAttribute('href') ?? '').not.toMatch(/^javascript:/i);
  });
  it('loads a relative image from the folder of the markdown file', async () => {
    const v = await openMd('![pic](img/a.png) ![up](../up.png)');
    const imgs = Array.from(article(v).querySelectorAll('img'));
    expect(imgs.map((i) => i.getAttribute('src'))).toEqual([
      `/api/file/raw?path=${encodeURIComponent('/docs/img/a.png')}&v=0`,
      `/api/file/raw?path=${encodeURIComponent('/up.png')}&v=0`,
    ]);
    expect(imgs.map((i) => i.alt)).toEqual(['pic', 'up']);
  });
  it('shows the alt text instead of fetching a remote image', async () => {
    const v = await openMd('![remote logo](https://example.com/a.png)');
    expect(article(v).querySelector('img')).toBeNull();
    expect(txt(article(v), '.dv-md-noimg')).toBe('remote logo');
  });
  it('switches to the source lines and back with the mode buttons', async () => {
    const v = await openMd('# A\nb');
    const scroll = v.root.querySelector('.dv-md-scroll') as HTMLElement;
    v.root.querySelector<HTMLElement>('[data-m="source"]')?.click();
    expect(scroll.hidden).toBe(true);
    expect(Array.from(v.root.querySelectorAll('.dv-ln')).map((n) => n.textContent)).toEqual(['# A', 'b']);
    v.root.querySelector<HTMLElement>('[data-m="rendered"]')?.click();
    expect(scroll.hidden).toBe(false);
  });
  it('notes when only the first 2 MB of a long file is rendered', async () => {
    const v = await openMd('x', '/docs/readme.md', { truncated: true });
    expect(txt(v.root, '.dv-bar .dv-note')).toBe('The file is longer than the first 2 MB, which is what is shown.');
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActionDef, ActionParam } from '../../../src/io/api';
import { Jobs } from '../../../src/ui/jobs';
import { BatchTool } from '../../../src/ui/tools/batch';
import { fieldFor, readFields } from '../../../src/ui/tools/fields';
import { InputList } from '../../../src/ui/tools/inputs';
import { DEFAULT_OUTPUT, OutputPanel } from '../../../src/ui/tools/output';
import { ToolsPage } from '../../../src/ui/tools/page';
import { RenameTool } from '../../../src/ui/tools/rename';
import { ResizeTool } from '../../../src/ui/tools/resize';
import { click, job, press, refuse, settle, shownToast, stubEngine, toastRoot, type } from './support';

const DEFS: ActionDef[] = [
  { id: 'blur', group: 'Adjust', label: 'Blur', params: [{ key: 'radius', label: 'Radius', type: 'float', min: 0, max: 50, default: 2.5 }] },
  { id: 'border', group: 'Adjust', label: 'Border', params: [
    { key: 'width', label: 'Width', type: 'int', min: 1, default: 10 },
    { key: 'color', label: 'Colour', type: 'color', default: '#ff8800' },
    { key: 'inside', label: 'Inside', type: 'bool', default: false },
  ] },
  { id: 'watermark', group: 'Marks', label: 'Text watermark', params: [
    { key: 'text', label: 'Text', type: 'text', default: 'draft' },
    { key: 'corner', label: 'Corner', type: 'choice', default: 'se', options: [['nw', 'Top left'], ['se', 'Bottom right']] },
  ] },
];

const q = <T extends Element = HTMLElement>(root: ParentNode, sel: string): T => {
  const n = root.querySelector<T>(sel);
  if (!n) throw new Error(`missing ${sel}`);
  return n;
};

beforeEach(() => {
  vi.useFakeTimers();
  toastRoot();
});

afterEach(async () => {
  await vi.advanceTimersByTimeAsync(5000);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('action fields built from a parameter description', () => {
  it('a bool parameter becomes a checkbox that starts at its default and reads back as true or false', () => {
    const p: ActionParam = { key: 'inside', label: 'Inside', type: 'bool', default: true };
    const host = document.createElement('div');
    host.appendChild(fieldFor(p, undefined));
    const box = q<HTMLInputElement>(host, 'input');
    expect(box.type).toBe('checkbox');
    expect(box.checked).toBe(true);
    box.checked = false;
    expect(readFields(host)).toEqual({ inside: false });
  });

  it('a choice parameter lists every option by its label and selects the given value', () => {
    const p: ActionParam = { key: 'corner', label: 'Corner', type: 'choice', default: 'nw', options: [['nw', 'Top left'], ['se', 'Bottom right']] };
    const host = document.createElement('div');
    host.appendChild(fieldFor(p, 'se'));
    const sel = q<HTMLSelectElement>(host, 'select');
    expect(Array.from(sel.options).map((o) => o.textContent)).toEqual(['Top left', 'Bottom right']);
    expect(sel.value).toBe('se');
    expect(readFields(host)).toEqual({ corner: 'se' });
  });

  it('an int parameter carries its limits and reads back rounded to a whole number', () => {
    const p: ActionParam = { key: 'width', label: 'Width', type: 'int', min: 1, max: 99, default: 10 };
    const host = document.createElement('div');
    host.appendChild(fieldFor(p, undefined));
    const inp = q<HTMLInputElement>(host, 'input');
    expect([inp.type, inp.min, inp.max, inp.step, inp.value]).toEqual(['number', '1', '99', '1', '10']);
    inp.value = '12.6';
    expect(readFields(host)).toEqual({ width: 13 });
  });

  it('a float parameter keeps its fraction when read back', () => {
    const host = document.createElement('div');
    host.appendChild(fieldFor({ key: 'radius', label: 'Radius', type: 'float', default: 2.5 }, undefined));
    expect(q<HTMLInputElement>(host, 'input').step).toBe('0.01');
    q<HTMLInputElement>(host, 'input').value = '0.75';
    expect(readFields(host)).toEqual({ radius: 0.75 });
  });

  it('a label with markup characters is shown as text, not turned into elements', () => {
    const host = document.createElement('div');
    host.appendChild(fieldFor({ key: 't', label: '<b>Bold</b> & co', type: 'text', default: 'a "quoted" <i>' }, undefined));
    expect(q(host, '.ft-row-label').textContent).toBe('<b>Bold</b> & co');
    expect(host.querySelector('b')).toBeNull();
    expect(q<HTMLInputElement>(host, 'input').value).toBe('a "quoted" <i>');
  });

  it('a path parameter asks for a full path and a colour parameter falls back to black', () => {
    const host = document.createElement('div');
    host.appendChild(fieldFor({ key: 'p', label: 'File', type: 'path', default: '' }, undefined));
    host.appendChild(fieldFor({ key: 'c', label: 'Colour', type: 'color', default: '' }, undefined));
    expect(q<HTMLInputElement>(host, '[data-key="p"]').placeholder).toBe('Full path');
    expect(readFields(host)).toEqual({ p: '', c: '#000000' });
  });
});

describe('the file list of a tool', () => {
  it('starts empty with a hint and no count', () => {
    const list = new InputList(() => []);
    expect(q(list.root, '.ft-inputs-empty').hidden).toBe(false);
    expect(q(list.root, '.ft-panel-count').textContent).toBe('');
    expect(list.value).toEqual([]);
  });

  it('typing a path and pressing Enter adds one row named by the last path part and clears the box', () => {
    const list = new InputList(() => []);
    const box = q<HTMLInputElement>(list.root, '.ft-inputs-path');
    box.value = '  /photos/trip/a.jpg  ';
    const e = press(box, 'Enter');
    expect(e.defaultPrevented).toBe(true);
    expect(list.value).toEqual(['/photos/trip/a.jpg']);
    const rows = list.root.querySelectorAll<HTMLElement>('.ft-inputs-item');
    expect(rows.length).toBe(1);
    expect(q(rows[0], '.ft-inputs-name').textContent).toBe('a.jpg');
    expect(rows[0].title).toBe('/photos/trip/a.jpg');
    expect(box.value).toBe('');
    expect(q(list.root, '.ft-panel-count').textContent).toBe('1');
    expect(q(list.root, '.ft-inputs-empty').hidden).toBe(true);
  });

  it('the same path typed twice is listed once, and a blank entry adds nothing', () => {
    const list = new InputList(() => []);
    const box = q<HTMLInputElement>(list.root, '.ft-inputs-path');
    for (const v of ['/a/b.png', '/a/b.png', '   ']) { box.value = v; press(box, 'Enter'); }
    expect(list.value).toEqual(['/a/b.png']);
  });

  it('a folder path with a trailing separator and a Windows path are named by their last part', () => {
    const list = new InputList(() => []);
    list.set(['/photos/trip/', 'C:\\Pictures\\cat.png']);
    const names = Array.from(list.root.querySelectorAll('.ft-inputs-name')).map((n) => n.textContent);
    expect(names).toEqual(['trip', 'cat.png']);
  });

  it('the selection button replaces the list with what the browser has selected', () => {
    const list = new InputList(() => ['/x/1.jpg', '/x/2.jpg', '/x/1.jpg']);
    list.set(['/old.png']);
    click(q(list.root, '[data-in="selection"]'));
    expect(list.value).toEqual(['/x/1.jpg', '/x/2.jpg']);
    expect(q(list.root, '.ft-panel-count').textContent).toBe('2');
  });

  it('removing one row keeps the other rows as the same nodes in the document', () => {
    const list = new InputList(() => []);
    document.body.appendChild(list.root);
    list.set(['/a.png', '/b.png', '/c.png']);
    const before = Array.from(list.root.querySelectorAll('.ft-inputs-item'));
    click(q(before[1], '[data-remove]'));
    const after = Array.from(list.root.querySelectorAll('.ft-inputs-item'));
    expect(list.value).toEqual(['/a.png', '/c.png']);
    expect(after.length).toBe(2);
    expect(after[0]).toBe(before[0]);
    expect(after[1]).toBe(before[2]);
    expect(after[0].isConnected).toBe(true);
    list.root.remove();
  });

  it('clear empties the list, shows the hint again and tells listeners once', () => {
    const list = new InputList(() => []);
    list.set(['/a.png']);
    const heard = vi.fn();
    list.onChange(heard);
    click(q(list.root, '[data-in="clear"]'));
    expect(list.value).toEqual([]);
    expect(q(list.root, '.ft-inputs-empty').hidden).toBe(false);
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it('shows at most 500 rows but keeps every path and counts them all', () => {
    const list = new InputList(() => []);
    const many = Array.from({ length: 520 }, (_, i) => `/big/${i}.jpg`);
    list.set(many);
    expect(list.root.querySelectorAll('.ft-inputs-item').length).toBe(500);
    expect(list.value.length).toBe(520);
    expect(q(list.root, '.ft-panel-count').textContent).toBe('520');
  });

  it('the sub-folder switch is hidden when the tool does not walk folders and reports its state otherwise', () => {
    expect(q(new InputList(() => [], false).root, '.ft-inputs-rec').hidden).toBe(true);
    const list = new InputList(() => []);
    expect(q(list.root, '.ft-inputs-rec').hidden).toBe(false);
    expect(list.recursive).toBe(false);
    q<HTMLInputElement>(list.root, '.ft-inputs-recursive').checked = true;
    expect(list.recursive).toBe(true);
  });
});

describe('the output panel', () => {
  it('opens on the documented defaults: JPEG at quality 90 into a converted sub-folder, adding a number on clashes', () => {
    const o = new OutputPanel();
    expect(o.value).toEqual({ format: 'jpeg', quality: 90, folder: '', subfolder: 'converted', naming: '{name}', overwrite: 'rename', keep_metadata: true, keep_folders: false, keep_dates: false });
    expect(o.value).toEqual(DEFAULT_OUTPUT);
    expect(q(o.root, '.ft-o-quality output').textContent).toBe('90');
  });

  it('what is set is what is read back', () => {
    const o = new OutputPanel();
    const next = { format: 'webp', quality: 42, folder: '/out', subfolder: 'small', naming: '{name}_{n:3}', overwrite: 'skip', keep_metadata: false, keep_folders: true, keep_dates: true } as const;
    o.set({ ...next });
    expect(o.value).toEqual(next);
    expect(q(o.root, '.ft-o-quality output').textContent).toBe('42');
  });

  it('the quality row hides for formats without a quality setting and returns for those with one', () => {
    const o = new OutputPanel();
    const fmt = q<HTMLSelectElement>(o.root, '[data-o="format"]');
    const row = q(o.root, '.ft-o-quality');
    for (const [f, hidden] of [['png', true], ['tiff', true], ['bmp', true], ['gif', true], ['webp', false], ['avif', false], ['same', false], ['jpeg', false]] as const) {
      type(fmt, f);
      expect([f, row.hidden]).toEqual([f, hidden]);
    }
  });

  it('moving the quality slider updates the number beside it and tells listeners', () => {
    const o = new OutputPanel();
    const heard = vi.fn();
    o.onChange(heard);
    type(q<HTMLInputElement>(o.root, '[data-o="quality"]'), '55');
    expect(q(o.root, '.ft-o-quality output').textContent).toBe('55');
    expect(o.value.quality).toBe(55);
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it('an emptied file name falls back to the {name} token and folders are trimmed', () => {
    const o = new OutputPanel();
    q<HTMLInputElement>(o.root, '[data-o="naming"]').value = '   ';
    q<HTMLInputElement>(o.root, '[data-o="folder"]').value = '  /out dir  ';
    expect(o.value.naming).toBe('{name}');
    expect(o.value.folder).toBe('/out dir');
  });
});

describe('the resize tool', () => {
  const mount = (): { tool: ResizeTool; jobs: Jobs; done: ReturnType<typeof vi.fn> } => {
    const jobs = new Jobs();
    const done = vi.fn();
    const tool = new ResizeTool(() => [], jobs, done);
    document.body.appendChild(tool.root);
    return { tool, jobs, done };
  };

  it('opens on longest side 2048 px, keeping each file format, into a resized sub-folder', () => {
    const { tool } = mount();
    expect(q<HTMLSelectElement>(tool.root, '.ft-r-mode').value).toBe('longest');
    expect(q(tool.root, '.ft-r-one-label').textContent).toBe('Longest side');
    expect(q<HTMLInputElement>(tool.root, '.ft-r-value').value).toBe('2048');
    expect(q(tool.root, '.ft-r-unit').textContent).toBe('px');
    expect(q(tool.root, '.ft-r-one').hidden).toBe(false);
    expect(Array.from(tool.root.querySelectorAll<HTMLElement>('.ft-r-box')).map((n) => n.hidden)).toEqual([true, true]);
    expect(tool.output.value.format).toBe('same');
    expect(tool.output.value.subfolder).toBe('resized');
    tool.root.remove();
  });

  it('choosing percent or megapixels changes the unit shown, and a box mode swaps to width and height', () => {
    const { tool } = mount();
    const mode = q<HTMLSelectElement>(tool.root, '.ft-r-mode');
    type(mode, 'percent', 'change');
    expect(q(tool.root, '.ft-r-unit').textContent).toBe('%');
    type(mode, 'megapixels', 'change');
    expect(q(tool.root, '.ft-r-unit').textContent).toBe('MP');
    expect(q(tool.root, '.ft-r-one-label').textContent).toBe('Megapixels');
    type(mode, 'fill', 'change');
    expect(q(tool.root, '.ft-r-one').hidden).toBe(true);
    expect(Array.from(tool.root.querySelectorAll<HTMLElement>('.ft-r-box')).map((n) => n.hidden)).toEqual([false, false]);
    tool.root.remove();
  });

  it('the 4K preset fills in 3840 by 2160 and switches to fitting inside a box', () => {
    const { tool } = mount();
    const chip = Array.from(tool.root.querySelectorAll<HTMLElement>('.ft-chip')).find((c) => c.textContent?.startsWith('4K'));
    expect(chip?.textContent).toBe('4K 3840 x 2160');
    click(chip ?? null);
    expect(q<HTMLSelectElement>(tool.root, '.ft-r-mode').value).toBe('fit');
    expect(q<HTMLInputElement>(tool.root, '.ft-r-w').value).toBe('3840');
    expect(q<HTMLInputElement>(tool.root, '.ft-r-h').value).toBe('2160');
    expect(q(tool.root, '.ft-r-one').hidden).toBe(true);
    tool.root.remove();
  });

  it('pressing Resize with no files says to add files first and sends nothing', async () => {
    const calls = stubEngine({});
    const { tool } = mount();
    click(q(tool.root, '[data-r="run"]'));
    await settle();
    expect(calls).toEqual([]);
    expect(shownToast()).toEqual({ text: 'Add files or a folder first.', kind: 'error' });
    tool.root.remove();
  });

  it('pressing Resize sends the files, an auto-orient step, the chosen size and the output settings', async () => {
    const calls = stubEngine({ 'POST /api/batch/run': () => job({ state: 'done', done: 2, total: 2 }) });
    const { tool } = mount();
    tool.inputs.set(['/p/a.jpg', '/p/b.jpg']);
    type(q<HTMLSelectElement>(tool.root, '.ft-r-mode'), 'width', 'change');
    q<HTMLInputElement>(tool.root, '.ft-r-value').value = '800';
    q<HTMLInputElement>(tool.root, '.ft-r-up').checked = true;
    q<HTMLSelectElement>(tool.root, '.ft-r-resample').value = 'bicubic';
    q<HTMLInputElement>(tool.inputs.root, '.ft-inputs-recursive').checked = true;
    click(q(tool.root, '[data-r="run"]'));
    await settle();
    expect(calls.length).toBe(1);
    expect(calls[0].url).toBe('/api/batch/run');
    expect(calls[0].body).toEqual({
      inputs: ['/p/a.jpg', '/p/b.jpg'], recursive: true, extensions: [],
      actions: [{ id: 'auto-orient', params: {} }, { id: 'resize', params: { mode: 'width', width: 1920, height: 1080, value: 800, upscale: true, resample: 'bicubic' } }],
      output: { format: 'same', quality: 90, folder: '', subfolder: 'resized', naming: '{name}', overwrite: 'rename', keep_metadata: true, keep_folders: false, keep_dates: false },
    });
    tool.root.remove();
  });

  it('while the job runs the button is locked and progress reads done of total, then the count of files when finished', async () => {
    let n = 0;
    stubEngine({
      'POST /api/batch/run': () => job({ done: 1, total: 4 }),
      'GET /api/jobs/j1': () => (++n === 1 ? job({ done: 3, total: 4 }) : job({ state: 'done', done: 4, total: 4, errors: [{ path: '/p/x', error: 'bad' }] })),
    });
    const { tool, done } = mount();
    tool.inputs.set(['/p']);
    const btn = q<HTMLButtonElement>(tool.root, '[data-r="run"]');
    const state = q(tool.root, '.ft-run-state');
    click(btn);
    await settle();
    expect(btn.disabled).toBe(true);
    expect(state.textContent).toBe('1 of 4');
    await settle(400);
    expect(state.textContent).toBe('3 of 4');
    expect(done).not.toHaveBeenCalled();
    await settle(400);
    expect(state.textContent).toBe('Done: 4 files, 1 errors');
    expect(btn.disabled).toBe(false);
    expect(done).toHaveBeenCalledTimes(1);
    tool.root.remove();
  });

  it('a refusal from the engine is shown as its sentence and the button is usable again', async () => {
    stubEngine({ 'POST /api/batch/run': () => refuse(400, 'The folder /p cannot be read.') });
    const { tool } = mount();
    tool.inputs.set(['/p']);
    const btn = q<HTMLButtonElement>(tool.root, '[data-r="run"]');
    click(btn);
    await settle();
    expect(shownToast()).toEqual({ text: 'The folder /p cannot be read.', kind: 'error' });
    expect(btn.disabled).toBe(false);
    tool.root.remove();
  });
});

describe('the batch convert tool', () => {
  const routes = (extra: Record<string, Parameters<typeof stubEngine>[0][string]> = {}): Parameters<typeof stubEngine>[0] => ({
    'GET /api/batch/actions': () => ({ actions: DEFS }),
    'GET /api/batch/presets': () => ({ presets: [{ name: 'Web', actions: [{ id: 'border', params: { width: 4, color: '#112233', inside: true } }, { id: 'gone', params: {} }], output: { ...DEFAULT_OUTPUT, format: 'webp', quality: 70 } }] }),
    'GET /api/fs/list': () => refuse(400, 'not a folder'),
    'POST /api/batch/preview': () => refuse(400, 'No preview for this file.'),
    ...extra,
  });
  const mount = async (): Promise<BatchTool> => {
    const tool = new BatchTool(() => [], new Jobs(), vi.fn());
    document.body.appendChild(tool.root);
    await tool.start();
    return tool;
  };
  const add = (tool: BatchTool, id: string): void => type(q<HTMLSelectElement>(tool.root, '.ft-add-action'), id, 'change');

  it('lists the actions the engine describes, grouped under the engine group names', async () => {
    stubEngine(routes());
    const tool = await mount();
    const groups = Array.from(tool.root.querySelectorAll<HTMLOptGroupElement>('.ft-add-action optgroup'));
    expect(groups.map((g) => g.label)).toEqual(['Adjust', 'Marks']);
    expect(groups.map((g) => Array.from(g.querySelectorAll('option')).map((o) => `${o.value}:${o.textContent}`))).toEqual([['blur:Blur', 'border:Border'], ['watermark:Text watermark']]);
    expect(Array.from(q<HTMLSelectElement>(tool.root, '.ft-presets').options).map((o) => o.textContent)).toEqual(['Choose a preset...', 'Web']);
    tool.root.remove();
  });

  it('asks the engine for its action list only once however often the tool is opened', async () => {
    const calls = stubEngine(routes());
    const tool = await mount();
    await tool.start();
    expect(calls.filter((c) => c.url === '/api/batch/actions').length).toBe(1);
    tool.root.remove();
  });

  it('when the engine refuses the action list the refusal is shown as a sentence', async () => {
    stubEngine({ 'GET /api/batch/actions': () => refuse(503, 'The batch engine is still starting.') });
    const tool = await mount();
    expect(shownToast()).toEqual({ text: 'The batch engine is still starting.', kind: 'error' });
    expect(tool.root.querySelectorAll('.ft-add-action optgroup').length).toBe(0);
    tool.root.remove();
  });

  it('adding an action builds a card with one field per described parameter at its default', async () => {
    stubEngine(routes());
    const tool = await mount();
    expect(q(tool.root, '.ft-cards-empty').hidden).toBe(false);
    add(tool, 'border');
    const card = q(tool.root, '.ft-card');
    expect(q(card, '.ft-card-title').textContent).toBe('Border');
    expect(Array.from(card.querySelectorAll('.ft-row-label')).map((n) => n.textContent)).toEqual(['Width', 'Colour', 'Inside']);
    expect(q<HTMLInputElement>(card, '[data-key="width"]').value).toBe('10');
    expect(q<HTMLInputElement>(card, '[data-key="color"]').value).toBe('#ff8800');
    expect(q<HTMLInputElement>(card, '[data-key="inside"]').checked).toBe(false);
    expect(q(tool.root, '.ft-actions-count').textContent).toBe('1');
    expect(q(tool.root, '.ft-cards-empty').hidden).toBe(true);
    expect(q<HTMLSelectElement>(tool.root, '.ft-add-action').value).toBe('');
    tool.root.remove();
  });

  it('Convert with no files says to add files first and sends no run request', async () => {
    const calls = stubEngine(routes());
    const tool = await mount();
    click(q(tool.root, '[data-b="run"]'));
    await settle();
    expect(calls.some((c) => c.url === '/api/batch/run')).toBe(false);
    expect(shownToast()).toEqual({ text: 'Add files or a folder first.', kind: 'error' });
    tool.root.remove();
  });

  it('Convert sends the cards in their shown order with the values typed into them', async () => {
    const calls = stubEngine(routes({ 'POST /api/batch/run': () => job({ state: 'done', done: 1, total: 1 }) }));
    const tool = await mount();
    tool.inputs.set(['/p/a.png']);
    add(tool, 'blur');
    add(tool, 'watermark');
    const cards = tool.root.querySelectorAll<HTMLElement>('.ft-card');
    q<HTMLInputElement>(cards[0], '[data-key="radius"]').value = '7.25';
    q<HTMLInputElement>(cards[1], '[data-key="text"]').value = 'proof';
    q<HTMLSelectElement>(cards[1], '[data-key="corner"]').value = 'nw';
    click(q(cards[1], '[data-card="up"]'));
    expect(Array.from(tool.root.querySelectorAll('.ft-card-title')).map((n) => n.textContent)).toEqual(['Text watermark', 'Blur']);
    click(q(tool.root, '[data-b="run"]'));
    await settle();
    const run = calls.find((c) => c.url === '/api/batch/run');
    expect(run?.body).toEqual({
      inputs: ['/p/a.png'], recursive: false, extensions: [],
      actions: [{ id: 'watermark', params: { text: 'proof', corner: 'nw' } }, { id: 'blur', params: { radius: 7.25 } }],
      output: DEFAULT_OUTPUT,
    });
    expect(q(tool.root, '.ft-run-state').textContent).toBe('Done: 1 files');
    tool.root.remove();
  });

  it('reordering keeps each card as the same node, and removing a card drops only that one', async () => {
    stubEngine(routes());
    const tool = await mount();
    add(tool, 'blur');
    add(tool, 'border');
    const [first, second] = Array.from(tool.root.querySelectorAll<HTMLElement>('.ft-card'));
    click(q(first, '[data-card="down"]'));
    const now = Array.from(tool.root.querySelectorAll<HTMLElement>('.ft-card'));
    expect(now[0]).toBe(second);
    expect(now[1]).toBe(first);
    click(q(second, '[data-card="remove"]'));
    const left = Array.from(tool.root.querySelectorAll<HTMLElement>('.ft-card'));
    expect(left).toEqual([first]);
    expect(first.isConnected).toBe(true);
    expect(q(tool.root, '.ft-actions-count').textContent).toBe('1');
    tool.root.remove();
  });

  it('choosing a preset builds its known actions with the saved values and applies its output settings', async () => {
    stubEngine(routes());
    const tool = await mount();
    add(tool, 'blur');
    type(q<HTMLSelectElement>(tool.root, '.ft-presets'), 'Web', 'change');
    const cards = tool.root.querySelectorAll<HTMLElement>('.ft-card');
    expect(cards.length).toBe(1);
    expect(q(cards[0], '.ft-card-title').textContent).toBe('Border');
    expect(q<HTMLInputElement>(cards[0], '[data-key="width"]').value).toBe('4');
    expect(q<HTMLInputElement>(cards[0], '[data-key="color"]').value).toBe('#112233');
    expect(q<HTMLInputElement>(cards[0], '[data-key="inside"]').checked).toBe(true);
    expect(tool.output.value.format).toBe('webp');
    expect(tool.output.value.quality).toBe(70);
    tool.root.remove();
  });

  it('Check names shows each planned name with a summary of conflicts and skipped files', async () => {
    const calls = stubEngine(routes({
      'POST /api/batch/plan': () => ({
        items: [{ src: '/p/a.png', dst: '/p/converted/a.jpg', conflict: 'none' }, { src: '/p/b.png', dst: '/p/converted/a.jpg', conflict: 'duplicate' }],
        skipped: [{ path: '/p/notes.txt', reason: 'not a picture' }],
      }),
    }));
    const tool = await mount();
    tool.inputs.set(['/p']);
    expect(q(tool.root, '.ft-plan').hidden).toBe(true);
    click(q(tool.root, '[data-b="plan"]'));
    await settle();
    expect(calls.find((c) => c.url === '/api/batch/plan')?.body).toEqual({ inputs: ['/p'], recursive: false, extensions: [], output: DEFAULT_OUTPUT, actions: [] });
    expect(q(tool.root, '.ft-plan').hidden).toBe(false);
    expect(q(tool.root, '.ft-plan-count').textContent).toBe('2 files, 1 name conflicts, 1 skipped');
    const rows = Array.from(tool.root.querySelectorAll<HTMLElement>('.ft-plan-row'));
    expect(rows.map((r) => [q(r, '.ft-plan-src').textContent, q(r, '.ft-plan-dst').textContent, r.dataset.conflict])).toEqual([['a.png', '/p/converted/a.jpg', 'none'], ['b.png', '/p/converted/a.jpg', 'duplicate']]);
    tool.root.remove();
  });

  it('checking names again patches the same rows, and changing the files hides the stale plan', async () => {
    let dst = '/p/converted/a.jpg';
    stubEngine(routes({ 'POST /api/batch/plan': () => ({ items: [{ src: '/p/a.png', dst, conflict: 'none' }], skipped: [] }) }));
    const tool = await mount();
    tool.inputs.set(['/p']);
    click(q(tool.root, '[data-b="plan"]'));
    await settle();
    const row = q(tool.root, '.ft-plan-row');
    dst = '/p/converted/a.webp';
    click(q(tool.root, '[data-b="plan"]'));
    await settle();
    expect(q(tool.root, '.ft-plan-row')).toBe(row);
    expect(q(row, '.ft-plan-dst').textContent).toBe('/p/converted/a.webp');
    expect(q(tool.root, '.ft-plan-count').textContent).toBe('1 files');
    tool.inputs.set(['/p', '/q']);
    expect(q(tool.root, '.ft-plan').hidden).toBe(true);
    tool.root.remove();
  });

  it('with no files the preview box asks for files', async () => {
    stubEngine(routes());
    const tool = await mount();
    tool.inputs.set([]);
    await settle(400);
    expect(q(tool.root, '.ft-preview-msg').textContent).toBe('Add files to see a preview.');
    expect(q(tool.root, '.ft-preview-msg').hidden).toBe(false);
    expect(q(tool.root, '.ft-preview-img').hidden).toBe(true);
    tool.root.remove();
  });

  it('a preview refusal is shown in the preview box beside the file name', async () => {
    stubEngine(routes());
    const tool = await mount();
    tool.inputs.set(['/p/raw.xyz']);
    await settle(400);
    expect(q(tool.root, '.ft-preview-name').textContent).toBe('raw.xyz');
    expect(q(tool.root, '.ft-preview-msg').textContent).toBe('No preview for this file.');
    tool.root.remove();
  });
});

describe('the rename tool', () => {
  const plan = (items: Array<{ src: string; dst: string; conflict?: string; changed?: boolean }>): { items: unknown[] } => ({ items: items.map((i) => ({ conflict: 'none', changed: i.src !== i.dst, ...i })) });
  const mount = (): { tool: RenameTool; done: ReturnType<typeof vi.fn> } => {
    const done = vi.fn();
    const tool = new RenameTool(() => [], done);
    document.body.appendChild(tool.root);
    return { tool, done };
  };
  const add = (tool: RenameTool, id: string): void => type(q<HTMLSelectElement>(tool.root, '.ft-add-rule'), id, 'change');

  it('offers the eight rule kinds by name', () => {
    const { tool } = mount();
    expect(Array.from(q<HTMLSelectElement>(tool.root, '.ft-add-rule').options).map((o) => o.textContent)).toEqual([
      'Add a rule...', 'Find and replace', 'Change case', 'Insert text', 'Remove characters', 'Number', 'Date', 'Tidy spaces and separators', 'Extension']);
    tool.root.remove();
  });

  it('plans with the engine a moment after typing and shows old and new names with a change count', async () => {
    const calls = stubEngine({ 'POST /api/rename/plan': () => plan([{ src: '/p/IMG 1.JPG', dst: '/p/img 1.JPG' }, { src: '/p/b.png', dst: '/p/b.png' }]) });
    const { tool } = mount();
    tool.inputs.set(['/p/IMG 1.JPG', '/p/b.png']);
    add(tool, 'case');
    expect(calls.length).toBe(0);
    await settle(200);
    expect(calls.length).toBe(1);
    expect(calls[0].body).toEqual({ paths: ['/p/IMG 1.JPG', '/p/b.png'], rules: [{ type: 'case', mode: 'lower' }] });
    expect(q(tool.root, '.ft-plan-count').textContent).toBe('1 of 2 change');
    const rows = Array.from(tool.root.querySelectorAll<HTMLElement>('.ft-plan-row'));
    expect(rows.map((r) => [q(r, '.ft-plan-src').textContent, q(r, '.ft-plan-dst').textContent, r.dataset.changed])).toEqual([['IMG 1.JPG', 'img 1.JPG', 'true'], ['b.png', 'b.png', 'false']]);
    expect(q<HTMLButtonElement>(tool.root, '[data-n="apply"]').disabled).toBe(false);
    tool.root.remove();
  });

  it('several quick edits send one plan request carrying the last values', async () => {
    const calls = stubEngine({ 'POST /api/rename/plan': () => plan([{ src: '/p/a.png', dst: '/p/a_x.png' }]) });
    const { tool } = mount();
    tool.inputs.set(['/p/a.png']);
    add(tool, 'insert');
    const text = q<HTMLInputElement>(tool.root, '.ft-card [data-key="text"]');
    type(text, '_');
    await settle(100);
    type(text, '_x');
    await settle(200);
    expect(calls.length).toBe(1);
    expect(calls[0].body).toEqual({ paths: ['/p/a.png'], rules: [{ type: 'insert', text: '_x', position: 'end' }] });
    tool.root.remove();
  });

  it('a name conflict is counted and Rename stays locked', async () => {
    stubEngine({ 'POST /api/rename/plan': () => plan([{ src: '/p/a.png', dst: '/p/c.png', conflict: 'duplicate' }, { src: '/p/b.png', dst: '/p/c.png', conflict: 'duplicate' }]) });
    const { tool } = mount();
    tool.inputs.set(['/p/a.png', '/p/b.png']);
    await settle(200);
    expect(q(tool.root, '.ft-plan-count').textContent).toBe('2 of 2 change, 2 conflicts');
    expect(q<HTMLButtonElement>(tool.root, '[data-n="apply"]').disabled).toBe(true);
    expect(q(tool.root, '.ft-plan-row').dataset.conflict).toBe('duplicate');
    tool.root.remove();
  });

  it('Rename stays locked when no name would change', async () => {
    stubEngine({ 'POST /api/rename/plan': () => plan([{ src: '/p/a.png', dst: '/p/a.png' }]) });
    const { tool } = mount();
    tool.inputs.set(['/p/a.png']);
    await settle(200);
    expect(q(tool.root, '.ft-plan-count').textContent).toBe('0 of 1 change');
    expect(q<HTMLButtonElement>(tool.root, '[data-n="apply"]').disabled).toBe(true);
    tool.root.remove();
  });

  it('a rule the engine refuses shows the refusal where the count was', async () => {
    stubEngine({ 'POST /api/rename/plan': () => refuse(400, 'The regular expression is not valid: missing ).') });
    const { tool } = mount();
    tool.inputs.set(['/p/a.png']);
    add(tool, 'replace');
    await settle(200);
    expect(q(tool.root, '.ft-plan-count').textContent).toBe('The regular expression is not valid: missing ).');
    tool.root.remove();
  });

  it('with no files nothing is sent and the plan is empty', async () => {
    const calls = stubEngine({});
    const { tool } = mount();
    add(tool, 'trim');
    await settle(200);
    expect(calls).toEqual([]);
    expect(tool.root.querySelectorAll('.ft-plan-row').length).toBe(0);
    expect(q(tool.root, '.ft-plan-count').textContent).toBe('');
    tool.root.remove();
  });

  it('Rename sends the rules, reports how many items were renamed and lists the files under their new names', async () => {
    const calls = stubEngine({
      'POST /api/rename/plan': () => plan([{ src: '/p/a.png', dst: '/p/a_001.png' }]),
      'POST /api/rename/apply': () => ({ ok: true, renamed: 1, undo: 'u-77' }),
    });
    const { tool, done } = mount();
    tool.inputs.set(['/p/a.png']);
    add(tool, 'counter');
    await settle(200);
    const undo = q<HTMLButtonElement>(tool.root, '[data-n="undo"]');
    expect(undo.disabled).toBe(true);
    click(q(tool.root, '[data-n="apply"]'));
    await settle();
    expect(calls.find((c) => c.url === '/api/rename/apply')?.body).toEqual({ paths: ['/p/a.png'], rules: [{ type: 'counter', start: 1, step: 1, pad: 3, position: 'end', separator: '_' }] });
    expect(shownToast()).toEqual({ text: 'Renamed 1 item.', kind: 'info' });
    expect(tool.inputs.value).toEqual(['/p/a_001.png']);
    expect(undo.disabled).toBe(false);
    expect(tool.root.querySelectorAll('.ft-card').length).toBe(0);
    expect(done).toHaveBeenCalledTimes(1);
    tool.root.remove();
  });

  it('Undo sends the undo token from the rename and puts the old names back in the list', async () => {
    const calls = stubEngine({
      'POST /api/rename/plan': () => plan([{ src: '/p/a.png', dst: '/p/z.png' }, { src: '/p/b.png', dst: '/p/y.png' }]),
      'POST /api/rename/apply': () => ({ ok: true, renamed: 2, undo: 'u-9' }),
      'POST /api/rename/undo': () => ({ ok: true }),
    });
    const { tool } = mount();
    tool.inputs.set(['/p/a.png', '/p/b.png']);
    await settle(200);
    click(q(tool.root, '[data-n="apply"]'));
    await settle();
    expect(shownToast()?.text).toBe('Renamed 2 items.');
    expect(tool.inputs.value).toEqual(['/p/z.png', '/p/y.png']);
    click(q(tool.root, '[data-n="undo"]'));
    await settle();
    expect(calls.find((c) => c.url === '/api/rename/undo')?.body).toEqual({ undo: 'u-9' });
    expect(tool.inputs.value).toEqual(['/p/a.png', '/p/b.png']);
    expect(q<HTMLButtonElement>(tool.root, '[data-n="undo"]').disabled).toBe(true);
    expect(shownToast()?.text).toBe('The rename was undone.');
    tool.root.remove();
  });

  it('a refused rename changes nothing in the list and shows the refusal', async () => {
    stubEngine({
      'POST /api/rename/plan': () => plan([{ src: '/p/a.png', dst: '/p/z.png' }]),
      'POST /api/rename/apply': () => refuse(409, 'A file named z.png already exists.'),
    });
    const { tool, done } = mount();
    tool.inputs.set(['/p/a.png']);
    await settle(200);
    click(q(tool.root, '[data-n="apply"]'));
    await settle();
    expect(shownToast()).toEqual({ text: 'A file named z.png already exists.', kind: 'error' });
    expect(tool.inputs.value).toEqual(['/p/a.png']);
    expect(q<HTMLButtonElement>(tool.root, '[data-n="undo"]').disabled).toBe(true);
    expect(done).not.toHaveBeenCalled();
    tool.root.remove();
  });
});

describe('the tools page', () => {
  const mount = (): { page: ToolsPage; back: ReturnType<typeof vi.fn> } => {
    stubEngine({ 'GET /api/batch/actions': () => ({ actions: DEFS }), 'GET /api/batch/presets': () => ({ presets: [] }) });
    const back = vi.fn();
    const page = new ToolsPage(() => [], new Jobs(), back, vi.fn());
    document.body.appendChild(page.root);
    return { page, back };
  };
  const visible = (page: ToolsPage): string[] => Array.from(page.root.querySelectorAll<HTMLElement>('.ft-tool-page')).filter((n) => !n.hidden).map((n) => n.dataset.tool ?? '');

  it('has three tabs named Batch convert, Resize and Rename', () => {
    const { page } = mount();
    expect(Array.from(page.root.querySelectorAll('[data-tab]')).map((n) => n.textContent?.trim())).toEqual(['Batch convert', 'Resize', 'Rename']);
    page.root.remove();
  });

  it('clicking a tab shows only that tool and marks the tab', async () => {
    const { page } = mount();
    page.show('convert');
    await settle();
    expect(visible(page)).toEqual(['convert']);
    click(q(page.root, '[data-tab="rename"]'));
    expect(visible(page)).toEqual(['rename']);
    expect(page.current).toBe('rename');
    expect(Array.from(page.root.querySelectorAll<HTMLElement>('[data-tab].is-on')).map((n) => n.dataset.tab)).toEqual(['rename']);
    page.root.remove();
  });

  it('opening a tool with files puts them in that tool only', () => {
    const { page } = mount();
    page.show('resize', ['/p/a.jpg']);
    expect(page.resize.inputs.value).toEqual(['/p/a.jpg']);
    expect(page.batch.inputs.value).toEqual([]);
    expect(page.rename.inputs.value).toEqual([]);
    page.root.remove();
  });

  it('the back button and Escape go back, but Escape inside a text box does not', () => {
    const { page, back } = mount();
    click(q(page.root, '[data-t="back"]'));
    expect(back).toHaveBeenCalledTimes(1);
    press(q(page.root, '.ft-tools-body'), 'Escape');
    expect(back).toHaveBeenCalledTimes(2);
    press(q(page.resize.root, '.ft-r-value'), 'Escape');
    expect(back).toHaveBeenCalledTimes(2);
    page.root.remove();
  });
});

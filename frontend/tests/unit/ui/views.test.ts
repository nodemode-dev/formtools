import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EditOp, Entry, Job } from '../../../src/io/api';
import type { OverlayParams } from '../../../src/io/desk';
import type { BaseCtx } from '../../../src/overlay/ctx';
import { mountTimer } from '../../../src/overlay/timer';
import { Jobs } from '../../../src/ui/jobs';
import { SaveDialog } from '../../../src/ui/save-dialog';
import { ChecksumsView } from '../../../src/ui/utilities/checksums';
import { confirmButton, progressText, trashAll, type UtilDeps } from '../../../src/ui/utilities/common';
import { click, job, press, refuse, settle, shownToast, stubEngine, toastRoot, type } from './support';

const q = <T extends Element = HTMLElement>(root: ParentNode, sel: string): T => {
  const n = root.querySelector<T>(sel);
  if (!n) throw new Error(`missing ${sel}`);
  return n;
};
const text = (root: ParentNode, sel: string): string => q(root, sel).textContent ?? '';

beforeEach(() => {
  vi.useFakeTimers();
  toastRoot();
});

afterEach(async () => {
  await vi.advanceTimersByTimeAsync(5000);
  vi.useRealTimers();
  vi.unstubAllGlobals();
  for (const n of [...document.body.children]) if (n.id !== 'toast-root') n.remove();
});

describe('the jobs button and panel', () => {
  const mount = (): Jobs => {
    const jobs = new Jobs();
    document.body.append(jobs.button, jobs.panel);
    return jobs;
  };

  it('stays hidden and the panel says there are no jobs until one is tracked', () => {
    const jobs = mount();
    expect(jobs.button.hidden).toBe(true);
    expect(q(jobs.panel, '.cv-jobs-empty').hidden).toBe(false);
    expect(text(jobs.panel, '.cv-jobs-empty')).toBe('No jobs yet.');
  });

  it('a running job shows how many run and done of total, and its row reads the percentage', () => {
    stubEngine({ 'GET /api/jobs/j1': () => job({ done: 1 }) });
    const jobs = mount();
    jobs.track(job({ done: 1, total: 4 }));
    expect(jobs.button.hidden).toBe(false);
    expect(text(jobs.button, '.ft-st-jobs-text')).toBe('1 running \u00b7 1 of 4');
    expect(text(jobs.panel, '.cv-jobs-pct')).toBe('25%');
    expect(q(jobs.button, 'i').style.getPropertyValue('--p')).toBe('25%');
  });

  it('polls the engine and, when the job ends, patches the same row to Done and says so once', async () => {
    const calls = stubEngine({ 'GET /api/jobs/j1': () => job({ done: 4, state: 'done', finished: 200 }) });
    const jobs = mount();
    jobs.track(job({ done: 1 }));
    const row = q(jobs.panel, '.cv-jobs-row');
    await settle(400);
    expect(calls.map((c) => c.url)).toEqual(['/api/jobs/j1']);
    expect(jobs.panel.querySelectorAll('.cv-jobs-row')).toHaveLength(1);
    expect(q(jobs.panel, '.cv-jobs-row')).toBe(row);
    expect(text(row, '.cv-jobs-pct')).toBe('Done');
    expect(q<HTMLButtonElement>(row, '.cv-jobs-stop').disabled).toBe(true);
    expect(text(jobs.button, '.ft-st-jobs-text')).toBe('1 job');
    expect(shownToast()).toEqual({ text: 'Convert: done.', kind: 'info' });
    await settle(2000);
    expect(calls).toHaveLength(1);
  });

  it('a finished job with errors counts them on the row and in an error message', async () => {
    stubEngine({ 'GET /api/jobs/j1': () => job({ done: 4, state: 'done', errors: [{ path: '/a', error: 'x' }, { path: '/b', error: 'y' }] }) });
    const jobs = mount();
    jobs.track(job());
    await settle(400);
    expect(text(jobs.panel, '.cv-jobs-pct')).toBe('2 errors');
    expect(shownToast()).toEqual({ text: 'Convert: done, 2 could not be processed.', kind: 'error' });
  });

  it('a job the engine no longer knows is marked failed with a sentence saying it may have restarted', async () => {
    stubEngine({ 'GET /api/jobs/j1': () => refuse(404, 'no such job') });
    const jobs = mount();
    jobs.track(job());
    await settle(400);
    expect(text(jobs.panel, '.cv-jobs-pct')).toBe('Failed');
    expect(shownToast()).toEqual({ text: 'Convert failed: the engine no longer knows this job; it may have restarted.', kind: 'error' });
  });

  it('Stop posts a cancel for that job and the row then reads Stopped', async () => {
    const calls = stubEngine({
      'POST /api/jobs/j1/cancel': () => job({ state: 'cancelled' }),
      'GET /api/jobs/j1': () => job(),
    });
    const jobs = mount();
    jobs.track(job());
    click(q(jobs.panel, '.cv-jobs-stop'));
    await settle(0);
    expect(calls[0]).toMatchObject({ url: '/api/jobs/j1/cancel', method: 'POST' });
    expect(text(jobs.panel, '.cv-jobs-pct')).toBe('Stopped');
    expect(shownToast()?.text).toBe('Convert stopped.');
  });

  it('lists the newest job first and tells each listener about its own job', () => {
    stubEngine({ 'GET /api/jobs/old': () => job({ id: 'old' }), 'GET /api/jobs/new': () => job({ id: 'new' }) });
    const jobs = mount();
    const seen: string[] = [];
    jobs.track(job({ id: 'old', title: 'Older', started: 10 }), (j) => seen.push(j.id));
    jobs.track(job({ id: 'new', title: 'Newer', started: 20 }));
    expect([...jobs.panel.querySelectorAll('.cv-jobs-name')].map((n) => n.textContent)).toEqual(['Newer', 'Older']);
    expect(seen).toEqual(['old']);
    expect(text(jobs.button, '.ft-st-jobs-text')).toBe('2 running \u00b7 0 of 4');
  });

  it('opens the panel from the button and a pointer press elsewhere closes it', () => {
    stubEngine({ 'GET /api/jobs/j1': () => job() });
    const jobs = mount();
    jobs.track(job());
    click(jobs.button);
    expect(jobs.panel.hidden).toBe(false);
    document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    expect(jobs.panel.hidden).toBe(true);
  });
});

describe('progress sentences for a utility job', () => {
  it('reads done of total while running, or just done when the total is unknown', () => {
    expect(progressText(job({ done: 3, total: 8 }), 'files')).toBe('3 of 8 files');
    expect(progressText(job({ done: 7, total: 0 }), 'folders')).toBe('7 folders');
  });

  it('says Stopped when cancelled, gives the first error when failed, and nothing when done', () => {
    expect(progressText(job({ state: 'cancelled' }), 'files')).toBe('Stopped.');
    expect(progressText(job({ state: 'failed', errors: [{ path: '/x', error: 'disk gone' }] }), 'files')).toBe('disk gone');
    expect(progressText(job({ state: 'failed' }), 'files')).toBe('The scan failed.');
    expect(progressText(job({ state: 'done' }), 'files')).toBe('');
  });
});

describe('moving many files to the trash', () => {
  it('sends at most 5000 paths per request and adds up what was moved', async () => {
    const calls = stubEngine({ 'POST /api/files/trash': (c) => ({ ok: true, trashed: (c.body as { paths: string[] }).paths.length, errors: [] }) });
    const paths = Array.from({ length: 12000 }, (_, i) => `/f/${i}`);
    const r = await trashAll(paths);
    expect(calls.map((c) => (c.body as { paths: string[] }).paths.length)).toEqual([5000, 5000, 2000]);
    expect(r).toEqual({ trashed: 12000, errors: [] });
  });

  it('a refused later batch marks each of its paths with the refusal, while a refused first batch is thrown', async () => {
    let n = 0;
    stubEngine({ 'POST /api/files/trash': () => (n++ === 0 ? { ok: true, trashed: 5000, errors: [] } : refuse(500, 'Trash is full')) });
    const r = await trashAll(Array.from({ length: 5002 }, (_, i) => `/f/${i}`));
    expect(r.trashed).toBe(5000);
    expect(r.errors).toEqual([{ path: '/f/5000', error: 'Trash is full' }, { path: '/f/5001', error: 'Trash is full' }]);
    stubEngine({ 'POST /api/files/trash': () => refuse(403, 'Not allowed here') });
    await expect(trashAll(['/a'])).rejects.toThrow('Not allowed here');
  });
});

describe('a button that asks before it acts', () => {
  const mount = (): { btn: HTMLButtonElement; action: ReturnType<typeof vi.fn> } => {
    const btn = document.createElement('button');
    btn.innerHTML = '<span class="ft-u-btn-label">Delete all</span>';
    document.body.append(btn);
    const action = vi.fn();
    confirmButton(btn, () => 'Delete 3 files?', action);
    return { btn, action };
  };

  it('the first press asks, the second press acts and the label returns', () => {
    const { btn, action } = mount();
    click(btn);
    expect(text(btn, '.ft-u-btn-label')).toBe('Delete 3 files?');
    expect(btn.classList.contains('is-danger')).toBe(true);
    expect(action).not.toHaveBeenCalled();
    click(btn);
    expect(action).toHaveBeenCalledTimes(1);
    expect(text(btn, '.ft-u-btn-label')).toBe('Delete all');
  });

  it('the question goes away after four seconds and a later press asks again', async () => {
    const { btn, action } = mount();
    click(btn);
    await settle(4000);
    expect(text(btn, '.ft-u-btn-label')).toBe('Delete all');
    click(btn);
    expect(action).not.toHaveBeenCalled();
    expect(text(btn, '.ft-u-btn-label')).toBe('Delete 3 files?');
  });
});

describe('the save dialog', () => {
  const entry = (over: Partial<Entry> = {}): Entry => ({ name: 'x.jpg', path: '/p/x.jpg', kind: 'file', ext: 'jpg', ...over }) as Entry;
  const mount = (): { dlg: SaveDialog; opener: HTMLButtonElement; done: ReturnType<typeof vi.fn<(path: string) => void>> } => {
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    const dlg = new SaveDialog();
    document.body.append(dlg.root);
    return { dlg, opener, done: vi.fn<(path: string) => void>() };
  };
  const w = (d: SaveDialog): HTMLInputElement => q<HTMLInputElement>(d.root, '.ft-w');
  const h = (d: SaveDialog): HTMLInputElement => q<HTMLInputElement>(d.root, '.ft-h');

  it('opens for resizing with the picture size filled in and the width focused, and Escape returns focus to the opener', () => {
    const { dlg, opener, done } = mount();
    dlg.open('resize', entry(), { w: 4000, h: 3000 }, [], done);
    expect(dlg.isOpen).toBe(true);
    expect(text(dlg.root, '.ft-dlg-title')).toBe('Resize');
    expect([w(dlg).value, h(dlg).value]).toEqual(['4000', '3000']);
    expect(document.activeElement).toBe(w(dlg));
    press(w(dlg), 'Escape');
    expect(dlg.isOpen).toBe(false);
    expect(document.activeElement).toBe(opener);
  });

  it('keeping proportions turns a 4000 by 3000 picture at width 1000 into height 750, and height 300 into width 400', () => {
    const { dlg, done } = mount();
    dlg.open('resize', entry(), { w: 4000, h: 3000 }, [], done);
    type(w(dlg), '1000');
    expect(h(dlg).value).toBe('750');
    h(dlg).focus();
    type(h(dlg), '300');
    expect(w(dlg).value).toBe('400');
  });

  it('without kept proportions the other side is left alone', () => {
    const { dlg, done } = mount();
    dlg.open('resize', entry(), { w: 4000, h: 3000 }, [], done);
    q<HTMLInputElement>(dlg.root, '.ft-lock').checked = false;
    type(w(dlg), '1000');
    expect(h(dlg).value).toBe('3000');
  });

  it('a width of zero is refused with a sentence and nothing is sent', async () => {
    const calls = stubEngine({});
    const { dlg, done } = mount();
    dlg.open('resize', entry(), { w: 40, h: 30 }, [], done);
    type(w(dlg), '0');
    click(q(dlg.root, '[data-save]'));
    await settle(0);
    expect(calls).toHaveLength(0);
    expect(shownToast()).toEqual({ text: 'Width and height must be at least 1 pixel.', kind: 'error' });
    expect(dlg.isOpen).toBe(true);
  });

  it('Save sends the resize step, the quality of a JPEG and a new file, then closes and names the saved file', async () => {
    const calls = stubEngine({ 'POST /api/image/edit': () => ({ ok: true, path: '/p/x-1.jpg' }) });
    const { dlg, opener, done } = mount();
    dlg.open('resize', entry(), { w: 4000, h: 3000 }, [], done);
    type(w(dlg), '1000');
    click(q(dlg.root, '[data-save]'));
    await settle(0);
    expect(calls[0].body).toEqual({ path: '/p/x.jpg', ops: [{ op: 'resize', width: 1000, height: 750, resample: 'lanczos' }], out: { quality: 90 }, overwrite: false });
    expect(dlg.isOpen).toBe(false);
    expect(document.activeElement).toBe(opener);
    expect(shownToast()?.text).toBe('Saved x-1.jpg.');
    expect(done).toHaveBeenCalledWith('/p/x-1.jpg');
  });

  it('a PNG has no quality row and no quality is sent', async () => {
    const calls = stubEngine({ 'POST /api/image/edit': () => ({ ok: true, path: '/p/y-1.png' }) });
    const { dlg, done } = mount();
    dlg.open('save', entry({ name: 'y.png', path: '/p/y.png', ext: 'png' }), { w: 10, h: 10 }, [], done);
    expect(q(dlg.root, '.ft-quality-row').hidden).toBe(true);
    click(q(dlg.root, '[data-save]'));
    await settle(0);
    expect(calls[0].body).toEqual({ path: '/p/y.png', ops: [], out: {}, overwrite: false });
  });

  it('describes a crop in words and sends it unchanged', async () => {
    const calls = stubEngine({ 'POST /api/image/edit': () => ({ ok: true, path: '/p/x-crop.jpg' }) });
    const { dlg, done } = mount();
    const crop: EditOp = { op: 'crop', x: 10, y: 20, w: 300, h: 200 };
    dlg.open('crop', entry(), { w: 4000, h: 3000 }, [crop], done);
    expect(text(dlg.root, '.ft-dlg-title')).toBe('Save the crop');
    expect(text(dlg.root, '.ft-save-crop')).toBe('Crop to 300 x 200 px from 10, 20.');
    expect(q(dlg.root, '.ft-save-size').hidden).toBe(true);
    click(q(dlg.root, '[data-save]'));
    await settle(0);
    expect((calls[0].body as { ops: EditOp[] }).ops).toEqual([crop]);
  });

  it('replacing the original in a different format is refused before any request', async () => {
    const calls = stubEngine({});
    const { dlg, done } = mount();
    dlg.open('save', entry(), { w: 10, h: 10 }, [], done);
    type(q<HTMLSelectElement>(dlg.root, '.ft-format'), 'png', 'change');
    q<HTMLInputElement>(dlg.root, 'input[value="replace"]').checked = true;
    click(q(dlg.root, '[data-save]'));
    await settle(0);
    expect(calls).toHaveLength(0);
    expect(shownToast()?.text).toBe('Replacing the original keeps its format. Choose "A new file" to change the format.');
  });

  it('replacing a .jpg as JPEG is allowed and asks the engine to overwrite that path', async () => {
    const calls = stubEngine({ 'POST /api/image/edit': () => ({ ok: true, path: '/p/x.jpg' }) });
    const { dlg, done } = mount();
    dlg.open('save', entry(), { w: 10, h: 10 }, [], done);
    type(q<HTMLSelectElement>(dlg.root, '.ft-format'), 'jpeg', 'change');
    q<HTMLInputElement>(dlg.root, 'input[value="replace"]').checked = true;
    click(q(dlg.root, '[data-save]'));
    await settle(0);
    expect(calls[0].body).toEqual({ path: '/p/x.jpg', ops: [], out: { format: 'jpeg', quality: 90, path: '/p/x.jpg' }, overwrite: true });
  });

  it('an engine refusal is shown as its sentence and the dialog stays open with Save usable', async () => {
    stubEngine({ 'POST /api/image/edit': () => refuse(409, 'The file is open in another program.') });
    const { dlg, done } = mount();
    dlg.open('save', entry(), { w: 10, h: 10 }, [], done);
    click(q(dlg.root, '[data-save]'));
    await settle(0);
    expect(shownToast()).toEqual({ text: 'The file is open in another program.', kind: 'error' });
    expect(dlg.isOpen).toBe(true);
    expect(q<HTMLButtonElement>(dlg.root, '[data-save]').disabled).toBe(false);
    expect(done).not.toHaveBeenCalled();
  });

  it('clicking the scrim around the dialog closes it', () => {
    const { dlg, done } = mount();
    dlg.open('save', entry(), { w: 10, h: 10 }, [], done);
    click(dlg.root);
    expect(dlg.isOpen).toBe(false);
  });
});

describe('the checksums utility', () => {
  const A = 'a'.repeat(64);
  const B = 'b'.repeat(64);
  const mount = (): ChecksumsView => {
    const jobs = new Jobs();
    const deps = { jobs, selection: () => [], folders: () => [], folder: () => '/', reveal: vi.fn(), open: vi.fn(), changed: vi.fn() } as unknown as UtilDeps;
    const view = new ChecksumsView(deps);
    document.body.append(view.root);
    return view;
  };
  const doneHash = (): Job => job({
    id: 'h1', title: 'Checksums', state: 'done', done: 2, total: 2,
    result: { items: [{ path: '/d/one.iso', size: 1024, hashes: { sha256: A, blake3: 'c1' } }, { path: '/d/sub/two.bin', size: 512, hashes: { sha256: B, blake3: 'c2' } }] },
  } as Partial<Job>);

  it('with no files it says to add some and sends nothing', async () => {
    const calls = stubEngine({});
    const view = mount();
    click(q(view.root, '[data-u="run"]'));
    await settle(0);
    expect(calls).toHaveLength(0);
    expect(shownToast()).toEqual({ text: 'Add files or a folder first.', kind: 'error' });
  });

  it('with every algorithm unticked it asks for one and sends nothing', async () => {
    const calls = stubEngine({});
    const view = mount();
    view.show(['/d/one.iso']);
    for (const box of view.root.querySelectorAll<HTMLInputElement>('[data-algo]')) box.checked = false;
    click(q(view.root, '[data-u="run"]'));
    await settle(0);
    expect(calls).toHaveLength(0);
    expect(shownToast()?.text).toBe('Choose at least one algorithm.');
  });

  it('Compute sends the files with the two algorithms ticked at the start, SHA-256 and BLAKE3', async () => {
    const calls = stubEngine({ 'POST /api/hash': () => doneHash() });
    const view = mount();
    view.show(['/d/one.iso', '/d/sub/two.bin']);
    click(q(view.root, '[data-u="run"]'));
    await settle(0);
    expect(calls[0].body).toEqual({ paths: ['/d/one.iso', '/d/sub/two.bin'], algorithms: ['sha256', 'blake3'] });
  });

  it('shows each file by name and size with a line per algorithm and a total of 1536 bytes as 1.5 KB', async () => {
    stubEngine({ 'POST /api/hash': () => doneHash() });
    const view = mount();
    view.show(['/d']);
    click(q(view.root, '[data-u="run"]'));
    await settle(0);
    expect([...view.root.querySelectorAll('.ft-h-name')].map((n) => n.textContent)).toEqual(['one.iso', 'two.bin']);
    expect([...view.root.querySelectorAll('.ft-h-size')].map((n) => n.textContent)).toEqual(['1.0 KB', '512 B']);
    expect(text(view.root, '.ft-h-sum')).toBe('2 files \u00b7 1.5 KB');
    const first = view.root.querySelectorAll('.ft-h-item')[0];
    expect([...first.querySelectorAll('.ft-h-algo-name')].map((n) => n.textContent)).toEqual(['SHA-256', 'BLAKE3']);
    expect(text(first, '[data-algo-line="sha256"] .ft-h-hex')).toBe(A);
    expect(q(view.root, '.ft-h-empty').hidden).toBe(true);
    expect(q<HTMLButtonElement>(view.root, '[data-h="save"]').disabled).toBe(false);
  });

  it('follows a running hash job to its end before showing results', async () => {
    const calls = stubEngine({ 'POST /api/hash': () => job({ id: 'h1', done: 0, total: 2 }), 'GET /api/jobs/h1': () => doneHash() });
    const view = mount();
    view.show(['/d']);
    click(q(view.root, '[data-u="run"]'));
    await settle(0);
    expect(text(view.root, '.ft-h-state')).toBe('0 of 2 files');
    expect(q(view.root, '[data-u="run"]').dataset.mode).toBe('stop');
    await settle(400);
    expect(calls.map((c) => c.url)).toEqual(['/api/hash', '/api/jobs/h1']);
    expect(view.root.querySelectorAll('.ft-h-item')).toHaveLength(2);
    expect(q(view.root, '[data-u="run"]').dataset.mode).toBe('run');
  });

  it('a pasted published checksum is matched ignoring case and a leading algorithm name', async () => {
    stubEngine({ 'POST /api/hash': () => doneHash() });
    const view = mount();
    view.show(['/d']);
    click(q(view.root, '[data-u="run"]'));
    await settle(0);
    const cmp = q<HTMLInputElement>(view.root, '.ft-h-cmp');
    type(cmp, `SHA256: ${B.toUpperCase()}`);
    expect(text(view.root, '.ft-h-cmp-out')).toBe('Matches one file.');
    expect(view.root.querySelectorAll('.ft-h-line.is-match')).toHaveLength(1);
    expect(q(view.root, '.ft-h-items').querySelectorAll('.ft-h-item')[1].querySelector('.is-match')).not.toBeNull();
    type(cmp, 'deadbeefdeadbeef');
    expect(text(view.root, '.ft-h-cmp-out')).toBe('No file matches this checksum.');
    type(cmp, 'abc');
    expect(text(view.root, '.ft-h-cmp-out')).toBe('');
  });

  it('comparing before computing says to compute first', () => {
    const view = mount();
    type(q<HTMLInputElement>(view.root, '.ft-h-cmp'), A);
    expect(text(view.root, '.ft-h-cmp-out')).toBe('Compute first, then compare.');
  });

  it('a refused hash request is shown as its sentence', async () => {
    stubEngine({ 'POST /api/hash': () => refuse(400, 'Unknown algorithm.') });
    const view = mount();
    view.show(['/d']);
    click(q(view.root, '[data-u="run"]'));
    await settle(0);
    expect(shownToast()).toEqual({ text: 'Unknown algorithm.', kind: 'error' });
  });

  it('Verify with no checksum file path asks for one and sends nothing', async () => {
    const calls = stubEngine({});
    const view = mount();
    click(q(view.root, '[data-h="verify"]'));
    await settle(0);
    expect(calls).toHaveLength(0);
    expect(shownToast()?.text).toBe('Type the path of a checksum file.');
  });

  it('Verify sends the file path, counts good, changed and missing, and lists changed files first', async () => {
    const result = { ok: 1, failed: 1, missing: 1, items: [
      { path: 'a.bin', expected: 'e1', actual: 'e1', ok: true, missing: false },
      { path: 'b.bin', expected: 'e2', actual: null, ok: false, missing: true },
      { path: 'c.bin', expected: 'e3', actual: 'f3', ok: false, missing: false },
    ] };
    const calls = stubEngine({ 'POST /api/hash/verify': () => job({ id: 'v1', state: 'done', result } as Partial<Job>) });
    const view = mount();
    const box = q<HTMLInputElement>(view.root, '.ft-h-sums');
    box.value = '/d/SHA256SUMS';
    press(box, 'Enter');
    await settle(0);
    expect(calls[0].body).toEqual({ path: '/d/SHA256SUMS' });
    expect(text(view.root, '.ft-v-state')).toBe('1 good \u00b7 1 changed \u00b7 1 missing');
    expect(text(view.root, '.ft-h-title')).toBe('Verification');
    const rows = [...view.root.querySelectorAll<HTMLElement>('.ft-v-item')];
    expect(rows.map((r) => [r.dataset.state, r.querySelector('.ft-v-badge')?.textContent])).toEqual([['bad', 'Changed'], ['missing', 'Missing'], ['ok', 'Good']]);
    expect(rows[0].querySelector('.ft-v-hex')?.textContent).toBe('expected e3, found f3');
  });
});

describe('the break timer overlay', () => {
  const mount = (options: Record<string, unknown>): { ctx: BaseCtx; dispose: () => void; root: HTMLElement } => {
    const root = document.createElement('div');
    root.id = 'ov-root';
    document.body.append(root);
    const ctx = {
      params: { tool: 'timer', options } as unknown as OverlayParams,
      hint: { set: vi.fn() },
      reduced: false,
      finish: vi.fn(async () => undefined),
      cancel: vi.fn(async () => undefined),
      switchTo: vi.fn(),
    } as unknown as BaseCtx;
    return { ctx, dispose: mountTimer(ctx), root };
  };

  it('opens in the overlay root counting down the asked minutes', async () => {
    const { root, dispose } = mount({ minutes: 10 });
    expect(root.querySelector('.ov-timer')).not.toBeNull();
    expect(text(root, '.ov-timer-time')).toBe('10:00');
    expect(text(root, '.ov-timer-sub')).toBe('10 min break');
    await settle(61000);
    expect(text(root, '.ov-timer-time')).toBe('8:59');
    dispose();
  });

  it('shows hours with two-digit minutes for 90 minutes', () => {
    const { root, dispose } = mount({ minutes: 90 });
    expect(text(root, '.ov-timer-time')).toBe('1:30:00');
    dispose();
  });

  it('falls back to 5 minutes for a missing value and caps a huge one at 600 minutes', () => {
    const a = mount({});
    expect(text(a.root, '.ov-timer-time')).toBe('5:00');
    a.dispose();
    a.root.remove();
    const b = mount({ minutes: 5000 });
    expect(text(b.root, '.ov-timer-time')).toBe('10:00:00');
    b.dispose();
  });

  it('after the time is up it says so and counts the overtime upward', async () => {
    const { root, dispose } = mount({ minutes: 1 });
    await settle(65000);
    expect(text(root, '.ov-timer-label')).toBe('Time is up');
    expect(text(root, '.ov-timer-time')).toBe('+0:05');
    expect(text(root, '.ov-timer-sub')).toBe('Overtime');
    expect(q(root, '.ov-timer').classList.contains('is-over')).toBe(true);
    dispose();
  });

  it('Up adds a minute, Down removes one but never below one minute, and Escape cancels', () => {
    const { ctx, root, dispose } = mount({ minutes: 2 });
    press(window as unknown as Element, 'ArrowUp');
    expect(text(root, '.ov-timer-time')).toBe('3:00');
    expect(text(root, '.ov-timer-sub')).toBe('3 min break');
    press(window as unknown as Element, 'ArrowDown');
    press(window as unknown as Element, 'ArrowDown');
    press(window as unknown as Element, 'ArrowDown');
    expect(text(root, '.ov-timer-sub')).toBe('1 min break');
    press(window as unknown as Element, 'Escape');
    expect(ctx.cancel).toHaveBeenCalledTimes(1);
    dispose();
  });

  it('closing removes the timer from the overlay root and stops listening for keys', () => {
    const { ctx, root, dispose } = mount({ minutes: 2 });
    dispose();
    expect(root.querySelector('.ov-timer')).toBeNull();
    press(window as unknown as Element, 'Escape');
    expect(ctx.cancel).not.toHaveBeenCalled();
  });
});

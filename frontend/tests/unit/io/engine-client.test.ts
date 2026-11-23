import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, ApiError } from '../../../src/io/api';
import { loadWindowKey, windowKey, keyed } from '../../../src/io/window-key';
import { desktopApi } from '../../../src/io/desktop-api';
import { utilApi, fmtBytes, baseName, dirName } from '../../../src/io/util-api';
import { host, inDesktop } from '../../../src/io/host';
import { desk, overlayParams } from '../../../src/io/desk';

interface Call { url: string; init: RequestInit }

function engine(reply: (url: string, init: RequestInit) => Response): { calls: Call[] } {
  const calls: Call[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const i = init ?? {};
    calls.push({ url, init: i });
    return reply(url, i);
  }));
  return { calls };
}

const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

async function noKey(): Promise<void> {
  sessionStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })));
  await loadWindowKey();
}

async function refusal(p: Promise<unknown>): Promise<ApiError> {
  try { await p; } catch (e) { return e as ApiError; }
  throw new Error('the call was not refused');
}

beforeEach(async () => { await noKey(); });
afterEach(() => { vi.unstubAllGlobals(); sessionStorage.clear(); });

describe('engine client requests', () => {
  it('lists a folder by sending the path and the hidden flag in the query', async () => {
    const { calls } = engine(() => json({ path: '/photos/a b', parent: '/photos', entries: [] }));
    const out = await api.list('/photos/a b&c', true);
    const q = new URL(calls[0].url, 'http://x').searchParams;
    expect(new URL(calls[0].url, 'http://x').pathname).toBe('/api/fs/list');
    expect(q.get('path')).toBe('/photos/a b&c');
    expect(q.get('hidden')).toBe('1');
    expect(out.parent).toBe('/photos');
  });

  it('sends hidden as 0 when hidden files are not asked for', async () => {
    const { calls } = engine(() => json({ path: '/', parent: null, entries: [] }));
    await api.dirs('/');
    expect(new URL(calls[0].url, 'http://x').searchParams.get('hidden')).toBe('0');
  });

  it('writes a rating as a JSON POST that carries the path and only the changed field', async () => {
    const { calls } = engine(() => json({ rating: 4, label: null }));
    const tag = await api.metaWrite('/p/x.jpg', { rating: 4 });
    expect(calls[0].url).toBe('/api/meta/write');
    expect(calls[0].init.method).toBe('POST');
    expect(new Headers(calls[0].init.headers).get('Content-Type')).toBe('application/json');
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ path: '/p/x.jpg', rating: 4 });
    expect(tag.rating).toBe(4);
  });

  it('saves a preset with PUT under its name escaped for the URL', async () => {
    const { calls } = engine(() => json({ ok: true }));
    const output = { format: 'png', quality: 90, folder: '', subfolder: '', naming: '{name}', overwrite: 'rename', keep_metadata: true, keep_folders: false, keep_dates: true } as const;
    await api.savePreset('web/small #1', [], output);
    expect(calls[0].init.method).toBe('PUT');
    expect(decodeURIComponent(calls[0].url.slice('/api/batch/presets/'.length))).toBe('web/small #1');
    expect(calls[0].url).not.toContain('/small');
  });

  it('deletes a preset with the DELETE method', async () => {
    const { calls } = engine(() => json({ ok: true }));
    await api.deletePreset('old');
    expect(calls[0]).toMatchObject({ url: '/api/batch/presets/old', init: { method: 'DELETE' } });
  });

  it('asks for a lossless transform when rotating a picture', async () => {
    const { calls } = engine(() => json({ ok: true, lossless_used: true, path: '/p/x.jpg' }));
    const out = await api.transform('/p/x.jpg', 'rotate-cw');
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ path: '/p/x.jpg', op: 'rotate-cw', lossless: true });
    expect(out.lossless_used).toBe(true);
  });

  it('sends an edit with its operations, output and overwrite flag', async () => {
    const { calls } = engine(() => json({ ok: true, path: '/p/out.png' }));
    await api.edit('/p/x.jpg', [{ op: 'crop', x: 1, y: 2, w: 3, h: 4 }], { format: 'png' }, true);
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ path: '/p/x.jpg', ops: [{ op: 'crop', x: 1, y: 2, w: 3, h: 4 }], out: { format: 'png' }, overwrite: true });
  });

  it('cancels a job by posting to the job id escaped for the URL', async () => {
    const { calls } = engine(() => json({ id: 'a/b', state: 'cancelled' }));
    const job = await api.cancelJob('a/b');
    expect(calls[0].url).toBe('/api/jobs/a%2Fb/cancel');
    expect(job.state).toBe('cancelled');
  });

  it('answers a consent request with the chosen answer', async () => {
    const { calls } = engine(() => json({ access: 'ask', kept: false }));
    await api.agentAnswer('r 1', 'once');
    expect(calls[0].url).toBe('/api/agents/requests/r%201');
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ answer: 'once' });
  });

  it('sets agent access with PUT', async () => {
    const { calls } = engine(() => json({ access: 'blocked' }));
    const out = await api.agentSetAccess('blocked');
    expect(calls[0].init.method).toBe('PUT');
    expect(out.access).toBe('blocked');
  });

  it('merges batch inputs, output and actions into one plan body', async () => {
    const { calls } = engine(() => json({ items: [], skipped: [] }));
    const output = { format: 'same', quality: 80, folder: '/out', subfolder: '', naming: '{name}', overwrite: 'skip', keep_metadata: false, keep_folders: true, keep_dates: false } as const;
    await api.batchPlan({ inputs: ['/a'], recursive: true, extensions: ['jpg'] }, output, [{ id: 'resize', params: { w: 10 } }]);
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ inputs: ['/a'], recursive: true, extensions: ['jpg'], output, actions: [{ id: 'resize', params: { w: 10 } }] });
  });

  it('unwraps the terminal list from the engine answer', async () => {
    engine(() => json({ terminals: [{ id: 't1', title: 'sh', alive: true, kind: 'shell' }] }));
    expect((await api.terminals()).map((t) => t.id)).toEqual(['t1']);
  });

  it('sends the waveform point count with the path', async () => {
    const { calls } = engine(() => json({ duration: 2, peaks: [0, 1] }));
    await api.waveform('/m/a.wav', 512);
    const q = new URL(calls[0].url, 'http://x').searchParams;
    expect([q.get('path'), q.get('points')]).toEqual(['/m/a.wav', '512']);
  });
});

describe('engine client refusals', () => {
  it('carries the engine refusal message and HTTP status to the caller', async () => {
    engine(() => json({ ok: false, error: 'No such folder: /nope' }, 404));
    const e = await refusal(api.list('/nope'));
    expect(e).toBeInstanceOf(ApiError);
    expect(e.message).toBe('No such folder: /nope');
    expect(e.status).toBe(404);
  });

  it('treats an answer with ok false as a refusal even when the status is 200', async () => {
    engine(() => json({ ok: false, error: 'The file is read only.' }, 200));
    const e = await refusal(api.metaWrite('/p/x.jpg', { label: 'red' }));
    expect(e.message).toBe('The file is read only.');
    expect(e.status).toBe(200);
  });

  it('names the status when the engine answers without a JSON body', async () => {
    engine(() => new Response('<html>bad gateway</html>', { status: 502 }));
    const e = await refusal(api.health());
    expect(e.status).toBe(502);
    expect(e.message).toContain('502');
  });

  it('refuses an answer whose body is empty even with status 200', async () => {
    engine(() => new Response('', { status: 200 }));
    const e = await refusal(api.capabilities());
    expect(e).toBeInstanceOf(ApiError);
    expect(e.message).toContain('200');
  });

  it('lets a network failure reach the caller', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    await expect(api.home()).rejects.toThrow('Failed to fetch');
  });

  it('refuses a Claude Code start that comes back without a terminal id', async () => {
    engine(() => json({ title: 'claude' }));
    const e = await refusal(api.openClaude({ prompt: 'hi' }));
    expect(e).toBeInstanceOf(ApiError);
    expect(e.status).toBe(502);
  });

  it('returns the Claude Code terminal when the engine gives an id', async () => {
    const { calls } = engine(() => json({ id: 't9', title: 'claude', alive: true, kind: 'claude' }));
    const t = await api.openClaude({ resume: 's1', cols: 80, rows: 24 });
    expect(t.id).toBe('t9');
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ resume: 's1', cols: 80, rows: 24 });
  });

  it('turns a refused agent status into null instead of throwing', async () => {
    engine(() => json({ ok: false, error: 'gone' }, 500));
    expect(await api.claudeStatus()).toBeNull();
  });

  it('asks for a fresh agent status with a query flag', async () => {
    const { calls } = engine(() => json({ installed: true, running: false }));
    await api.claudeStatus(true);
    expect(calls[0].url).toBe('/api/agent/claude/status?fresh=true');
  });

  it('reports Claude Code as missing when both status routes are refused', async () => {
    engine(() => json({ ok: false, error: 'no' }, 404));
    expect(await api.claudeCodeStatus()).toBeNull();
  });

  it('reports Claude Code installed from the newer status route without asking the older one', async () => {
    const { calls } = engine(() => json({ installed: true, version: '2.1.0', signedIn: true }));
    expect(await api.claudeCodeStatus()).toEqual({ installed: true, version: '2.1.0', install: '', signedIn: true });
    expect(calls.length).toBe(1);
  });

  it('falls back to the older agent status route when the newer one is refused', async () => {
    engine((url) => url.startsWith('/api/claude-code/') ? json({ ok: false }, 404) : json({ installed: true, version: '1.0', install: 'npm i', signedIn: false }));
    expect(await api.claudeCodeStatus()).toEqual({ installed: true, version: '1.0', install: 'npm i', signedIn: false });
  });

  it('refuses a batch preview with the engine message', async () => {
    engine(() => json({ error: 'Cannot read that picture.' }, 415));
    const e = await refusal(api.batchPreviewUrl('/p/x.heic', [], 512));
    expect([e.message, e.status]).toEqual(['Cannot read that picture.', 415]);
  });
});

describe('engine URLs built for the page', () => {
  it('builds a thumbnail URL whose query reads back to the same path, size and stamp', () => {
    const u = new URL(api.thumbUrl('C:\\Shots\\a b#1.jpg', 256, 7), 'http://x');
    expect(u.pathname).toBe('/api/image/thumb');
    expect(Object.fromEntries(u.searchParams)).toEqual({ path: 'C:\\Shots\\a b#1.jpg', size: '256', v: '7' });
  });

  it('builds view, raw and stream URLs that round trip the path', () => {
    const p = '/m/100% sure?.mov';
    for (const url of [api.viewUrl(p), api.rawUrl(p), api.streamUrl(p), api.mediaThumbUrl(p, 64)]) {
      expect(new URL(url, 'http://x').searchParams.get('path')).toBe(p);
    }
  });

  it('names an external subtitle file in its own query field', () => {
    const q = new URL(api.subtitleFileUrl('/m/a.mkv', '/m/a.en.srt'), 'http://x').searchParams;
    expect([q.get('path'), q.get('file')]).toEqual(['/m/a.mkv', '/m/a.en.srt']);
  });
});

describe('window key', () => {
  it('uses a key handed over by the desktop shell and attaches it to every request', async () => {
    (window as unknown as { __FORMTOOLS_WINDOW_KEY?: string }).__FORMTOOLS_WINDOW_KEY = 'k-given';
    await loadWindowKey();
    expect(windowKey()).toBe('k-given');
    expect((window as unknown as { __FORMTOOLS_WINDOW_KEY?: string }).__FORMTOOLS_WINDOW_KEY).toBeUndefined();
    const { calls } = engine(() => json({ ok: true, app: 'formtools', version: '0.14.0' }));
    await api.health();
    expect(new Headers(calls[0].init.headers).get('X-Formtools-Window-Key')).toBe('k-given');
  });

  it('asks the engine for a new key when none is stored and remembers it for the tab', async () => {
    const { calls } = engine((url) => url === '/api/window/key' ? json({ key: 'k-new' }) : json({}, 401));
    await loadWindowKey();
    expect(windowKey()).toBe('k-new');
    expect(calls.map((c) => [c.url, c.init.method])).toEqual([['/api/window/key', 'POST']]);
    expect(sessionStorage.getItem('formtools-window-key')).toBe('k-new');
  });

  it('keeps a stored key the engine still accepts without asking for a new one', async () => {
    sessionStorage.setItem('formtools-window-key', 'k-old');
    const { calls } = engine(() => json({ terminals: [] }));
    await loadWindowKey();
    expect(windowKey()).toBe('k-old');
    expect(calls.map((c) => c.url)).toEqual(['/api/terminal']);
    expect(new Headers(calls[0].init.headers).get('X-Formtools-Window-Key')).toBe('k-old');
  });

  it('replaces a stored key the engine no longer accepts', async () => {
    sessionStorage.setItem('formtools-window-key', 'k-stale');
    engine((url) => url === '/api/window/key' ? json({ key: 'k-fresh' }) : json({ error: 'bad key' }, 403));
    await loadWindowKey();
    expect(windowKey()).toBe('k-fresh');
    expect(sessionStorage.getItem('formtools-window-key')).toBe('k-fresh');
  });

  it('sends requests without the key header when there is no key', () => {
    expect(windowKey()).toBe('');
    expect(new Headers(keyed({ headers: { A: 'b' } }).headers).has('X-Formtools-Window-Key')).toBe(false);
  });
});

describe('desktop and file tool clients', () => {
  it('explains that the desktop tool is missing when the engine has no such route', async () => {
    engine(() => new Response('Not Found', { status: 404 }));
    const e = await refusal(desktopApi.hosts());
    expect(e.status).toBe(404);
    expect(e.message).toMatch(/does not include the desktop tool/);
  });

  it('passes on the engine message for a refused hosts save', async () => {
    engine(() => json({ ok: false, error: 'The hosts file changed on disk.' }, 409));
    const e = await refusal(desktopApi.saveHosts([], 'v1'));
    expect([e.message, e.status]).toEqual(['The hosts file changed on disk.', 409]);
  });

  it('sends the version only when one is known when saving hosts', async () => {
    const { calls } = engine(() => json({ ok: true, backup: '/b', elevated: false }));
    const entry = { enabled: true, address: '127.0.0.1', names: ['a.test'], comment: '' };
    await desktopApi.saveHosts([entry]);
    await desktopApi.saveHosts([entry], 'v2');
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ entries: [entry] });
    expect(JSON.parse(String(calls[1].init.body))).toEqual({ entries: [entry], version: 'v2' });
  });

  it('sends a null value to remove an environment variable', async () => {
    const { calls } = engine(() => json({ ok: true }));
    await desktopApi.setEnv('user', 'FOO', null);
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ scope: 'user', name: 'FOO', value: null });
  });

  it('leaves the name out of a template create when none is given', async () => {
    const { calls } = engine(() => json({ ok: true, path: '/d/x' }));
    await utilApi.templateCreate('Note.txt', '/d');
    await utilApi.templateCreate('Note.txt', '/d', 'Mine.txt');
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ template: 'Note.txt', folder: '/d' });
    expect(JSON.parse(String(calls[1].init.body))).toEqual({ template: 'Note.txt', folder: '/d', name: 'Mine.txt' });
  });

  it('asks who holds a file open with the path escaped in the query', async () => {
    const { calls } = engine(() => json({ supported: true, holders: [] }));
    await utilApi.locks('/x/a&b.txt');
    expect(new URL(calls[0].url, 'http://x').searchParams.get('path')).toBe('/x/a&b.txt');
  });

  it('refuses a trash request with the engine message', async () => {
    engine(() => json({ ok: false, error: 'Nothing to trash.' }, 400));
    await expect(utilApi.trash([])).rejects.toThrow('Nothing to trash.');
  });
});

describe('byte sizes and path names', () => {
  it('shows sizes under one kibibyte in bytes', () => {
    expect(fmtBytes(0)).toBe('0 B');
    expect(fmtBytes(1023)).toBe('1023 B');
  });

  it('shows 1536 bytes as 1.5 KB', () => {
    expect(fmtBytes(1536)).toBe('1.5 KB');
  });

  it('drops the decimal from 100 units upward', () => {
    expect(fmtBytes(150 * 1024 * 1024)).toBe('150 MB');
    expect(fmtBytes(99.5 * 1024)).toBe('99.5 KB');
  });

  it('stops at terabytes for very large sizes', () => {
    expect(fmtBytes(2048 * 1024 ** 4)).toBe('2048 TB');
  });

  it('shows a negative or unknown size as 0 B', () => {
    expect(fmtBytes(-5)).toBe('0 B');
    expect(fmtBytes(Number.NaN)).toBe('0 B');
  });

  it('takes the last name of a path with either separator and a trailing one', () => {
    expect(baseName('/a/b/c.txt')).toBe('c.txt');
    expect(baseName('C:\\Users\\me\\Pics\\')).toBe('Pics');
  });

  it('takes the folder of a path', () => {
    expect(dirName('/a/b/c.txt')).toBe('/a/b');
    expect(dirName('C:\\x\\y.png')).toBe('C:\\x');
  });
});

describe('desktop shell outside the desktop app', () => {
  it('knows it is not in the desktop app', () => {
    expect(inDesktop()).toBe(false);
  });

  it('answers null for every shell request in a browser', async () => {
    expect(await host.pickFolder()).toBeNull();
    expect(await host.pickFiles()).toBeNull();
    expect(await host.menuStatus()).toBeNull();
  });

  it('refuses a desk tool in a browser with a message saying where it works', async () => {
    await expect(desk.caps()).rejects.toThrow('This works in the desktop app.');
    await expect(desk.start('ruler')).rejects.toThrow('desktop app');
  });

  it('copies text through the browser clipboard outside the desktop app', async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    await desk.copyText('#FF0000');
    expect(writeText).toHaveBeenCalledWith('#FF0000');
  });
});

describe('desk overlay parameters', () => {
  it('reads the tool, shot, monitor, scale and options from the page query', () => {
    const q = `?tool=ruler&shot=${encodeURIComponent('/tmp/s.png')}&monitor=2&scale=1.5&options=${encodeURIComponent(JSON.stringify({ unit: 'px' }))}`;
    expect(overlayParams(q)).toEqual({ tool: 'ruler', shot: '/tmp/s.png', monitor: 2, scale: 1.5, options: { unit: 'px' } });
  });

  it('falls back to the picker at scale 1 with no options for an empty query', () => {
    expect(overlayParams('')).toEqual({ tool: 'picker', shot: '', monitor: 0, scale: 1, options: {} });
  });

  it('ignores options that are not valid JSON and a zero scale', () => {
    const p = overlayParams('?tool=zoom&scale=0&options=%7Bbroken');
    expect([p.scale, p.options]).toEqual([1, {}]);
  });
});

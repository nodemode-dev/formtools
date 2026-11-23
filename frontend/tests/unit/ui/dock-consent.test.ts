import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConsentChoice, ConsentHost, ConsentRequest } from '../../../src/dock/adapter';
import { Consent } from '../../../src/dock/consent';
import { click, settle } from './support';

interface Rig { consent: Consent; add: (r: ConsentRequest) => void; withdraw: (id: string) => void; answer: ReturnType<typeof vi.fn>; changes: boolean[] }

const rig = (opts: { changedOutside?: boolean; answer?: (id: string, c: ConsentChoice) => Promise<void> } = {}): Rig => {
  let add: (r: ConsentRequest) => void = () => undefined;
  let withdraw: (id: string) => void = () => undefined;
  const answer = vi.fn(opts.answer ?? (async () => undefined));
  const host: ConsentHost = {
    words: { app: 'FormTools', noun: 'files', lead: '', example: '' },
    t: (_k: string, english: string) => english,
    classes: { iconButton: 'ib', button: 'b', primaryButton: 'pb', input: 'i', select: 's', note: 'n' },
    consent: { subscribe: (a, w) => { add = a; withdraw = w; }, answer },
    storedChoice: { get: async () => ({ value: 'ask', changedOutside: opts.changedOutside === true }), set: async () => undefined },
  };
  const consent = new Consent(host);
  const changes: boolean[] = [];
  consent.onChange = (open) => changes.push(open);
  return { consent, add: (r) => add(r), withdraw: (id) => withdraw(id), answer, changes };
};

const req = (over: Partial<ConsentRequest> = {}): ConsentRequest => ({ id: 'r1', agent: 'Scout', what: 'rename 3 files', offers: ['deny', 'once', 'always'], always: 'agent', ...over });
const dlg = (): HTMLDialogElement => {
  const d = document.querySelector<HTMLDialogElement>('dialog.ft-consent');
  if (!d) throw new Error('no consent dialog');
  return d;
};
const shown = (sel: string): string => dlg().querySelector(sel)?.textContent ?? '';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(async () => {
  await vi.advanceTimersByTimeAsync(2000);
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('the outside agent consent dialog', () => {
  it('opens as a modal naming the agent, what it asked and the app', async () => {
    const r = rig();
    r.add(req());
    await settle(0);
    expect(r.consent.isOpen()).toBe(true);
    expect(shown('.ft-consent-title')).toBe('Allow an agent calling itself Scout to make changes in FormTools?');
    expect(shown('.ft-consent-what')).toBe('It asked to rename 3 files.');
    expect(shown('.ft-consent-always')).toBe('Always allow any agent named Scout');
    expect(shown('.ft-consent-count')).toBe('Request 1 of 1');
    expect(r.changes).toEqual([true]);
  });

  it('an unnamed agent and an all-agents scope get their own wording', async () => {
    const r = rig();
    r.add(req({ agent: '', always: 'all' }));
    await settle(0);
    expect(shown('.ft-consent-title')).toBe('Allow an outside agent to make changes in FormTools?');
    expect(shown('.ft-consent-always')).toBe('Always allow all outside agents');
  });

  it('shows only the choices the request offers', async () => {
    const r = rig();
    r.add(req({ offers: ['deny', 'once'] }));
    await settle(0);
    const hidden = (c: string): boolean => (dlg().querySelector<HTMLElement>(`.ft-consent-${c}`) as HTMLElement).hidden === true;
    expect([hidden('deny'), hidden('once'), hidden('always')]).toEqual([false, false, true]);
  });

  it('a second waiting request is counted, and answering the first sends that answer and shows the next', async () => {
    const r = rig();
    r.add(req());
    r.add(req({ id: 'r2', agent: 'Helper', what: 'delete a folder' }));
    r.add(req());
    await settle(0);
    expect(r.consent.waiting).toBe(2);
    expect(shown('.ft-consent-count')).toBe('Request 1 of 2');
    click(dlg().querySelector('.ft-consent-once'));
    await settle(0);
    expect(r.answer).toHaveBeenCalledWith('r1', 'once');
    expect(shown('.ft-consent-what')).toBe('It asked to delete a folder.');
    expect(shown('.ft-consent-count')).toBe('Request 1 of 1');
  });

  it('answering the last request closes the dialog and reports it closed', async () => {
    const r = rig();
    r.add(req());
    await settle(0);
    click(dlg().querySelector('.ft-consent-deny'));
    await settle(0);
    expect(r.answer).toHaveBeenCalledWith('r1', 'deny');
    expect(r.consent.isOpen()).toBe(false);
    expect(r.consent.waiting).toBe(0);
    expect(r.changes).toEqual([true, false]);
  });

  it('a request withdrawn by the engine leaves without an answer being sent', async () => {
    const r = rig();
    r.add(req());
    await settle(0);
    r.withdraw('r1');
    await settle(0);
    expect(r.consent.isOpen()).toBe(false);
    expect(r.answer).not.toHaveBeenCalled();
  });

  it('a request past its expiry time is dropped on its own', async () => {
    const r = rig();
    r.add(req({ expires: Date.now() + 1000 }));
    await settle(0);
    expect(r.consent.isOpen()).toBe(true);
    await settle(1000);
    expect(r.consent.waiting).toBe(0);
    expect(r.consent.isOpen()).toBe(false);
  });

  it('notes are listed line by line and hidden when the next request has none', async () => {
    const r = rig();
    r.add(req({ notes: ['first note', 'second note'] }));
    r.add(req({ id: 'r2' }));
    await settle(0);
    const notes = dlg().querySelector<HTMLElement>('.ft-consent-notes') as HTMLElement;
    expect([...notes.children].map((n) => n.textContent)).toEqual(['first note', 'second note']);
    expect(notes.hidden).toBe(false);
    click(dlg().querySelector('.ft-consent-once'));
    await settle(0);
    expect(notes.hidden).toBe(true);
  });

  it('says the stored choice was changed outside the app when that happened', async () => {
    const r = rig({ changedOutside: true });
    r.add(req());
    await settle(0);
    const notice = dlg().querySelector<HTMLElement>('.ft-consent-notice') as HTMLElement;
    expect(notice.hidden).toBe(false);
    expect(notice.textContent).toBe('The Outside agents setting was changed outside FormTools, so FormTools asks again.');
  });

  it('a choice the request does not offer is not sent', async () => {
    const r = rig();
    r.add(req({ offers: ['deny', 'once'] }));
    await settle(0);
    click(dlg().querySelector('.ft-consent-always'));
    await settle(0);
    expect(r.answer).not.toHaveBeenCalled();
    expect(r.consent.waiting).toBe(1);
  });
});

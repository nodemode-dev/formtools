import { desktopApi, type HostEntry } from '../../io/desktop-api';
import { el, patchList, q, setChecked, setClass, setDisabled, setText, setTitle, setValue } from '../dom';
import { icon } from '../icons';
import { toast } from '../toast';
import { armButton, btn, DeskSection, type DeskDeps } from './common';

interface Row { key: string; line?: number; enabled: boolean; address: string; names: string; comment: string; touched: boolean }

const OCTET = '(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)';
const IPV4 = new RegExp(`^${OCTET}(\\.${OCTET}){3}$`);
const LABEL = '[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?';
const NAME = new RegExp(`^${LABEL}(\\.${LABEL})*$`);

export function validAddress(raw: string): boolean {
  if (IPV4.test(raw)) return true;
  const [a, zone, extra] = raw.split('%');
  if (extra !== undefined || (zone !== undefined && !/^[^\s/]+$/.test(zone))) return false;
  if (!a.includes(':') || !/^[0-9A-Fa-f:.]+$/.test(a)) return false;
  try { return new URL(`http://[${a}]/`).hostname !== ''; } catch { return false; }
}

export const tokens = (s: string): string[] => s.split(/[\s,]+/).filter(Boolean);

export function rowProblem(r: Row): string {
  const address = r.address.trim();
  if (!address) return 'Enter an IPv4 or IPv6 address.';
  if (!validAddress(address)) return `${address} is not an IPv4 or IPv6 address.`;
  const names = tokens(r.names);
  if (!names.length) return 'Add at least one host name.';
  for (const n of names) if (n.length > 253 || !NAME.test(n)) return `${n.length > 40 ? `${n.slice(0, 40)}...` : n} is not a valid host name.`;
  return '';
}

const blank = (r: Row): boolean => r.line === undefined && !r.address.trim() && !r.names.trim() && !r.comment.trim();

export class HostsSection extends DeskSection {
  private rows: Row[] = [];
  private baseline = '';
  private writable = true;
  private loaded = false;
  private loading = false;
  private saving = false;
  private serial = 0;
  private readonly list: HTMLElement;
  private readonly save: HTMLButtonElement;

  constructor(deps: DeskDeps) {
    super('hosts', 'Hosts file', 'ftHosts', 'The hosts file editor runs in the desktop app. Open formtools there to review and change which names point where.', `
        <div class="ft-desk-actions">
          ${btn('add', 'plus', 'Add an entry')}
          ${btn('reload', 'refresh', 'Reload')}
          ${btn('save', 'save', 'Save', true)}
          <span class="ft-desk-state ft-desk-hstate" role="status"></span>
        </div>
        <p class="ft-desk-path ft-mono"></p>
        <p class="ft-note ft-desk-hnote"></p>
        <div class="ft-desk-hgrid ft-desk-hhead" aria-hidden="true"><span>On</span><span>Address</span><span>Host names</span><span>Comment</span><span></span></div>
        <div class="ft-desk-hlist" role="list"></div>
        <p class="ft-desk-empty-row ft-note" hidden>No entries yet. Add one to point a name at an address.</p>
        <p class="ft-desk-err" role="alert"></p>
        <p class="ft-note ft-desk-backup"></p>`, deps);
    this.list = q(this.root, '.ft-desk-hlist');
    this.save = q<HTMLButtonElement>(this.root, '[data-act="save"]');
    this.list.addEventListener('input', (e) => this.edit(e.target));
    this.list.addEventListener('change', (e) => this.edit(e.target));
    this.list.addEventListener('focusout', (e) => {
      const key = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-key]')?.dataset.key : undefined;
      const row = this.rows.find((r) => r.key === key);
      const node = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-key]') : null;
      if (row && node && !row.touched) { row.touched = true; this.checkRow(node, row); }
    });
    this.list.addEventListener('click', (e) => {
      const node = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-key]') : null;
      if (node && e.target instanceof Element && e.target.closest('[data-f="remove"]')) {
        this.rows = this.rows.filter((r) => r.key !== node.dataset.key);
        this.render();
        this.sync();
      }
    });
    q(this.root, '[data-act="add"]').addEventListener('click', () => this.add());
    const reload = q<HTMLButtonElement>(this.root, '[data-act="reload"]');
    armButton(reload, () => this.dirty(), () => 'Discard changes?', () => void this.load());
    armButton(this.save, () => !this.writable, () => 'Write as administrator?', () => void this.commit());
  }

  override shown(): void { if (this.supported && !this.loaded && !this.loading) void this.load(); }

  private key(): string { this.serial += 1; return `h${this.serial}`; }

  private payload(): Row[] { return this.rows.filter((r) => !blank(r)); }

  private signature(rows: Row[]): string {
    return JSON.stringify(rows.filter((r) => !blank(r)).map((r) => [r.line ?? null, r.enabled, r.address.trim(), tokens(r.names), r.comment.trim()]));
  }

  private dirty(): boolean { return this.loaded && this.signature(this.rows) !== this.baseline; }

  private valid(): boolean { return this.payload().every((r) => rowProblem(r) === ''); }

  private fromEntries(entries: HostEntry[]): Row[] {
    const free = new Map<string, Row[]>();
    for (const r of this.rows) {
      const sig = `${r.address.trim()}|${tokens(r.names).join(' ')}`;
      free.set(sig, [...(free.get(sig) ?? []), r]);
    }
    return entries.map((en) => {
      const sig = `${en.address}|${en.names.join(' ')}`;
      const reuse = free.get(sig)?.shift();
      return { key: reuse?.key ?? this.key(), line: en.line, enabled: en.enabled, address: en.address, names: en.names.join(' '), comment: en.comment ?? '', touched: true };
    });
  }

  private async load(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    this.sync();
    const state = q(this.root, '.ft-desk-hstate');
    setText(state, 'Reading the file');
    try {
      const info = await desktopApi.hosts();
      this.writable = info.writable;
      this.rows = this.fromEntries(info.entries);
      this.baseline = this.signature(this.rows);
      this.loaded = true;
      setText(q(this.root, '.ft-desk-path'), info.path);
      setTitle(q(this.root, '.ft-desk-path'), info.path);
      setText(q(this.root, '.ft-desk-hnote'), info.writable
        ? 'Changes are written straight to this file. A dated backup is saved first.'
        : 'This file needs administrator rights to change. When you save, formtools asks the system for them. A dated backup is saved first.');
      setText(q(this.root, '.ft-desk-err'), '');
      this.render();
    } catch (e) {
      const t = e instanceof Error ? e.message : 'The hosts file could not be read.';
      setText(q(this.root, '.ft-desk-err'), t);
      toast(t, 'error');
    }
    this.loading = false;
    this.sync();
  }

  private add(): void {
    const row: Row = { key: this.key(), enabled: true, address: '', names: '', comment: '', touched: false };
    this.rows = [...this.rows, row];
    this.render();
    this.sync();
    const node = this.list.querySelector<HTMLElement>(`[data-key="${row.key}"]`);
    node?.scrollIntoView({ block: 'nearest' });
    node?.querySelector<HTMLInputElement>('[data-f="address"]')?.focus({ preventScroll: true });
  }

  private edit(t: EventTarget | null): void {
    if (!(t instanceof HTMLInputElement)) return;
    const node = t.closest<HTMLElement>('[data-key]');
    const row = this.rows.find((r) => r.key === node?.dataset.key);
    const field = t.dataset.f;
    if (!node || !row || !field) return;
    if (field === 'enabled') row.enabled = t.checked;
    else if (field === 'address') row.address = t.value;
    else if (field === 'names') row.names = t.value;
    else if (field === 'comment') row.comment = t.value;
    else return;
    if (field !== 'enabled' && t.value) row.touched = true;
    this.checkRow(node, row);
    this.sync();
  }

  private checkRow(node: HTMLElement, row: Row): void {
    const problem = blank(row) || !row.touched ? '' : rowProblem(row);
    setText(q(node, '.ft-desk-rowmsg'), problem);
    setClass(node, 'is-bad', problem !== '');
  }

  private render(): void {
    patchList(this.list, this.rows, {
      key: (r) => r.key,
      create: (r) => {
        const n = el<HTMLElement>(`<div class="ft-desk-hrow" role="listitem">
            <input type="checkbox" class="ft-check" data-f="enabled" aria-label="Enabled">
            <input type="text" class="ft-input ft-mono" data-f="address" spellcheck="false" autocomplete="off" placeholder="127.0.0.1" aria-label="Address">
            <input type="text" class="ft-input ft-mono" data-f="names" spellcheck="false" autocomplete="off" placeholder="example.test www.example.test" aria-label="Host names">
            <input type="text" class="ft-input" data-f="comment" spellcheck="false" autocomplete="off" placeholder="Comment" aria-label="Comment">
            <button class="ft-icon-x" type="button" data-f="remove" title="Remove this entry" aria-label="Remove this entry">${icon('close', 12)}</button>
            <span class="ft-desk-rowmsg" role="status"></span>
          </div>`);
        this.fill(n, r);
        return n;
      },
      update: (n, r) => this.fill(n, r),
    });
    const empty = q(this.root, '.ft-desk-empty-row');
    if (empty.hidden !== (this.rows.length > 0)) empty.hidden = this.rows.length > 0;
  }

  private fill(n: HTMLElement, r: Row): void {
    setChecked(q<HTMLInputElement>(n, '[data-f="enabled"]'), r.enabled);
    setValue(q<HTMLInputElement>(n, '[data-f="address"]'), r.address);
    setValue(q<HTMLInputElement>(n, '[data-f="names"]'), r.names);
    setValue(q<HTMLInputElement>(n, '[data-f="comment"]'), r.comment);
    this.checkRow(n, r);
  }

  private sync(): void {
    const dirty = this.dirty();
    const ok = this.valid();
    setDisabled(this.save, !dirty || !ok || this.saving || this.loading);
    setDisabled(q<HTMLButtonElement>(this.root, '[data-act="add"]'), !this.loaded || this.saving);
    setDisabled(q<HTMLButtonElement>(this.root, '[data-act="reload"]'), this.loading || this.saving);
    const n = this.payload().length;
    setText(q(this.root, '.ft-desk-hstate'), this.loading ? 'Reading the file' : this.saving ? 'Saving' : !this.loaded ? '' : `${n} ${n === 1 ? 'entry' : 'entries'}${dirty ? ', not saved' : ''}`);
  }

  private async commit(): Promise<void> {
    if (this.saving || !this.valid()) return;
    this.saving = true;
    this.sync();
    const err = q(this.root, '.ft-desk-err');
    setText(err, '');
    const entries: HostEntry[] = this.payload().map((r) => {
      const e: HostEntry = { enabled: r.enabled, address: r.address.trim(), names: tokens(r.names), comment: r.comment.trim() };
      if (r.line !== undefined) e.line = r.line;
      return e;
    });
    try {
      const r = await desktopApi.saveHosts(entries);
      setText(q(this.root, '.ft-desk-backup'), r.backup ? `Backup saved to ${r.backup}${r.elevated ? '. Written with administrator rights.' : '.'}` : '');
      this.deps.status('The hosts file was saved.');
      toast('The hosts file was saved.');
      this.saving = false;
      this.loaded = false;
      await this.load();
      return;
    } catch (e) {
      const t = e instanceof Error ? e.message : 'The hosts file was not saved.';
      setText(err, t);
      toast(t, 'error');
    }
    this.saving = false;
    this.sync();
  }
}

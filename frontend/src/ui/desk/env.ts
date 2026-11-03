import { desktopApi, type EnvScope, type EnvScopeId } from '../../io/desktop-api';
import { el, patchList, q, setClass, setDisabled, setHidden, setText, setValue } from '../dom';
import { toast } from '../toast';
import { confirmButton } from '../utilities/common';
import { armButton, btn, DeskSection, type DeskDeps } from './common';

const SCOPES: Array<[EnvScopeId, string]> = [['process', 'This app'], ['user', 'User'], ['system', 'System']];
const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

export class EnvSection extends DeskSection {
  private scopes: EnvScope[] = [];
  private scopeId: EnvScopeId = 'process';
  private readonly drafts = new Map<string, string>();
  private loaded = false;
  private loading = false;
  private busy = false;
  private readonly list: HTMLElement;

  constructor(deps: DeskDeps) {
    super('env', 'Environment variables', 'ftEnv', 'The environment variable editor runs in the desktop app. Open formtools there to read and change variables.', `
        <div class="ft-desk-actions">
          <nav class="ft-seg" aria-label="Where the variables live">${SCOPES.map(([id, label]) => `<button type="button" class="ft-seg-btn" data-scope="${id}" disabled>${label}</button>`).join('')}</nav>
          <input type="search" class="ft-input ft-desk-filter" placeholder="Filter" spellcheck="false" aria-label="Filter the variables">
          ${btn('reload', 'refresh', 'Reload')}
          <span class="ft-desk-state ft-desk-estate" role="status"></span>
        </div>
        <p class="ft-note ft-desk-where"></p>
        <div class="ft-desk-eadd">
          <input type="text" class="ft-input ft-mono" data-add="name" placeholder="NAME" spellcheck="false" autocomplete="off" aria-label="New variable name">
          <input type="text" class="ft-input ft-mono" data-add="value" placeholder="value" spellcheck="false" autocomplete="off" aria-label="New variable value">
          ${btn('add', 'plus', 'Add')}
          <span class="ft-desk-rowmsg" data-add="msg" role="status"></span>
        </div>
        <div class="ft-desk-elist" role="list"></div>
        <p class="ft-note ft-desk-eempty" hidden></p>
        <p class="ft-desk-err" role="alert"></p>`, deps);
    this.list = q(this.root, '.ft-desk-elist');
    this.root.addEventListener('click', (e) => {
      const t = e.target instanceof Element ? e.target : null;
      const sc = t?.closest<HTMLElement>('[data-scope]')?.dataset.scope as EnvScopeId | undefined;
      if (sc) { this.scopeId = sc; this.paint(); }
    });
    q(this.root, '.ft-desk-filter').addEventListener('input', () => this.paint());
    const reload = q<HTMLButtonElement>(this.root, '[data-act="reload"]');
    reload.addEventListener('click', () => void this.load());
    const name = q<HTMLInputElement>(this.root, '[data-add="name"]');
    const value = q<HTMLInputElement>(this.root, '[data-add="value"]');
    const add = q<HTMLButtonElement>(this.root, '[data-act="add"]');
    name.addEventListener('input', () => this.checkAdd());
    for (const f of [name, value]) f.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !add.disabled) { e.preventDefault(); add.click(); } });
    armButton(add, () => this.scopeId === 'system', () => 'Sure?', () => void this.write(name.value.trim(), value.value, () => { name.value = ''; value.value = ''; this.checkAdd(); }));
    this.list.addEventListener('input', (e) => {
      const t = e.target;
      const node = t instanceof HTMLInputElement ? t.closest<HTMLElement>('[data-key]') : null;
      if (!node || !(t instanceof HTMLInputElement)) return;
      const k = this.draftKey(node.dataset.key ?? '');
      const stored = this.stored(node.dataset.key ?? '');
      if (t.value === stored) this.drafts.delete(k); else this.drafts.set(k, t.value);
      this.rowState(node);
    });
    this.checkAdd();
  }

  override shown(): void { if (this.supported && !this.loaded && !this.loading) void this.load(); }

  private scope(): EnvScope | undefined { return this.scopes.find((s) => s.id === this.scopeId); }

  private draftKey(name: string): string { return `${this.scopeId}\u0000${name}`; }

  private stored(name: string): string { return this.scope()?.vars.find((v) => v.name === name)?.value ?? ''; }

  private async load(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    setText(q(this.root, '.ft-desk-estate'), 'Reading');
    try {
      const r = await desktopApi.env();
      this.scopes = r.scopes;
      if (!this.scope()) this.scopeId = r.scopes[0]?.id ?? 'process';
      for (const [k, v] of Array.from(this.drafts)) {
        const [sid, name] = k.split('\u0000');
        const hit = r.scopes.find((s) => s.id === sid)?.vars.find((x) => x.name === name);
        if (hit && hit.value === v) this.drafts.delete(k);
      }
      this.loaded = true;
      setText(q(this.root, '.ft-desk-err'), '');
    } catch (e) {
      const t = e instanceof Error ? e.message : 'The variables could not be read.';
      setText(q(this.root, '.ft-desk-err'), t);
      toast(t, 'error');
    }
    this.loading = false;
    this.paint();
  }

  private paint(): void {
    const sc = this.scope();
    for (const b of this.root.querySelectorAll<HTMLButtonElement>('[data-scope]')) {
      const has = this.scopes.some((s) => s.id === b.dataset.scope);
      setDisabled(b, !has);
      setClass(b, 'is-on', b.dataset.scope === this.scopeId);
    }
    setText(q(this.root, '.ft-desk-where'), sc ? sc.where : '');
    const needle = q<HTMLInputElement>(this.root, '.ft-desk-filter').value.trim().toLowerCase();
    const vars = [...(sc?.vars ?? [])].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()) || a.name.localeCompare(b.name));
    patchList(this.list, vars, {
      key: (v) => v.name,
      create: (v) => {
        const n = el<HTMLElement>(`<div class="ft-desk-erow" role="listitem">
            <span class="ft-desk-ename ft-mono"></span>
            <input type="text" class="ft-input ft-mono" data-f="value" spellcheck="false" autocomplete="off" aria-label="Value">
            <button class="ft-btn" type="button" data-f="save"><span class="ft-u-btn-label">Save</span></button>
            <button class="ft-btn" type="button" data-f="remove"><span class="ft-u-btn-label">Remove</span></button>
          </div>`);
        const name = (): string => n.dataset.key ?? '';
        armButton(q<HTMLButtonElement>(n, '[data-f="save"]'), () => this.scopeId === 'system', () => 'Sure?', () => void this.write(name(),q<HTMLInputElement>(n, '[data-f="value"]').value));
        confirmButton(q<HTMLButtonElement>(n, '[data-f="remove"]'), () => 'Remove it?', () => void this.remove(name()));
        n.addEventListener('keydown', (e) => {
          const save = q<HTMLButtonElement>(n, '[data-f="save"]');
          if (e.key === 'Enter' && e.target instanceof HTMLInputElement && !save.disabled) { e.preventDefault(); save.click(); }
        });
        setText(q(n, '.ft-desk-ename'), v.name);
        n.title = v.name;
        return n;
      },
      update: () => undefined,
    });
    let shown = 0;
    for (const n of Array.from(this.list.children) as HTMLElement[]) {
      const name = n.dataset.key ?? '';
      const stored = this.stored(name);
      const draft = this.drafts.get(this.draftKey(name));
      setValue(q<HTMLInputElement>(n, '[data-f="value"]'), draft ?? stored);
      const hide = needle !== '' && !name.toLowerCase().includes(needle) && !stored.toLowerCase().includes(needle);
      setHidden(n, hide);
      if (!hide) shown += 1;
      this.rowState(n);
    }
    setText(q(this.root, '.ft-desk-estate'), this.loading ? 'Reading' : this.loaded ? `${shown} of ${vars.length}` : '');
    const empty = q(this.root, '.ft-desk-eempty');
    setText(empty, vars.length === 0 && this.loaded ? 'There are no variables here.' : shown === 0 && vars.length > 0 ? 'No variable matches the filter.' : '');
    setHidden(empty, !(this.loaded && shown === 0));
    this.checkAdd();
  }

  private rowState(n: HTMLElement): void {
    const sc = this.scope();
    const editable = sc?.editable === true && !this.busy;
    const input = q<HTMLInputElement>(n, '[data-f="value"]');
    if (input.readOnly !== !(sc?.editable === true)) input.readOnly = !(sc?.editable === true);
    const name = n.dataset.key ?? '';
    const changed = this.drafts.has(this.draftKey(name));
    setClass(n, 'is-changed', changed);
    setDisabled(q<HTMLButtonElement>(n, '[data-f="save"]'), !editable || !changed);
    setDisabled(q<HTMLButtonElement>(n, '[data-f="remove"]'), !editable);
  }

  private checkAdd(): void {
    const sc = this.scope();
    const name = q<HTMLInputElement>(this.root, '[data-add="name"]');
    const value = q<HTMLInputElement>(this.root, '[data-add="value"]');
    const editable = sc?.editable === true && !this.busy;
    setDisabled(name, !editable);
    setDisabled(value, !editable);
    const text = name.value.trim();
    let problem = '';
    if (text && !NAME.test(text)) problem = 'Names use letters, digits and underscores, and do not start with a digit.';
    else if (text && sc?.vars.some((v) => v.name === text)) problem = 'That name is already set. Change its value in the list.';
    setText(q(this.root, '[data-add="msg"]'), problem);
    setClass(q(this.root, '[data-add="msg"]'), 'is-bad', problem !== '');
    setDisabled(q<HTMLButtonElement>(this.root, '[data-act="add"]'), !editable || text === '' || problem !== '');
  }

  private async write(name: string, value: string, done?: () => void): Promise<void> {
    await this.send(name, value, done, `Set ${name}.`);
  }

  private async remove(name: string): Promise<void> {
    await this.send(name, null, undefined, `Removed ${name}.`);
  }

  private async send(name: string, value: string | null, done: (() => void) | undefined, ok: string): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.paint();
    const scope = this.scopeId;
    try {
      await desktopApi.setEnv(scope, name, value);
      this.drafts.delete(`${scope}\u0000${name}`);
      done?.();
      this.deps.status(ok);
      toast(ok);
      setText(q(this.root, '.ft-desk-err'), '');
      this.busy = false;
      await this.load();
      return;
    } catch (e) {
      const t = e instanceof Error ? e.message : 'The variable was not changed.';
      setText(q(this.root, '.ft-desk-err'), t);
      toast(t, 'error');
    }
    this.busy = false;
    this.paint();
  }
}

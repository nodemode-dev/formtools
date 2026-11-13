import './ui/ft-icons';
import './extensions/tools';
import { api, type Entry } from './io/api';
import { host, inDesktop } from './io/host';
import { el, q, revealApp, setClass, setText } from './ui/dom';
import { icon } from './ui/icons';
import { Commands } from './ui/commands';
import { MenuBar, type MenuDef } from './ui/menu';
import { NativeMenus, wantsNativeMenus } from './ui/native-menu';
import { CaptionButtons } from './ui/caption-buttons';
import { HomeScreen } from './ui/home';
import { Browser } from './ui/browser';
import { Viewer } from './ui/viewer';
import { StatusBar } from './ui/status';
import { SettingsDialog } from './ui/settings';
import { Palette } from './ui/palette';
import { Jobs } from './ui/jobs';
import { SaveDialog } from './ui/save-dialog';
import { ToolsPage, type ToolId } from './ui/tools/page';
import { UtilitiesPage, type UtilId } from './ui/utilities/page';
import './ui/desk/icons';
import { DeskPage } from './ui/desk/page';
import { DeskPrefs } from './ui/desk/prefs';
import { ContextMenuPanel } from './ui/osmenu';
import { desk, type DeskCaps } from './io/desk';
import { addRecent, loadPrefs } from './ui/prefs';
import { applyTheme, readChoice, setTheme, THEMES } from './ui/themes';
import { toast } from './ui/toast';

type Page = 'home' | 'browse' | 'view' | 'tool' | 'util' | 'desk';

const SHELL = `
  <div class="cv-app ft-app">
    <header class="cv-titlebar ft-titlebar">
      <span class="cv-tb-doc"></span>
      <span class="cv-tb-app">formtools</span>
      <div class="cv-title-tools">
        <button class="cv-tt-btn" type="button" data-cmd="go-home" title="Home" aria-label="Home">${icon('ftHome', 16)}</button>
        <button class="cv-tt-btn" type="button" data-cmd="palette" title="Commands" aria-label="Commands">${icon('search', 16)}</button>
        <button class="cv-tt-btn" type="button" data-cmd="toggle-light" title="Light or dark" aria-label="Light or dark">${icon('theme', 16)}</button>
        <button class="cv-tt-btn" type="button" data-cmd="settings" title="Preferences" aria-label="Preferences">${icon('settings', 16)}</button>
      </div>
    </header>
    <main class="ft-stage-area"></main>
  </div>`;

export function startApp(): void {
  applyTheme();
  const app = document.getElementById('app')!;
  const overlay = document.getElementById('overlay-root')!;
  const shell = el<HTMLElement>(SHELL);
  app.appendChild(shell);
  const header = q(shell, '.cv-titlebar');
  const area = q(shell, '.ft-stage-area');
  const status = new StatusBar();
  shell.appendChild(status.root);

  const commands = new Commands();
  const settings = new SettingsDialog(commands);
  const palette = new Palette(commands);
  const jobs = new Jobs();
  const saveDialog = new SaveDialog();
  overlay.append(settings.root, palette.root, jobs.panel, saveDialog.root);
  status.mount(jobs.button);

  let page: Page = 'home';
  let lastViewerPath: string | null = null;

  const setPage = (next: Page): void => {
    page = next;
    for (const p of area.querySelectorAll<HTMLElement>('.ft-page')) { const on = p.dataset.page === next; if (p.hidden === on) p.hidden = !on; }
    home.setActive(next);
    setClass(document.documentElement, 'is-viewing', next === 'view');
    if (next !== 'view') setText(q(header, '.cv-tb-doc'), next === 'browse' ? browser.path : '');
    if (next === 'browse') browser.focus();
    if (next === 'view') viewer.focus();
    menus?.refresh();
  };

  const openPath = async (path: string): Promise<void> => {
    try {
      const listing = await api.list(path).catch(() => null);
      if (listing) { await browser.open(listing.path); setPage('browse'); addRecent(listing.path); return; }
      const parent = path.replace(/[\\/][^\\/]+$/, '') || path;
      await browser.open(parent);
      const list = await api.list(parent);
      const files = list.entries.filter((e) => e.kind === 'file');
      const i = files.findIndex((e) => e.path === path);
      if (i < 0) { toast(`Could not open ${path}.`, 'error'); return; }
      addRecent(parent);
      viewer.quick = false;
      viewer.open(files, i);
      setPage('view');
    } catch (e) {
      toast(e instanceof Error ? e.message : `Could not open ${path}.`, 'error');
    }
  };

  const openIn = (entry: Entry): void => {
    if (!inDesktop()) { toast('Open in its app works in the desktop app.'); return; }
    void host.openDefault(entry.path);
  };

  const home = new HomeScreen({
    run: (c) => commands.run(c),
    openPath: (p) => void openPath(p),
    runWith: (c, p) => runWith(c, p),
    keyOf: (c) => { const cmd = commands.get(c); return cmd ? commands.keyLabel(cmd) : ''; },
  });
  const browser = new Browser({
    openFile: (entries, i) => { viewer.quick = false; viewer.open(entries, i); setPage('view'); },
    quickLook: (entries, i) => { viewer.quick = true; viewer.open(entries, i); setPage('view'); },
    status: (t) => status.setHint(t),
    folderChanged: (p) => { if (page === 'browse') { addRecent(p); setText(q(header, '.cv-tb-doc'), p); } },
  });
  const viewer = new Viewer({
    close: (path) => { lastViewerPath = path; setPage('browse'); if (path) browser.selectPath(path); },
    status: (t) => status.setHint(t),
    title: (name) => setText(q(header, '.cv-tb-doc'), name),
    openIn,
    reveal: (p) => { if (inDesktop()) void host.reveal(p); else toast('Show in folder works in the desktop app.'); },
    tagOf: (p) => browser.tagFor(p),
    tagged: (p, t) => browser.setTag(p, t),
    saved: () => { if (browser.path) void browser.open(browser.path, true); },
    jobs,
    saveDialog,
  });
  let toolReturn: Page = 'browse';
  const selectionPaths = (): string[] => {
    const sel = browser.selection().map((e) => e.path);
    return sel.length ? sel : browser.path ? [browser.path] : [];
  };
  const folderPaths = (): string[] => {
    const sel = browser.selection();
    return sel.length && sel.every((e) => e.kind === 'dir') ? sel.map((e) => e.path) : browser.path ? [browser.path] : [];
  };
  const tools = new ToolsPage(selectionPaths, jobs, () => setPage(toolReturn), () => { if (browser.path) void browser.open(browser.path, true); });
  const openTool = (id: ToolId): void => {
    if (page !== 'tool' && page !== 'util') toolReturn = page;
    const fromViewer = page === 'view' && viewer.current ? [viewer.current.path] : null;
    const inputs = fromViewer ?? (page === 'browse' ? selectionPaths() : undefined);
    tools.show(id, inputs);
    setPage('tool');
  };
  const refreshFolder = (): void => { if (browser.path) void browser.open(browser.path, true); };
  const utilities = new UtilitiesPage({
    jobs,
    selection: selectionPaths,
    folders: () => folderPaths(),
    folder: () => browser.path,
    reveal: (p) => { if (inDesktop()) void host.reveal(p); else void navigator.clipboard.writeText(p).then(() => toast('Show in folder works in the desktop app. The path was copied.')).catch(() => toast('Show in folder works in the desktop app.')); },
    open: (p) => void openPath(p),
    changed: refreshFolder,
  }, () => setPage(toolReturn));
  const openUtil = (id: UtilId): void => {
    if (page !== 'tool' && page !== 'util') toolReturn = page;
    const fromViewer = page === 'view' && viewer.current ? [viewer.current.path] : null;
    const inputs = id === 'dupes' ? (page === 'view' || page === 'browse' ? folderPaths() : undefined) : fromViewer ?? (page === 'browse' ? selectionPaths() : undefined);
    utilities.show(id, inputs);
    setPage('util');
  };
  const deskPage = new DeskPage({ status: (t) => status.setHint(t), back: () => setPage(toolReturn) });
  const deskPrefs = new DeskPrefs();
  settings.mount('desk', deskPrefs.root, () => deskPrefs.refresh());
  const osMenu = new ContextMenuPanel();
  settings.mount('osmenu', osMenu.root, () => osMenu.refresh());
  const openDesk = (section: string): void => {
    if (page !== 'tool' && page !== 'util' && page !== 'desk') toolReturn = page;
    deskPage.show(section);
    setPage('desk');
  };
  const deskRun = (id: string): void => {
    if (!inDesktop()) { toast('The desktop utilities run in the formtools desktop app.'); return; }
    deskPage.handleShortcut(id);
  };
  const runWith = (command: string, paths: string[]): void => {
    if (!paths.length) return;
    if (page !== 'tool' && page !== 'util' && page !== 'desk') toolReturn = page;
    const batch = ({ 'tool-convert': 'convert', 'tool-resize': 'resize', 'tool-rename': 'rename' } as Record<string, ToolId>)[command];
    if (batch) { tools.show(batch, paths); setPage('tool'); return; }
    const util = ({ 'util-hash': 'hash', 'util-dupes': 'dupes', 'util-disk': 'disk', 'util-cleanup': 'cleanup' } as Record<string, UtilId>)[command];
    if (util) { utilities.show(util, paths); setPage('util'); return; }
    if (command === 'view-info') {
      void openPath(paths[0]).then(() => {
        const button = viewer.root.querySelector<HTMLElement>('[data-act="info"]');
        if (button && !button.classList.contains('is-on')) button.click();
      });
      return;
    }
    if (command === 'open-in' || command === 'reveal') {
      if (!inDesktop()) { toast(command === 'reveal' ? 'Show in folder works in the desktop app.' : 'Open in its app works in the desktop app.'); return; }
      for (const p of command === 'reveal' ? paths.slice(0, 1) : paths) void (command === 'reveal' ? host.reveal(p) : host.openDefault(p));
      return;
    }
    void openPath(paths[0]);
  };
  area.append(home.root, browser.root, viewer.root, tools.root, utilities.root, deskPage.root);

  const anyOverlay = (): boolean => settings.isOpen || palette.isOpen || saveDialog.isOpen;
  const isText = (t: EventTarget | null): boolean => t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement;

  commands.add(
    { id: 'go-home', label: 'Home', group: 'Go', description: 'Show the Home screen with every tool.', useWhen: 'Use when the person wants the start page.', keys: ['Mod+Shift+H'], run: () => setPage('home'), checked: () => page === 'home' },
    { id: 'go-browse', label: 'Browser', group: 'Go', description: 'Show the folder browser.', useWhen: 'Use when the person wants to look through a folder.', keys: ['Mod+B'], run: () => setPage('browse'), checked: () => page === 'browse' },
    { id: 'tool-convert', label: 'Batch Convert...', group: 'Tools', description: 'Convert pictures in batches with an ordered list of actions, presets and naming tokens.', useWhen: 'Use when many pictures need the same changes or a new format.', keys: ['Mod+Shift+C'], run: () => openTool('convert'), checked: () => page === 'tool' && tools.current === 'convert' },
    { id: 'tool-resize', label: 'Resize Pictures...', group: 'Tools', description: 'Resize pictures to a size, a box or a percentage.', useWhen: 'Use when pictures need to be smaller or a fixed size.', keys: ['Mod+Shift+E'], run: () => openTool('resize'), checked: () => page === 'tool' && tools.current === 'resize' },
    { id: 'tool-rename', label: 'Rename...', group: 'Tools', description: 'Rename files and folders with rules, counters, dates and a live preview.', useWhen: 'Use when many files need consistent names.', keys: ['Mod+Shift+N'], run: () => openTool('rename'), checked: () => page === 'tool' && tools.current === 'rename' },
    { id: 'util-dupes', label: 'Find Duplicates...', group: 'Tools', description: 'Find identical files or similar pictures in folders, then move chosen copies to the trash.', useWhen: 'Use when the person wants to free space taken by copies.', keys: ['Mod+Shift+D'], run: () => openUtil('dupes'), checked: () => page === 'util' && utilities.current === 'dupes' },
    { id: 'util-disk', label: 'Disk Usage...', group: 'Tools', description: 'Measure a folder and show what takes the space as a treemap.', useWhen: 'Use when the person asks what fills a disk or folder.', keys: ['Mod+Shift+U'], run: () => openUtil('disk'), checked: () => page === 'util' && utilities.current === 'disk' },
    { id: 'util-hash', label: 'Checksums...', group: 'Tools', description: 'Compute SHA-256, BLAKE3 and other checksums for many files, compare with a published value, or verify a sums file.', useWhen: 'Use when the person wants to check that a download or copy is intact.', run: () => openUtil('hash'), checked: () => page === 'util' && utilities.current === 'hash' },
    { id: 'util-cleanup', label: 'Clean Up...', group: 'Tools', description: 'Find empty folders and broken pictures or media files.', useWhen: 'Use when the person wants to tidy a folder tree.', run: () => openUtil('cleanup'), checked: () => page === 'util' && utilities.current === 'cleanup' },
    { id: 'util-templates', label: 'New from Template...', group: 'File', description: 'Create a file or folder from a template in the current folder.', useWhen: 'Use when the person wants a new starter file or project folder.', keys: ['Mod+Alt+N'], run: () => openUtil('templates'), checked: () => page === 'util' && utilities.current === 'templates' },
    { id: 'util-locks', label: 'Who Has This Open...', group: 'Tools', description: 'List the programs that hold a file open.', useWhen: 'Use when a file will not delete, move or rename.', run: () => openUtil('locks'), checked: () => page === 'util' && utilities.current === 'locks' },
    { id: 'desk-picker', label: 'Pick a Colour', group: 'Desktop', description: 'Freeze the screen and pick any pixel; the value is copied in the chosen format.', useWhen: 'Use when the person wants a colour from anywhere on screen.', run: () => deskRun('picker') },
    { id: 'desk-ruler', label: 'Measure the Screen', group: 'Desktop', description: 'Freeze the screen and measure bounds or the spacing between edges in pixels.', useWhen: 'Use when the person wants a size or a gap on screen.', run: () => deskRun('ruler') },
    { id: 'desk-text', label: 'Extract Text from the Screen', group: 'Desktop', description: 'Draw a box around any text on screen and copy it, recognised on this computer.', useWhen: 'Use when text on screen cannot be selected.', run: () => deskRun('text') },
    { id: 'desk-zoom', label: 'Zoom and Draw', group: 'Desktop', description: 'Zoom into the screen and draw, type and point on it.', useWhen: 'Use for presenting or pointing something out.', run: () => deskRun('zoom') },
    { id: 'desk-draw', label: 'Draw on the Screen', group: 'Desktop', description: 'Draw shapes, arrows and text over the frozen screen; Ctrl+C copies the result.', useWhen: 'Use for annotating a screenshot quickly.', run: () => deskRun('draw') },
    { id: 'desk-timer', label: 'Break Timer', group: 'Desktop', description: 'A full-screen countdown.', useWhen: 'Use for breaks, talks and workshops.', run: () => deskRun('timer') },
    { id: 'desk-topmost', label: 'Always on Top', group: 'Desktop', description: 'Pin the frontmost window of another app above the rest, or unpin it.', useWhen: 'Use when a window should stay visible.', run: () => openDesk('topmost') },
    { id: 'desk-awake', label: 'Awake...', group: 'Desktop', description: 'Keep the computer awake for a while or until turned off.', useWhen: 'Use during long copies, renders or talks.', run: () => openDesk('awake') },
    { id: 'desk-hosts', label: 'Hosts File...', group: 'Desktop', description: 'Edit the hosts file with checks and a backup before every save.', useWhen: 'Use to point a name at an address on this computer.', run: () => openDesk('hosts') },
    { id: 'desk-env', label: 'Environment Variables...', group: 'Desktop', description: 'See and change environment variables per scope where the system allows it.', useWhen: 'Use to set PATH or a tool variable for the person.', run: () => openDesk('env') },
    { id: 'go-desk', label: 'Desktop Utilities', group: 'Go', description: 'Show the desktop utilities page.', useWhen: 'Use when the person wants colour history, Awake or the hosts file.', run: () => openDesk('picker'), checked: () => page === 'desk' },
    { id: 'select-all-files', label: 'Select All Files', group: 'Edit', description: 'Select everything in the browser.', useWhen: 'Use before a batch tool.', enabled: () => page === 'browse', run: () => browser.selectAll() },
    { id: 'go-viewer', label: 'Viewer', group: 'Go', description: 'Return to the image last opened.', useWhen: 'Use when the person wants the viewer back.', run: () => setPage('view'), enabled: () => viewer.current !== null, checked: () => page === 'view' },
    { id: 'open-folder', label: 'Open Folder...', group: 'File', description: 'Pick a folder and browse it.', useWhen: 'Use when the person names a folder to look at.', keys: ['Mod+Shift+O'], run: async () => {
      if (inDesktop()) { const p = await host.pickFolder(); if (p) void openPath(p); }
      else { setPage('browse'); browser.focusPath(); }
    } },
    { id: 'open-files', label: 'Open...', group: 'File', description: 'Pick a file and view it.', useWhen: 'Use when the person names a file to view.', keys: ['Mod+O'], run: async () => {
      if (inDesktop()) { const p = await host.pickFiles(); if (p?.length) void openPath(p[0]); }
      else { setPage('browse'); browser.focusPath(); }
    } },
    { id: 'open-path', label: 'Open Path', group: 'File', description: 'Open a file or folder by its full path (argument: path).', useWhen: 'Use when an agent has the exact path.', run: (a) => { const p = typeof a?.path === 'string' ? a.path : ''; if (p) void openPath(p); } },
    { id: 'reveal', label: 'Show in Folder', group: 'File', description: 'Show the current file in the system file manager.', useWhen: 'Use when the person wants the file in Finder or Explorer.', keys: ['Mod+Shift+R'], enabled: () => inDesktop() && page === 'view' && viewer.current !== null, run: () => { const c = viewer.current; if (c) void host.reveal(c.path); } },
    { id: 'open-in', label: 'Open in Its App', group: 'File', description: 'Hand the current file to the app that makes it.', useWhen: 'Use when the person wants to edit the file.', keys: ['Mod+E'], enabled: () => page === 'view' && viewer.current !== null, run: () => { const c = viewer.current; if (c) openIn(c); } },
    { id: 'next', label: 'Next Item', group: 'View', description: 'Show the next file in the folder.', useWhen: 'Use when stepping forward through images.', enabled: () => page === 'view', run: () => viewer.step(1) },
    { id: 'previous', label: 'Previous Item', group: 'View', description: 'Show the previous file in the folder.', useWhen: 'Use when stepping back through images.', enabled: () => page === 'view', run: () => viewer.step(-1) },
    { id: 'palette', label: 'Commands...', group: 'View', description: 'Search every command.', useWhen: 'Use when the person does not know where a command lives.', keys: ['Mod+K'], run: () => palette.open() },
    { id: 'toggle-light', label: 'Light or Dark', group: 'View', description: 'Switch between the dark and light themes.', useWhen: 'Use when the person asks for light or dark mode.', keys: ['Mod+Shift+L'], run: () => { const p = loadPrefs(); setTheme(THEMES[readChoice().theme]?.light ? p.themeDark : p.themeLight); } },
    { id: 'settings', label: 'Preferences...', group: 'formtools', description: 'Open Preferences.', useWhen: 'Use when the person wants to change a setting.', keys: ['Mod+,'], run: () => settings.open() },
    { id: 'undo', label: 'Undo', group: 'Edit', description: 'Undo in the focused text field.', useWhen: 'Use in text fields.', keys: ['Mod+Z'], enabled: () => isText(document.activeElement), run: () => document.execCommand('undo') },
    { id: 'redo', label: 'Redo', group: 'Edit', description: 'Redo in the focused text field.', useWhen: 'Use in text fields.', keys: ['Mod+Shift+Z'], enabled: () => isText(document.activeElement), run: () => document.execCommand('redo') },
    { id: 'cut', label: 'Cut', group: 'Edit', description: 'Cut the selected text.', useWhen: 'Use in text fields.', keys: ['Mod+X'], enabled: () => isText(document.activeElement), run: () => document.execCommand('cut') },
    { id: 'copy', label: 'Copy', group: 'Edit', description: 'Copy the selected text, or the current file path in the viewer.', useWhen: 'Use to copy text or a path.', keys: ['Mod+C'], run: () => {
      if (isText(document.activeElement) || (window.getSelection()?.toString() ?? '') !== '') { document.execCommand('copy'); return; }
      const c = viewer.current;
      if (page === 'view' && c) void navigator.clipboard.writeText(c.path).then(() => toast('Path copied.')).catch(() => undefined);
    } },
    { id: 'paste', label: 'Paste', group: 'Edit', description: 'Paste into the focused text field.', useWhen: 'Use in text fields.', keys: ['Mod+V'], enabled: () => isText(document.activeElement), run: () => document.execCommand('paste') },
    { id: 'select-all', label: 'Select All', group: 'Edit', description: 'Select all text in the focused field.', useWhen: 'Use in text fields.', keys: ['Mod+A'], enabled: () => isText(document.activeElement), run: () => document.execCommand('selectAll') },
  );

  const MENUS: MenuDef[] = [
    { label: 'File', items: ['open-files', 'open-folder', 'util-templates', '-', 'open-in', 'reveal'] },
    { label: 'Edit', items: ['undo', 'redo', '-', 'cut', 'copy', 'paste', 'select-all', '-', 'settings'] },
    { label: 'View', items: ['go-home', 'go-browse', 'go-viewer', '-', 'previous', 'next', '-', 'palette', 'toggle-light'] },
    { label: 'Tools', items: ['tool-convert', 'tool-resize', 'tool-rename', '-', 'util-dupes', 'util-disk', 'util-hash', 'util-cleanup', 'util-locks', '-', 'select-all-files'] },
    { label: 'Desktop', items: ['desk-picker', 'desk-ruler', 'desk-text', 'desk-zoom', 'desk-draw', 'desk-timer', '-', 'desk-topmost', 'desk-awake', '-', 'desk-hosts', 'desk-env', '-', 'go-desk'] },
  ];

  let menus: NativeMenus | null = null;
  if (wantsNativeMenus()) {
    menus = new NativeMenus(commands, MENUS);
    void menus.build().catch(() => { document.documentElement.classList.remove('has-native-menus'); });
  }
  const bar = new MenuBar(commands, MENUS, overlay);
  header.prepend(bar.root);
  new CaptionButtons(header, () => true);

  commands.bindKeys(window, (e) => anyOverlay() || (isText(e.target) && !(e.metaKey || e.ctrlKey)) || bar.isOpen);
  header.addEventListener('click', (e) => {
    const cmd = (e.target instanceof Element ? e.target.closest<HTMLElement>('[data-cmd]') : null)?.dataset.cmd;
    if (cmd) commands.run(cmd);
  });

  const dropTarget = (paths: string[]): void => { if (paths.length) void openPath(paths[0]); };
  if (inDesktop()) {
    void import('@tauri-apps/api/webview').then((m) => m.getCurrentWebview().onDragDropEvent((ev) => {
      if (ev.payload.type === 'drop') { if (page === 'home') home.receive(ev.payload.paths); else dropTarget(ev.payload.paths); }
      setClass(document.documentElement, 'is-dragging-files', ev.payload.type === 'enter' || ev.payload.type === 'over');
    })).catch(() => undefined);
    void host.onOpenPaths(dropTarget);
    const pending = new Map<string, { paths: string[]; timer: number }>();
    const runTool = (tool: string, paths: string[]): void => {
      if (tool === 'view') { if (paths.length) void openPath(paths[0]); return; }
      if (page !== 'tool' && page !== 'util' && page !== 'desk') toolReturn = page;
      if (tool === 'convert' || tool === 'resize' || tool === 'rename') { tools.show(tool, paths); setPage('tool'); return; }
      const util = ({ hash: 'hash', dupes: 'dupes', disk: 'disk' } as Record<string, UtilId>)[tool];
      if (util) { utilities.show(util, paths); setPage('util'); return; }
      if (paths.length) void openPath(paths[0]);
    };
    void host.onOpenTool((tool, paths) => {
      const cur = pending.get(tool) ?? { paths: [], timer: 0 };
      cur.paths.push(...paths.filter((p) => !cur.paths.includes(p)));
      window.clearTimeout(cur.timer);
      cur.timer = window.setTimeout(() => { pending.delete(tool); runTool(tool, cur.paths); }, 400);
      pending.set(tool, cur);
    });
  } else {
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => { e.preventDefault(); toast('In a browser tab, type a folder path in the browser bar. Dropping files works in the desktop app.'); });
  }

  const watchEngine = async (): Promise<void> => {
    try {
      const h = await api.health();
      status.setEngine('up', `Engine ${h.version}`);
      return;
    } catch {
      status.setEngine('down', 'Engine not answering');
    }
    window.setTimeout(() => void watchEngine(), 2000);
  };

  const start = loadPrefs().startPage;
  setPage(start === 'browse' ? 'browse' : 'home');
  void browser.start();
  void watchEngine();
  if (lastViewerPath) browser.selectPath(lastViewerPath);

  const applyCaps = (caps: DeskCaps | null): void => {
    home.applySupport((needs) => !caps || caps.utilities[needs as keyof DeskCaps['utilities']]?.ok !== false);
  };
  const caps = inDesktop()
    ? Promise.race([desk.caps().catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), 1500))]).then((c) => { applyCaps(c); return c; })
    : Promise.resolve(null);
  if (inDesktop()) {
    void desk.onShortcut((id) => deskPage.handleShortcut(id));
    void desk.onResult((r) => deskPage.handleResult(r));
    deskPrefs.onBindingsChange(() => void deskPrefs.apply());
    void caps.then(() => deskPrefs.apply());
  }

  const fonts = document.fonts ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]) : Promise.resolve();
  void Promise.all([fonts, caps]).then(() => revealApp());
}

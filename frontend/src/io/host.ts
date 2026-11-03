export const inDesktop = (): boolean => '__TAURI_INTERNALS__' in window;

export type MenuEntry = 'view' | 'convert' | 'resize' | 'rename' | 'hash';
export const MENU_ENTRIES: Array<[MenuEntry, string]> = [['view', 'Open in formtools'], ['convert', 'Convert'], ['resize', 'Resize'], ['rename', 'Rename'], ['hash', 'Checksums']];
export interface MenuStatus { supported: boolean; installed: string[]; where: string; reason: string }

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  if (!inDesktop()) return null;
  try {
    const core = await import('@tauri-apps/api/core');
    return await core.invoke<T>(cmd, args);
  } catch {
    return null;
  }
}

export const host = {
  pickFolder: () => invoke<string | null>('pick_folder'),
  pickFiles: () => invoke<string[] | null>('pick_files'),
  reveal: (path: string) => invoke<void>('reveal_in_folder', { path }),
  openDefault: (path: string) => invoke<void>('open_with_default', { path }),
  menuStatus: () => invoke<MenuStatus>('osint_menu_status'),
  menuInstall: (ids: MenuEntry[]) => invoke<MenuStatus>('osint_menu_install', { ids }),
  menuRemove: () => invoke<MenuStatus>('osint_menu_remove'),
  async onOpenTool(handler: (tool: string, paths: string[]) => void): Promise<void> {
    if (!inDesktop()) return;
    try {
      const ev = await import('@tauri-apps/api/event');
      await ev.listen<{ tool: string; paths: string[] }>('open-tool', (e) => {
        const p = e.payload;
        if (p && typeof p.tool === 'string' && Array.isArray(p.paths)) handler(p.tool, p.paths);
      });
    } catch {
      return;
    }
  },
  async onOpenPaths(handler: (paths: string[]) => void): Promise<void> {
    if (!inDesktop()) return;
    try {
      const ev = await import('@tauri-apps/api/event');
      await ev.listen<string[]>('open-paths', (e) => { if (Array.isArray(e.payload)) handler(e.payload); });
    } catch {
      return;
    }
  },
};

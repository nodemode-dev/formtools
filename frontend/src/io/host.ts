export const inDesktop = (): boolean => '__TAURI_INTERNALS__' in window;

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

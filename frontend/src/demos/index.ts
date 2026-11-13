import type { Command, Commands } from '../ui/commands';
import { toast } from '../ui/toast';

export type DemoId = 'photos' | 'family' | 'bench';
export interface DemoDef { id: DemoId; title: string; label: string; icon: string; line: string; what: string }

export const DEMOS: DemoDef[] = [
  { id: 'photos', title: 'A photo shoot', label: 'Photo Shoot Demo', icon: 'image', line: 'Twenty-three pictures with camera dates, copies, a broken file, PNG, WebP, 16-bit TIFF and HDR.', what: 'pictures to browse, compare, convert, resize, rename and de-duplicate' },
  { id: 'family', title: 'A shelf of Form files', label: 'Form Files Demo', icon: 'ftFamily', line: 'A formvis project, a PDF, a database, a font, an archive, data and code, and checksums to verify.', what: 'a Form project, documents, data, a font and an archive to open and check' },
  { id: 'bench', title: '3D and media bench', label: '3D and Media Demo', icon: 'ftCube', line: 'A GLB scene, OBJ, STL, PLY and OFF models, a frequency sweep, a chord and a short video.', what: '3D models to view and convert, and sound and video to play and inspect' },
];

export const DEMO_NOTE = 'Each opens a sample folder the engine makes on this computer. Nothing of yours is changed.';
export const demoCommand = (id: DemoId): string => `demo-${id}`;
export const demoCover = (id: DemoId): string => `/api/demos/${id}/cover.png`;

export function registerDemos(commands: Commands, openPath: (path: string) => unknown): void {
  let busy = false;
  const open = async (d: DemoDef): Promise<void> => {
    if (busy) return;
    busy = true;
    toast(`Opening the demo: ${d.title}...`);
    try {
      const res = await fetch(`/api/demos/${d.id}`, { method: 'POST' });
      const body = await res.json().catch(() => null) as { path?: string; notes?: string[]; error?: string } | null;
      if (!res.ok || !body?.path) throw new Error(body?.error ?? `The engine answered ${res.status}.`);
      await openPath(body.path);
      toast(body.notes?.length ? body.notes.join(' ') : `Demo folder open: ${d.title}. It was made for you; nothing of yours was changed.`, 'info', 5000);
    } catch (e) {
      toast(`The demo could not open. ${e instanceof Error ? e.message : ''}`.trim(), 'error');
    } finally {
      busy = false;
    }
  };
  const each: Command[] = DEMOS.map((d) => ({
    id: demoCommand(d.id),
    label: d.label,
    group: 'Help',
    description: `Open the demo folder "${d.title}": ${d.what}, made by the engine the first time.`,
    useWhen: 'Use when the person wants to try formtools on sample files.',
    enabled: () => !busy,
    run: () => { void open(d); },
  }));
  commands.add(...each, {
    id: 'demo-open',
    label: 'Open a Demo',
    group: 'Help',
    description: 'Open one of the three demo folders (argument: id, one of photos, family or bench).',
    useWhen: 'Use when an agent wants a sample folder to show a tool on.',
    enabled: () => !busy,
    run: (a) => { const d = DEMOS.find((x) => x.id === a?.id); if (!d) throw new Error('id must be photos, family or bench'); void open(d); },
  });
}

import type { Commands } from '../ui/commands';

export async function mirrorCatalogue(commands: Commands): Promise<number> {
  const rows = commands.all().map((c) => ({ id: c.id, label: c.label, group: c.group, description: c.description, keys: c.keys ?? [], params: [] }));
  const res = await fetch('/api/commands/catalogue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ commands: rows }) });
  if (!res.ok) throw new Error(`The engine answered ${res.status}.`);
  return ((await res.json()) as { size: number }).size;
}

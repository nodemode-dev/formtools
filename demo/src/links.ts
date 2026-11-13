import './links.css';

const PAGES: ReadonlyArray<{ id: string; label: string; path: string }> = [
  { id: 'photos', label: 'Photo shoot', path: 'demo/index.html' },
  { id: 'family', label: 'Form files', path: 'demos/family/index.html' },
  { id: 'bench', label: '3D and media', path: 'demos/bench/index.html' },
];

export function mountLinks(current: string): void {
  const status = document.querySelector('.cv-status');
  if (!status) return;
  const up = current === 'photos' ? '../' : '../../';
  const nav = document.createElement('nav');
  nav.className = 'ft-demo-links';
  nav.setAttribute('aria-label', 'formtools demos');
  const head = document.createElement('span');
  head.textContent = 'Demos';
  nav.append(head);
  for (const p of PAGES) {
    const a = document.createElement('a');
    a.href = `${up}${p.path}`;
    a.textContent = p.label;
    if (p.id === current) a.setAttribute('aria-current', 'page');
    nav.append(a);
  }
  status.insertBefore(nav, status.querySelector('.ft-st-engine'));
}

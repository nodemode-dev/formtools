const wait = (ms: number): Promise<void> => new Promise((done) => window.setTimeout(done, ms));
const frame = (): Promise<void> => new Promise((done) => requestAnimationFrame(() => done()));

async function card(id: string): Promise<HTMLElement> {
  for (let i = 0; i < 400; i++) {
    const b = document.querySelector<HTMLElement>(`[data-cmd="demo-${id}"]`);
    if (b && document.body.classList.contains('app-ready')) return b;
    await wait(50);
  }
  throw new Error('The demo window did not start.');
}

const opened = (root: string): boolean => {
  const page = document.querySelector<HTMLElement>('.ft-browser');
  const path = document.querySelector<HTMLInputElement>('.ft-browser .ft-path');
  return !!page && !page.hidden && path?.value === root && !!document.querySelector('.ft-browser .ft-item');
};

export async function openSession(id: string): Promise<void> {
  try {
    (await card(id)).click();
    const root = window.FT_RECORDING?.root ?? '';
    for (let i = 0; i < 400 && !opened(root); i++) await wait(50);
    for (let i = 0, last = -1, same = 0; i < 60 && same < 4; i++) {
      const now = document.querySelectorAll('.ft-browser .ft-item.has-thumb').length;
      same = now > 0 && now === last ? same + 1 : 0;
      last = now;
      await wait(50);
    }
  } finally {
    await frame();
    await frame();
    document.documentElement.removeAttribute('data-demo');
  }
}

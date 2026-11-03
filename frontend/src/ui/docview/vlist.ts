const MAX_HEIGHT = 8_000_000;

export class VirtualList {
  readonly body: HTMLElement;
  onRender: ((first: number, last: number) => void) | null = null;
  private count = 0;
  private pool: HTMLElement[] = [];
  private start = -1;
  private raf = 0;
  private scaled = false;
  private bodyH = 0;
  private lastH = -1;

  constructor(
    private readonly scroller: HTMLElement,
    private readonly rowH: number,
    private readonly build: () => HTMLElement,
    private readonly fill: (node: HTMLElement, index: number) => void,
  ) {
    this.body = document.createElement('div');
    this.body.className = 'dv-vbody';
    scroller.appendChild(this.body);
    scroller.addEventListener('scroll', () => this.schedule(), { passive: true });
    new ResizeObserver(() => { if (scroller.clientHeight !== this.lastH) this.schedule(true); }).observe(scroller);
  }

  setCount(n: number): void {
    this.count = n;
    this.scaled = n * this.rowH > MAX_HEIGHT;
    this.bodyH = Math.min(n * this.rowH, MAX_HEIGHT);
    const h = `${this.bodyH}px`;
    if (this.body.style.height !== h) this.body.style.height = h;
    this.render(true);
  }

  get total(): number { return this.count; }

  refresh(): void { this.render(true); }

  rows(): number { return Math.max(1, Math.ceil(this.scroller.clientHeight / this.rowH)); }

  firstVisible(): number {
    const st = this.scroller.scrollTop;
    if (!this.scaled) return Math.floor(st / this.rowH);
    const max = Math.max(1, this.bodyH - this.scroller.clientHeight);
    return Math.round((st / max) * Math.max(0, this.count - this.rows()));
  }

  scrollToIndex(i: number): void {
    const idx = Math.max(0, Math.min(this.count - 1, i));
    if (!this.scaled) { this.scroller.scrollTop = idx * this.rowH; return; }
    const max = Math.max(1, this.bodyH - this.scroller.clientHeight);
    this.scroller.scrollTop = (idx / Math.max(1, this.count - this.rows())) * max;
  }

  private schedule(force = false): void {
    if (force) this.start = -2;
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => { this.raf = 0; this.render(false); });
  }

  private render(force: boolean): void {
    this.lastH = this.scroller.clientHeight;
    const need = Math.min(this.count, this.rows() + 3);
    while (this.pool.length < need) {
      const n = this.build();
      n.classList.add('dv-vrow');
      n.style.height = `${this.rowH}px`;
      this.body.appendChild(n);
      this.pool.push(n);
      force = true;
    }
    while (this.pool.length > need) { this.pool.pop()?.remove(); force = true; }
    const first = Math.max(0, Math.min(this.firstVisible(), Math.max(0, this.count - need)));
    if (!force && first === this.start) return;
    this.start = first;
    const st = this.scroller.scrollTop;
    for (let k = 0; k < this.pool.length; k++) {
      const node = this.pool[k];
      const i = first + k;
      const y = this.scaled ? st + k * this.rowH : i * this.rowH;
      const t = `translateY(${y}px)`;
      if (node.style.transform !== t) node.style.transform = t;
      this.fill(node, i);
    }
    this.onRender?.(first, first + this.pool.length - 1);
  }
}

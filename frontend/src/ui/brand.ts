export function brandMark(size: number, label = 'formtools'): string {
  const img = `<img src="${import.meta.env.BASE_URL}favicon.png" width="${size}" height="${size}" alt="${label}" draggable="false">`;
  return `<span class="ft-brand-mark" style="width:${size}px;height:${size}px">${img}</span>`;
}

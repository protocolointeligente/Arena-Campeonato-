// Ícones SVG inline, sem dependência externa — grade 24x24, traço uniforme (currentColor),
// pra substituir emoji em todo o app por um visual consistente e sem cara de "sticker".
// Uso: `${icon('trophy')}` dentro de um template — o SVG herda a cor do texto ao redor.

const PATHS = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  layers: '<path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="m3 13 9 5 9-5"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4h13l-3 4 3 4H5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  bracket: '<circle cx="5" cy="6" r="2"/><circle cx="5" cy="18" r="2"/><circle cx="19" cy="12" r="2"/><path d="M7 6h6a2 2 0 0 1 2 2v2M7 18h6a2 2 0 0 0 2-2v-2M17 12h0"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><circle cx="17.5" cy="9" r="2.4"/><path d="M15.8 14.3c2.5.3 4.2 2.2 4.2 5"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.2"/><circle cx="12" cy="12" r=".6" fill="currentColor" stroke="none"/>',
  shieldCheck: '<path d="M12 3 5 6v6c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6l-7-3Z"/><path d="m9.2 12.3 2 2 3.6-4"/>',
  inbox: '<path d="M4 12h4.2l1.4 3h4.8l1.4-3H20"/><rect x="3" y="4" width="18" height="16" rx="2"/>',
  megaphone: '<path d="M3 10v4a1 1 0 0 0 1 1h2l5 4V5l-5 4H4a1 1 0 0 0-1 1Z"/><path d="M17 8a5 5 0 0 1 0 8M20 5a9 9 0 0 1 0 14"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  sliders: '<path d="M4 6h9M17 6h3M4 12h3M9 12h11M4 18h13M19 18h1"/><circle cx="14" cy="6" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="16" cy="18" r="2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l1.9-1.5-2-3.4-2.3.9a7.7 7.7 0 0 0-2.6-1.5L14 2h-4l-.4 2.5a7.7 7.7 0 0 0-2.6 1.5l-2.3-.9-2 3.4L4.6 10a7.6 7.6 0 0 0 0 3l-1.9 1.5 2 3.4 2.3-.9c.75.66 1.63 1.17 2.6 1.5L10 22h4l.4-2.5a7.7 7.7 0 0 0 2.6-1.5l2.3.9 2-3.4-1.9-1.6Z"/>',
  fileText: '<path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  trophy: '<path d="M8 4h8v6a4 4 0 0 1-8 0V4Z"/><path d="M8 5H5a3 3 0 0 0 3 5M16 5h3a3 3 0 0 1-3 5"/><path d="M12 14v3M9 21h6M9.5 21c0-2 1-3 2.5-3s2.5 1 2.5 3"/>',
  pencil: '<path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z"/><path d="M14 6l4 4"/>',
  ball: '<circle cx="12" cy="12" r="9"/><path d="M12 8.2 15.4 11l-1.3 4H9.9l-1.3-4L12 8.2Z"/><path d="M12 3v5.2M4 9l4.6 2M4 15l4.6-2M20 9l-4.6 2M20 15l-4.6-2M12 21v-5.2"/>',
  monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z"/>',
  mapPin: '<path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.3"/>',
  whistle: '<circle cx="8" cy="14" r="5"/><path d="M11.5 11 20 5h2v3l-6.5 3.5"/><path d="M8 12v4"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m4 17 5-5 3.5 3.5L17 11l3 3"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8.3 12.3 2.4 2.4 5-5.4"/>',
  clipboard: '<rect x="6" y="4" width="12" height="17" rx="2"/><rect x="9" y="2.5" width="6" height="3" rx="1"/><path d="M9 11h6M9 15h6"/>',
  trendingUp: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 6h6v6"/>',
  camera: '<path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="14" r="3.5"/>',
  video: '<rect x="2" y="5" width="14" height="14" rx="2"/><path d="m22 8-6 4 6 4V8Z"/>',
  printer: '<path d="M7 8V3h10v5"/><rect x="4" y="8" width="16" height="8" rx="1.5"/><path d="M7 15h10v6H7v-6Z"/>',
  link: '<path d="M9.5 14.5 14.5 9.5"/><path d="M11 6.5 13 4.5a4 4 0 0 1 5.7 5.7L16.7 12.2"/><path d="M13 17.5 11 19.5a4 4 0 0 1-5.7-5.7l2-2"/>',
  star: '<path d="m12 3 2.6 5.7 6.2.6-4.6 4.2 1.3 6.1L12 16.7 6.5 19.6l1.3-6.1L3.2 9.3l6.2-.6L12 3Z"/>',
  zap: '<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/>',
  hourglass: '<path d="M6 3h12M6 21h12M7 3c0 4 3.2 5.8 5 6.5C10.2 10.2 7 12 7 21M17 3c0 4-3.2 5.8-5 6.5 1.8.7 5 2.5 5 11.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v3M12 18.5v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2.5 12h3M18.5 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4 7 7 0 0 0 20 14.5Z"/>',
  shuffle: '<path d="M3 6h3.5L15 18h3.5M3 18h3.5L11 12M17 6h1.5"/><path d="m18 3 3 3-3 3M18 15l3 3-3 3"/>',
  lock: '<rect x="4" y="10" width="16" height="10" rx="2"/><path d="M7 10V7a5 5 0 0 1 10 0v3"/>',
  shield: '<path d="M12 3 5 6v6c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6l-7-3Z"/>',
  creditCard: '<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19M6 15h4"/>',
  flask: '<path d="M9 3h6M10 3v6.5L4.8 18a2 2 0 0 0 1.7 3h11a2 2 0 0 0 1.7-3L14 9.5V3"/><path d="M7.5 15h9"/>',
  alertTriangle: '<path d="M12 3.5 2 20h20L12 3.5Z"/><path d="M12 9.5v5"/><circle cx="12" cy="17.3" r=".4" fill="currentColor" stroke="none"/>',
  xCircle: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>',
  circle: '<circle cx="12" cy="12" r="8"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="m6.5 6.5 11 11"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="8" r=".4" fill="currentColor" stroke="none"/>',
  user: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/>',
  download: '<path d="M12 3v12m0 0-4.5-4.5M12 15l4.5-4.5"/><path d="M4 18v1.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V18"/>',
  trash: '<path d="M4 7h16M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7M6 7l1 13a1.5 1.5 0 0 0 1.5 1.4h7a1.5 1.5 0 0 0 1.5-1.4l1-13"/><path d="M10 11v6M14 11v6"/>',
  moreHorizontal: '<circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
  basketball: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18M5.7 5.7c2.8 2.8 2.8 9.8 0 12.6M18.3 5.7c-2.8 2.8-2.8 9.8 0 12.6"/>',
  racket: '<circle cx="13.5" cy="9" r="6"/><path d="M13.5 5v8M10 6.3l7 5.4M17 6.3l-7 5.4"/><path d="M9.3 13.3 3 20"/>',
  medal: '<path d="M8.5 3h7l-2.3 7.5h-2.4L8.5 3Z"/><circle cx="12" cy="15" r="5.5"/><path d="M12 12.3 13 15h-2l1 2.7"/>',
};

/**
 * @param {keyof typeof PATHS} name
 * @param {number} [size]
 */
export function icon(name, size = 18) {
  const body = PATHS[name];
  if (!body) {return '';}
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}

// Cartão de disciplina (amarelo/vermelho) — chip sólido, não um ícone de traço como os outros,
// por isso fica à parte em vez de entrar em PATHS. `color` é um valor CSS (ex.: var(--warning)).
export function cardChip(color, size = 14) {
  return `<svg width="${size}" height="${size * 1.3}" viewBox="0 0 12 16" aria-hidden="true" focusable="false"><rect width="12" height="16" rx="2" fill="${color}"/></svg>`;
}

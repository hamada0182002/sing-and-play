// أدوات صغيرة لبناء الـ DOM بدون مكتبات. النصوص تدخل دائمًا كـ textContent (آمنة من XSS) — مفيش innerHTML في اللعبة كلها.
const SVG_NS = 'http://www.w3.org/2000/svg';
const SVG_TAGS = new Set(['svg', 'path', 'circle', 'g', 'rect', 'line']);

export function h(tag, props, ...children) {
  const el = SVG_TAGS.has(tag) ? document.createElementNS(SVG_NS, tag) : document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.setAttribute('class', v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') el.value = v;
    else if (k === 'disabled') { el.disabled = true; el.setAttribute('aria-disabled', 'true'); }
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

const ICONS = {
  check: 'M5 12.5l4.5 4.5L19 7',
  x: 'M6 6l12 12M18 6L6 18',
  next: 'M5 12h13M13 7l5 5-5 5',
  back: 'M19 12H6M11 7l-5 5 5 5',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14a6.5 6.5 0 0 1 3.5 6',
  trophy: 'M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M12 14v4M8 20h8',
  replay: 'M4 12a8 8 0 1 0 3-6.2M4 4v4h4',
  skip: 'M5 5l8 7-8 7zM17 5v14',
  send: 'M4 12l16-8-6 16-3-7z',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5v.5',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  bolt: 'M13 3L5 13.5h6L10 21l8-10.5h-6z',
  crown: 'M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z',
  pencil: 'M4 20l1-4L16.5 4.5a2 2 0 0 1 3 3L8 19zM14 7l3 3',
  plus: 'M12 5v14M5 12h14',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  dice: 'M5 5h14v14H5zM9 9h.01M15 9h.01M12 12h.01M9 15h.01M15 15h.01',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
  alert: 'M12 3l10 18H2zM12 10v5M12 18v.01',
  copy: 'M9 9h11v11H9zM5 15V4h11',
};

export function icon(name, size = 24, color = 'currentColor') {
  return h('svg', {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color,
    'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', class: 'bc-icon',
  }, h('path', { d: ICONS[name] || ICONS.info }));
}

/** أرقام عربية-هندية كما في الهوية البصرية (٢٤). */
export function ar(n) { return Number(n).toLocaleString('ar-EG', { useGrouping: false }); }

/** رقم مع إشارة: +٢٠ / −١٠ / ٠. */
export function signed(n) { const t = n > 0 ? `+${ar(n)}` : n < 0 ? `−${ar(Math.abs(n))}` : ar(0); return `\u2066${t}\u2069`; }   // معزول LTR عشان العلامة تفضل قدّام الرقم

export function mmss(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${ar(Math.floor(s / 60))}:${ar(s % 60).padStart(2, '٠')}`;
}
export function secs(ms) { return ar(Math.max(0, Math.ceil(ms / 1000))); }

export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }

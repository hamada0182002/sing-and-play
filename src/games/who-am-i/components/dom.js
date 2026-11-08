// أدوات صغيرة لبناء الـ DOM بدون مكتبات. النصوص تدخل دائمًا كـ textContent (آمنة من XSS).
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
  ask: 'M4 5h16v11H9l-5 4z',
  guess: 'M12 3a6 6 0 0 0-3.5 10.9V17h7v-3.1A6 6 0 0 0 12 3zM9.5 20.5h5',
  check: 'M5 12.5l4.5 4.5L19 7',
  x: 'M6 6l12 12M18 6L6 18',
  next: 'M5 12h13M13 7l5 5-5 5',
  back: 'M19 12H6M11 7l-5 5 5 5',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14a6.5 6.5 0 0 1 3.5 6',
  trophy: 'M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M12 14v4M8 20h8',
  replay: 'M4 12a8 8 0 1 0 3-6.2M4 4v4h4',
  skip: 'M5 5l8 7-8 7zM17 5v14',
  undo: 'M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10h-3',
  send: 'M4 12l16-8-6 16-3-7z',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5v.5',
};

export function icon(name, size = 26, color = 'currentColor') {
  return h('svg', {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color,
    'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', class: 'wai-icon',
  }, h('path', { d: ICONS[name] || ICONS.info }));
}

/** أرقام عربية-هندية كما في الهوية البصرية (٢٤). */
export function ar(n) { return Number(n).toLocaleString('ar-EG', { useGrouping: false }); }
// رقم/كود الغرفة: لو رقم نكتبه بالأرقام العربية، ولو كود (حروف وأرقام زي K7M2QX) نعرضه زي ما هو بترتيب ثابت
export function roomLabel(id) {
  const t = String(id ?? '');
  return /^\d+$/.test(t) ? ar(t) : `\u2066${t}\u2069`;
}
export function arGroup(n) { return Number(n).toLocaleString('ar-EG'); }

export function mmss(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${ar(Math.floor(s / 60))}:${ar(s % 60).padStart(2, '٠')}`;
}

/** مدة الدور بالكلام: ١٨٠ ثانية → «٣ دقايق». */
export function durationText(sec) {
  if (sec % 60) return `${ar(sec)} ثانية`;
  const m = sec / 60;
  return m === 1 ? 'دقيقة' : m === 2 ? 'دقيقتين' : `${ar(m)} دقايق`;
}

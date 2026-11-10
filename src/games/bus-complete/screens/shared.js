// أدوات مشتركة بين الشاشات.
import { h, icon, ar } from '../components/dom.js';
import { Avatar, colorIndex, Chip } from '../components/ui.js';
import { letterLabel } from '../data/letters.js';

export function playerIndex(view, id) { return colorIndex(view.players, id); }
export function nameOf(view, id) { const p = view.players.find((x) => x.id === id); return p ? (id === view.viewerId ? 'أنا' : p.name) : 'لاعب'; }
export function bcLabel(letter) { return letterLabel(letter); }
export function titleBlock(eyebrow, title, size = '') { return h('div', { class: 'bc-center' }, eyebrow && h('div', { class: 'bc-eyebrow' }, eyebrow), h('div', { class: `bc-title ${size}`.trim() }, title)); }
export function qLabel(view) { const p = view.progress; return p.final ? 'السؤال النهائي' : `السؤال ${ar(p.no)} من ${ar(p.normalTotal)}`; }
export function adminBadge() { return Chip('أدمن', 'butter'); }
export { h, icon, ar };

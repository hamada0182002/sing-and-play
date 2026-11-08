// مكوّنات الواجهة المشتركة — بنفس مفردات الهوية: أزرار بظل سفلي، تذاكر بحواف مقصوصة، أسطوانة فينيل، حلقة مؤقت.
import { h, icon, ar } from './dom.js';
import { CATEGORIES } from '../data/categories.js';

export const AVATAR_COLORS = ['butter', 'olive', 'flame', 'brick', 'ivory'];

/** variant: butter | flame | brick | ghost | dark */
export function Button(label, { variant = 'butter', onClick, disabled, iconName, block, size = 'md', ariaLabel } = {}) {
  return h('button', {
    class: `wai-btn wai-btn--${variant} wai-btn--${size}${block ? ' wai-btn--block' : ''}`,
    type: 'button', onClick, disabled, 'aria-label': ariaLabel,
  }, iconName && icon(iconName, size === 'lg' ? 28 : 24), label && h('span', null, label));
}

export function Avatar(player, index, { size = 44, ring, dim, badge } = {}) {
  const color = AVATAR_COLORS[index % AVATAR_COLORS.length];
  return h('div', {
    class: `wai-avatar wai-avatar--${color}${ring ? ' is-ring' : ''}${dim ? ' is-dim' : ''}`,
    style: { width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.5)}px` },
    'aria-hidden': 'true',
  }, [...(player.name || '؟')][0], badge && h('span', { class: 'wai-avatar__badge' }, badge));
}

export function colorIndex(players, id) { return Math.max(0, players.findIndex((p) => p.id === id)); }

export function Chip(text, tone = 'dark') { return h('span', { class: `wai-chip wai-chip--${tone}` }, text); }

/** تذكرة بحواف مقصوصة. */
export function Ticket(children, { tone = 'butter', className = '' } = {}) {
  return h('div', { class: `wai-ticket wai-ticket--${tone} ${className}` }, children);
}

export function CategoryChip(cat) { return Chip(CATEGORIES[cat] || '', 'dark'); }

/** أسطوانة + حلقة مؤقت. progress من 0 إلى 1 (المتبقي). */
export function Vinyl({ label, progress = 1, low = false, size = 'md', spin = false }) {
  const R = 136; const C = 2 * Math.PI * R;
  return h('div', { class: `wai-vinyl wai-vinyl--${size}${low ? ' is-low' : ''}${spin ? ' is-spin' : ''}` },
    h('svg', { viewBox: '0 0 290 290', 'aria-hidden': 'true', class: 'wai-vinyl__ring' },
      h('circle', { cx: 145, cy: 145, r: R, class: 'wai-vinyl__track' }),
      h('circle', {
        cx: 145, cy: 145, r: R, class: 'wai-vinyl__arc', 'data-wai-arc': '',
        'stroke-dasharray': C.toFixed(1), 'stroke-dashoffset': (C * (1 - progress)).toFixed(1), transform: 'rotate(-90 145 145)',
      })),
    h('div', { class: 'wai-vinyl__disc' }, h('span', { class: 'wai-vinyl__label' }, label)));
}
export const RING_C = 2 * Math.PI * 136;

export function Header({ left, right }) {
  return h('div', { class: 'wai-header' }, h('span', { class: 'wai-pill wai-pill--plain' }, left), h('span', { class: 'wai-pill' }, right));
}

export function ScoreStrip(view, players, { activeId, highlightId, answeringId } = {}) {
  return h('div', { class: 'wai-strip', role: 'list', 'aria-label': 'اللاعبون والنقاط' },
    players.map((p, i) => h('div', { class: 'wai-strip__item', role: 'listitem' },
      Avatar(p, i, { size: 44, ring: p.id === activeId, badge: p.id === answeringId ? '…' : null }),
      h('div', { class: 'wai-strip__name' }, p.id === view.viewerId ? 'أنا' : p.name),
      h('div', { class: 'wai-strip__score' }, ar(view.scores[p.id] || 0)))));
}

export const ANSWER_TONE = { yes: 'olive', no: 'brick', maybe: 'butter', unknown: 'ivory' };

export function Toast(text) { return h('div', { class: 'wai-toast', role: 'status' }, text); }

// مكوّنات الواجهة المشتركة — بنفس مفردات هوية SING & PLAY: أزرار بظل سفلي، تذاكر بحواف مقصوصة، أسطوانة فينيل، حلقة مؤقت.
import { h, icon, ar } from './dom.js';
import { letterLabel } from '../data/letters.js';
import { STATUS_LABEL, STATUS_TONE } from '../data/copy.js';

export const AVATAR_COLORS = ['butter', 'olive', 'flame', 'brick', 'ivory'];
export const RING_C = 2 * Math.PI * 136;

/** نص فيه **غامق** → عناصر <b> (بدون innerHTML). */
export function rich(text) {
  return String(text).split('**').map((part, i) => (i % 2 ? h('b', null, part) : part));
}

/** variant: butter | flame | brick | ghost | dark */
export function Button(label, { variant = 'butter', onClick, disabled, iconName, block, size = 'md', ariaLabel, className = '' } = {}) {
  return h('button', {
    class: `bc-btn bc-btn--${variant} bc-btn--${size}${block ? ' bc-btn--block' : ''} ${className}`.trim(),
    type: 'button', onClick, disabled, 'aria-label': ariaLabel,
  }, iconName && icon(iconName, size === 'lg' ? 28 : 22), label && h('span', null, label));
}

export function Avatar(player, index, { size = 44, ring, dim, badge } = {}) {
  const color = AVATAR_COLORS[index % AVATAR_COLORS.length];
  return h('div', {
    class: `bc-avatar bc-avatar--${color}${ring ? ' is-ring' : ''}${dim ? ' is-dim' : ''}`,
    style: { width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.5)}px` },
    'aria-hidden': 'true',
  }, [...(player.name || '؟')][0], badge && h('span', { class: 'bc-avatar__badge' }, badge));
}

export function colorIndex(players, id) { return Math.max(0, players.findIndex((p) => p.id === id)); }

export function Chip(text, tone = 'dark', extra = '') { return h('span', { class: `bc-chip bc-chip--${tone} ${extra}`.trim() }, text); }

export function StatusBadge(status) {
  return Chip(STATUS_LABEL[status] || status, STATUS_TONE[status] || 'ivory');
}

/** تذكرة بحواف مقصوصة. */
export function Ticket(children, { tone = 'butter', className = '' } = {}) {
  return h('div', { class: `bc-ticket bc-ticket--${tone} ${className}`.trim() }, children);
}

/** أسطوانة + حلقة مؤقت (الحرف على الليبل). progress من 0 إلى 1 (المتبقي). */
export function Vinyl({ letter, progress = 1, size = 'md', spin = false, endsAt, totalMs, pop = false }) {
  const R = 136;
  const arcAttrs = {
    cx: 145, cy: 145, r: R, class: 'bc-vinyl__arc', 'data-bc-arc': '', 'stroke-dasharray': RING_C.toFixed(1),
    'stroke-dashoffset': (RING_C * (1 - progress)).toFixed(1), transform: 'rotate(-90 145 145)',
  };
  if (endsAt) { arcAttrs['data-bc-end'] = endsAt; arcAttrs['data-bc-total'] = totalMs; }
  return h('div', { class: `bc-vinyl bc-vinyl--${size}${spin ? ' is-spin' : ''}${pop ? ' is-pop' : ''}`, role: 'img', 'aria-label': `الحرف ${letterLabel(letter)}` },
    h('svg', { viewBox: '0 0 290 290', 'aria-hidden': 'true', class: 'bc-vinyl__ring' },
      h('circle', { cx: 145, cy: 145, r: R, class: 'bc-vinyl__track' }),
      h('circle', arcAttrs)),
    h('div', { class: 'bc-vinyl__disc' }, h('span', { class: 'bc-vinyl__label' }, letterLabel(letter))));
}

/** عدّاد ثواني متزامن (الـcontroller بيحدّثه كل ٢٥٠ms من ساعة الخادم). */
export function Countdown(endsAt, { fmt = 'secs', label = 'ثانية', className = '' } = {}) {
  return h('div', { class: `bc-time ${className}`.trim() },
    h('span', { class: 'bc-time__n', 'data-bc-time': endsAt, 'data-bc-fmt': fmt }, '٠'),
    label && h('span', { class: 'bc-time__l' }, label));
}

/** شريط مؤقت أفقي. */
export function TimeBar(endsAt, totalMs) {
  return h('div', { class: 'bc-bar', role: 'presentation' }, h('i', { 'data-bc-bar': '', 'data-bc-end': endsAt, 'data-bc-total': totalMs }));
}

export function Header({ left, right, rightTone = '' }) {
  return h('div', { class: 'bc-header' }, h('span', { class: 'bc-pill bc-pill--plain' }, left), right != null && h('span', { class: `bc-pill ${rightTone}`.trim() }, right));
}

/** شريط اللاعبين والنقاط (أسفل الشاشة). */
export function ScoreStrip(view, { activeId } = {}) {
  return h('div', { class: 'bc-strip', role: 'list', 'aria-label': 'اللاعبون والنقاط' },
    view.players.map((p, i) => h('div', { class: `bc-strip__item${p.left ? ' is-left' : ''}`, role: 'listitem' },
      Avatar(p, i, { size: 40, ring: p.id === activeId || p.id === view.viewerId }),
      h('div', { class: 'bc-strip__name' }, p.id === view.viewerId ? 'أنا' : p.name),
      h('div', { class: 'bc-strip__score' }, ar(view.scores[p.id] || 0)))));
}

export function Toast(text) { return h('div', { class: 'bc-toast', role: 'status' }, text); }

/** ورقة سفلية (تأكيدات واختيارات). */
export function Sheet({ title, children, onClose, tone = '' }) {
  const wrap = h('div', { class: 'bc-sheet-wrap', onClick: (e) => { if (e.target === wrap) onClose && onClose(); } },
    h('div', { class: `bc-sheet ${tone}`.trim(), role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('div', { class: 'bc-sheet__grab' }),
      title && h('div', { class: 'bc-sheet__title' }, title),
      children));
  return wrap;
}

/** مجموعة أزرار اختيار (segmented). options: [{value,label}] */
export function Segmented({ options, value, onChange, disabled, label }) {
  return h('div', { class: 'bc-seg', role: 'radiogroup', 'aria-label': label },
    options.map((o) => h('button', {
      type: 'button', role: 'radio', 'aria-checked': String(o.value === value), class: `bc-seg__opt${o.value === value ? ' is-on' : ''}`,
      disabled, onClick: () => onChange(o.value),
    }, o.label)));
}

/** حالة لاعب (أرسل / بيكتب) — لشاشة لوبي السؤال. */
export function PlayerStatusBoard(view, q) {
  return h('div', { class: 'bc-pstat', role: 'list', 'aria-label': 'حالة اللاعبين' },
    q.players.filter((p) => !p.left).map((p) => {
      const idx = Math.max(0, view.players.findIndex((x) => x.id === p.id));
      const done = p.submitted;
      return h('div', { class: `bc-pstat__item ${done ? 'is-done' : 'is-typing'}`, role: 'listitem' },
        Avatar(p, idx, { size: 42, badge: done ? '✓' : '…' }),
        h('div', { class: 'bc-pstat__name' }, p.id === view.viewerId ? 'أنا' : p.name),
        h('div', { class: 'bc-pstat__state' }, done ? 'تم الإرسال' : 'يكتب الآن'));
    }));
}

export function Dots(n, on) {
  return h('div', { class: 'bc-dots', 'aria-hidden': 'true' }, Array.from({ length: n }, (_, i) => h('i', { class: i < on ? 'is-on' : '' })));
}

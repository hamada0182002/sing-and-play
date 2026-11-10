// لوحة الأدمن الجانبية: الأرصدة، الأرقام المستخدمة، الكارت، حالة الإرسال، سجل التعديلات، إنهاء الجولة.
import { h, icon, ar } from '../components/dom.js';
import { Button, Avatar, Chip, Sheet } from '../components/ui.js';
import { playerIndex } from '../screens/shared.js';

const AUDIT_TEXT = {
  startRound: () => 'بدء الجولة', advance: (a) => 'تخطّي/تقدّم', grade: (a) => `تصحيح س${ar(a.questionNo)}`,
  bulkGrade: (a) => `تصحيح جماعي س${ar(a.questionNo)}`, approve: (a) => `اعتماد س${ar(a.questionNo)}`, adjustNext: (a) => `تعديل السؤال ${ar(a.questionNo)}`,
  endRound: () => 'إنهاء الجولة', newRound: () => 'جولة جديدة',
};
const fmtTime = (t) => new Date(t).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export function AdminDrawer(c) {
  const v = c.view; const a = v.admin;
  const close = () => { c.ui.adminOpen = false; c.render(); };
  const canEnd = v.phase !== 'lobby' && v.phase !== 'standings';
  return Sheet({ title: 'لوحة الأدمن', onClose: close, children: [
    h('div', { class: 'bc-card__title' }, 'اللاعبون', h('small', null, 'الرصيد · الأرقام · الكارت')),
    h('div', { class: 'bc-roster' }, a.roster.map((p) => h('div', { class: 'bc-rrow' },
      h('div', { class: 'bc-rrow__top' }, Avatar(p, playerIndex(v, p.id), { size: 28 }), p.name, p.left && Chip('خرج', 'brick'),
        v.question && v.phase === 'question' && Chip(p.submitted ? 'أرسل' : p.picked ? 'بيكتب' : 'بيختار', p.submitted ? 'olive' : 'line'),
        h('span', { class: 's' }, ar(p.score))),
      h('div', { class: 'bc-used', 'aria-label': 'الأرقام المستخدمة' }, p.used.length ? p.used.map((n) => h('i', null, ar(n))) : h('span', { class: 'bc-small' }, 'لسه ما استخدمش أرقام')),
      h('div', { class: 'bc-small' }, p.cardUsed ? `كارت ×٢ مستخدم في س${ar(p.cardQuestion)}` : 'كارت ×٢ متاح', p.wager != null ? ` · رهان ${ar(p.wager)}` : '')))),
    h('div', { class: 'bc-card__title' }, 'سجل الأدمن', h('small', null, `تعلّم القاموس ${ar(a.learnedCount)} كلمة`)),
    h('ul', { class: 'bc-audit' }, a.audit.length ? a.audit.slice(0, 30).map((e) => h('li', null, h('time', null, fmtTime(e.at)),
      (AUDIT_TEXT[e.type] ? AUDIT_TEXT[e.type](e) : e.type), e.playerName && ` · ${e.playerName}`,
      e.type === 'grade' && ` (${e.before} ← ${e.after})`)) : h('li', null, 'مفيش حاجة لسه')),
    canEnd && Button('إنهاء الجولة الآن', { variant: 'brick', block: true, iconName: 'alert', onClick: () => { c.ui.adminOpen = false; c.confirmEnd(); } }),
    Button('إغلاق', { variant: 'dark', block: true, onClick: close }),
  ] });
}

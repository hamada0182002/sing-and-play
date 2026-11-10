// 5) بداية السؤال/الحرف · 6) الإجابة · 7) اختيار النقاط · 8) كارت ×٢ · 9) لوبي السؤال · 10) متابعة اللاعبين · 11) انتهاء السؤال · 14) السؤال النهائي
import { h, icon, ar, signed } from '../components/dom.js';
import { Button, Avatar, Chip, Header, Ticket, Vinyl, Countdown, TimeBar, ScoreStrip, Sheet, PlayerStatusBoard, StatusBadge } from '../components/ui.js';
import { qLabel, playerIndex, nameOf } from './shared.js';

/** 5) مقدمة السؤال (تظهر ثانيتين عند بداية كل سؤال). */
export function QuestionIntro(c) {
  const q = c.view.question;
  return h('div', { class: 'bc-intro', role: 'button', tabindex: '0', 'aria-label': 'ابدأ', onClick: () => c.dismissIntro(), onKeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') c.dismissIntro(); } },
    h('div', { class: 'bc-intro__no' }, qLabel(c.view)),
    h('div', { class: 'bc-intro__cat' }, q.category),
    Vinyl({ letter: q.letter, size: 'lg', spin: true, pop: true }),
    h('div', { class: 'bc-lead' }, 'الحرف ', h('b', { style: { color: 'var(--bc-butter)' } }, q.letter === 'ا' ? 'أ' : q.letter)),
    h('div', { class: 'bc-intro__tap' }, 'اضغط للمتابعة'));
}

function Top(c, q) {
  const v = c.view; const total = (q.endsAt - q.startedAt);
  return [
    Header({ left: qLabel(v), right: h('span', null, Countdown(q.endsAt, { label: '' }).firstChild) , rightTone: '' }),
    TimeBar(q.endsAt, total),
  ];
}

function Hero(c, q, size = 'md') {
  return h('div', { class: 'bc-qhero' },
    Ticket([h('div', { class: 'bc-ticket__cap' }, 'التصنيف'), h('div', { class: 'bc-ticket__name' }, q.category)], { tone: q.kind === 'final' ? 'flame' : 'butter', className: 'bc-cat-ticket' }),
    Vinyl({ letter: q.letter, size, spin: false, endsAt: q.endsAt, totalMs: q.endsAt - q.startedAt }));
}

/** 6+7+8) شاشة واحدة: اختار النقاط (وكارت ×٢ لو عايز) + اكتب الإجابة + أرسل — من غير خطوات منفصلة. */
function AnswerPanel(c, q) {
  const v = c.view; const m = q.mine; const final = q.kind === 'final';
  const key = `${v.roundNo}:${q.no}`; const max = v.settings.maxAnswerLength; const N = v.settings.questionCount;
  const val = c.ui.draft[key] || '';
  const locked = !final && m.points != null;                 // رقم متثبّت من قبل (مسار قديم): مفيش اختيار تاني
  const sel = locked ? m.points : c.ui.pendingPoints;
  const card = v.me.card;
  const cardAvail = !final && card.state === 'available' && !m.doubled;
  const dbl = !final && (m.doubled || (cardAvail && c.ui.pendingDouble === key));
  const used = new Set(v.me.used);

  const send = () => {
    const t = (c.ui.draft[key] || '').trim();
    if (!final && !sel) return c.toast('اختار رقم النقاط الأول');
    if (!t) return c.toast('اكتب إجابتك الأول');
    const extra = final ? {} : { points: sel, double: dbl && !m.doubled };
    c.act('submitAnswer', t, extra).then((r) => { if (r && r.ok) { delete c.ui.draft[key]; c.ui.pendingPoints = null; c.ui.pendingDouble = null; } });
  };
  const input = h('input', { class: 'bc-input bc-input--answer', 'data-bc-key': 'answer', maxlength: max, autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', enterkeyhint: 'send', value: val, placeholder: `كلمة تبدأ بحرف ${q.letter === 'ا' ? 'أ' : q.letter}`, 'aria-label': 'إجابتك',
    onInput: (e) => { c.ui.draft[key] = e.target.value; const cnt = e.target.parentNode.querySelector('.bc-count'); if (cnt) cnt.textContent = `${ar(e.target.value.length)} / ${ar(max)}`; },
    onKeydown: (e) => { if (e.key === 'Enter') send(); } });

  const board = final ? null : (locked
    ? h('div', { class: 'bc-locked' }, h('div', { class: 'bc-locked__n', style: { color: 'var(--bc-butter)' } }, ar(m.points), m.doubled && h('span', { class: 'bc-x2' }, '×٢')), h('div', { class: 'bc-locked__t' }, 'نقاطك للسؤال ده اتثبّتت'))
    : h('div', { class: 'bc-stack' },
      h('div', { class: 'bc-small' }, 'نقاط السؤال — كل رقم مرة واحدة بس · غلط = صفر'),
      h('div', { class: 'bc-numboard', role: 'group', 'aria-label': 'لوحة النقاط' }, Array.from({ length: N }, (_, i) => i + 1).map((n) => h('button', {
        type: 'button', class: `bc-num${used.has(n) ? ' is-used' : ''}${sel === n ? ' is-sel' : ''}`, disabled: used.has(n),
        'aria-pressed': String(sel === n), 'aria-label': used.has(n) ? `${n} مستخدم` : `${n}`,
        onClick: (e) => { const root = e.currentTarget.closest('.bc-root'); c.ui.pendingPoints = n; c.render(); const el = root && root.querySelector('[data-bc-key="answer"]'); if (el) el.focus({ preventScroll: true }); },
      }, ar(n))))));
  const dblBtn = (!final && (cardAvail || m.doubled)) && h('button', {
    type: 'button', class: `bc-card2${dbl ? ' is-on' : ''}`, disabled: !!m.doubled, 'aria-pressed': String(dbl),
    onClick: () => { c.ui.pendingDouble = dbl ? null : key; c.render(); },
  }, h('div', { class: 'bc-card2__bolt' }, '×٢'), h('div', { class: 'bc-card2__t' }, dbl ? 'كارت المضاعفة شغّال' : 'فعّل كارت ×٢', h('small', null, dbl ? (sel ? `نقاطك ${ar(sel * 2)} لو صح · مرة واحدة في الجولة` : 'مرة واحدة في الجولة') : 'مرة واحدة في الجولة · اختياري')));
  const usedCard = (!final && !cardAvail && !m.doubled) && h('div', { class: 'bc-small bc-center' }, `كارت ×٢ اتستخدم في السؤال ${ar(card.questionNo)}`);

  const finalBanner = final && h('div', { class: 'bc-locked' }, h('div', { class: 'bc-locked__n bc-neg' }, ar(m.wager || 0)), h('div', { class: 'bc-locked__t' }, 'رهانك: صح تكسبه، غلط تخسره.'));
  return h('div', { class: 'bc-stack' },
    finalBanner, board, dblBtn, usedCard,
    h('div', null, input, h('div', { class: 'bc-count' }, `${ar(val.length)} / ${ar(max)}`)),
    h('div', { class: 'bc-answer-send' },
      Button('أرسل', { size: 'lg', block: true, iconName: 'send', disabled: !final && !sel, onClick: send }),
      h('div', { class: 'bc-small bc-center', style: { marginTop: '6px' } }, 'مفيش تعديل بعد الإرسال')));
}

/** 9) لوبي السؤال: بعد الإرسال */
function Lobby(c, q) {
  const v = c.view;
  return h('div', { class: 'bc-stack' },
    h('div', { class: 'bc-note bc-note--ok' }, h('b', null, 'إجابتك اتبعتت ✓'), ' ', 'مينفعش تتعدّل. هنا بتشوف إجابات اللي أرسلوا زيك، والباقي بيظهر مع الإرسال.'),
    h('div', { class: 'bc-card' }, h('div', { class: 'bc-card__title' }, 'الإجابات', h('small', null, `${ar(q.submittedCount)} من ${ar(q.totalPresent)} أرسلوا`)),
      h('div', { class: 'bc-answers', 'aria-live': 'polite' }, q.answers.map((a) => h('div', { class: `bc-ans${a.playerId === v.viewerId ? ' is-me' : ''}` },
        Avatar({ name: a.name }, playerIndex(v, a.playerId), { size: 36 }), h('div', { class: 'bc-ans__main' }, h('div', { class: 'bc-ans__who' }, nameOf(v, a.playerId)), h('div', { class: 'bc-ans__text' }, a.text)))))),
    h('div', { class: 'bc-card' }, h('div', { class: 'bc-card__title' }, 'حالة اللاعبين'), PlayerStatusBoard(v, q)));
}

/** السؤال الجاري (للاعب): شاشة واحدة للنقاط والإجابة، وبعد الإرسال لوبي السؤال. */
export function QuestionScreen(c) {
  const v = c.view; const q = v.question;
  const m = q.mine;
  let body;
  if (!m) body = h('div', { class: 'bc-note' }, 'بتتفرج على الجولة.');
  else if (m.submitted) body = Lobby(c, q);
  else body = AnswerPanel(c, q);
  return h('div', { class: 'bc-screen' }, ...Top(c, q), Hero(c, q, 'md'), h('div', { class: 'bc-stack' }, body), h('div', { class: 'bc-grow' }), ScoreStrip(v));
}

/** 11) انتهاء السؤال — اللاعب منتظر التصحيح */
export function QuestionOverScreen(c) {
  const v = c.view; const q = v.question;
  const reason = q.closeReason === 'timeout' ? 'الوقت خلص' : q.closeReason === 'all_submitted' ? 'الكل أرسل' : 'الأدمن قفل السؤال';
  const picks = (q.reveal && q.reveal.picks) || {};
  return h('div', { class: 'bc-screen' },
    Header({ left: qLabel(v), right: reason }),
    h('div', { class: 'bc-over' }, 'انتهى السؤال'),
    h('div', { class: 'bc-center bc-stack' }, Ticket([h('div', { class: 'bc-ticket__cap' }, q.category), h('div', { class: 'bc-ticket__name' }, `حرف ${q.letter === 'ا' ? 'أ' : q.letter}`)], { tone: 'butter' }),
      h('div', { class: 'bc-lead' }, h('span', { class: 'bc-spinner' }), ' الأدمن بيراجع الإجابات...')),
    h('div', { class: 'bc-card' }, h('div', { class: 'bc-card__title' }, 'الإجابات'),
      q.answers.length ? h('div', { class: 'bc-answers' }, q.answers.map((a) => h('div', { class: `bc-ans${a.playerId === v.viewerId ? ' is-me' : ''}` },
        Avatar({ name: a.name }, playerIndex(v, a.playerId), { size: 36 }),
        h('div', { class: 'bc-ans__main' }, h('div', { class: 'bc-ans__who' }, nameOf(v, a.playerId)), h('div', { class: 'bc-ans__text' }, a.text)),
        picks[a.playerId] && h('div', { class: 'bc-ans__side' }, Chip(q.kind === 'final' ? `رهان ${ar(q.wagers ? q.wagers[a.playerId] : 0)}` : `${ar(picks[a.playerId].points)} نقطة${picks[a.playerId].doubled ? ' ×٢' : ''}`, 'butter')))))
        : h('div', { class: 'bc-hidden-note' }, 'محدش أرسل إجابة.')),
    h('div', { class: 'bc-grow' }), ScoreStrip(v));
}

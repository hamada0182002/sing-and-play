// شاشة ٩: التخمين بأربعة اختيارات · شاشة ١٠: نتيجة التخمين
import { h, ar } from '../components/dom.js';
import { Button, Ticket, Header } from '../components/ui.js';

const TONES = ['butter', 'olive', 'flame', 'ivory'];

export function GuessScreen(c) {
  const { view, ui } = c;
  const t = view.turn;
  const opts = t.guessOptions;
  const max = view.settings.maxGuesses;
  const fin = !!t.finalGuess; // الوقت خلص: مهلة قصيرة للاختيار، ومفيش رجوع للأسئلة
  let confirming = false;
  const confirmBtn = Button('ثبّت إجابتي', {
    variant: 'butter', size: 'lg', block: true, iconName: 'check', disabled: !ui.choice,
  });
  confirmBtn.addEventListener('click', async () => {
    if (confirming || !c.ui.choice) return;
    confirming = true; confirmBtn.disabled = true; // يمنع تكرار الإرسال
    const r = await c.act(c.adapter.submitGuess({ choiceId: c.ui.choice }));
    confirming = false;
    if (!r.ok) confirmBtn.disabled = false;
  });
  return h('div', { class: 'wai-guess' },
    h('div', { class: 'wai-screen', style: { maxWidth: '560px' } },
      Header({ left: `المحاولة ${ar(t.attempts.length + 1)} من ${ar(max)}`, right: h('span', { 'data-wai-time': '' }, '٣:٠٠') }),
      h('div', { class: 'wai-center', style: { marginTop: '16px' } },
        h('div', { class: `wai-eyebrow${fin ? ' wai-eyebrow--alert' : ''}` }, fin ? 'الوقت خلص! اختار قبل ما المهلة تخلص' : 'الوقت شغّال — فكّر كويس'),
        h('div', { class: 'wai-title wai-title--xl' }, 'أنا مين؟'),
        h('div', { class: 'wai-attempts', 'aria-label': 'المحاولات' },
          Array.from({ length: max }, (_, i) => h('span', { class: `wai-dot${i < t.attempts.length ? ' is-used' : ''}` }))),
        fin && h('div', { class: 'wai-time wai-time--final', role: 'timer' },
          h('span', { class: 'wai-time__n', 'data-wai-time': '' }, '٠:١٠'))),
      h('div', { class: 'wai-opts', role: 'radiogroup', 'aria-label': 'اختار الشخصية' },
        opts.map((o, i) => h('button', {
          class: `wai-opt wai-ticket wai-ticket--${TONES[i % TONES.length]}${ui.choice === o.id ? ' is-sel' : ''}`,
          type: 'button', role: 'radio', 'aria-checked': String(ui.choice === o.id),
          onClick: () => c.setUi({ choice: o.id }),
        }, h('div', { class: 'wai-ticket__name' }, o.name)))),
      h('div', { class: 'wai-footer wai-footer--sticky' },
        confirmBtn,
        !fin && Button('لسه، رجّعني للأسئلة', { variant: 'ghost', size: 'sm', block: true, iconName: 'back', onClick: () => { c.ui.choice = null; c.act(c.adapter.cancelGuess()); } }))));
}

export function GuessResultScreen(c) {
  const r = c.ui.guessResult;
  const close = () => c.setUi({ guessResult: null });
  let body;
  if (r.correct) {
    body = [
      h('div', { class: 'wai-result__big wai-result__big--ok' }, 'برافو! 🎉'),
      h('div', { class: 'wai-lead' }, `عرفتها من المحاولة ${ar(r.n)}`),
      h('div', { class: 'wai-points' }, `+${ar(r.points)}`),
      h('div', { class: 'wai-small' }, 'نقطة — هنكشف الشخصية دلوقتي'),
    ];
  } else if (r.exhausted) {
    body = [
      h('div', { class: 'wai-result__big wai-result__big--bad' }, 'خلصت محاولاتك'),
      h('div', { class: 'wai-lead' }, `مش ${r.choice.name}`),
      h('div', { class: 'wai-points', style: { color: 'var(--wai-flame)' } }, ar(0)),
      h('div', { class: 'wai-small' }, 'نقطة — هنكشف الشخصية دلوقتي'),
    ];
  } else {
    body = [
      h('div', { class: 'wai-result__big wai-result__big--bad' }, 'غلط!'),
      Ticket(h('div', { class: 'wai-ticket__name', style: { textDecoration: 'line-through', opacity: .8 } }, r.choice.name), { tone: 'brick' }),
      h('div', { class: 'wai-lead' }, r.final
        ? `فاضل لك ${ar(r.left)} ${r.left === 1 ? 'محاولة' : 'محاولات'} — اختار تاني بسرعة!`
        : `فاضل لك ${ar(r.left)} ${r.left === 1 ? 'محاولة' : 'محاولات'}. كمّل الأسئلة وقرّب!`),
    ];
  }
  return h('div', { class: 'wai-result', role: 'alertdialog', 'aria-label': 'نتيجة التخمين', onClick: close },
    h('div', { class: 'wai-result__card' }, ...body,
      Button(r.correct || r.exhausted ? 'تمام' : r.final ? 'كمّل التخمين' : 'كمّل الأسئلة', { variant: r.correct ? 'butter' : 'flame', size: 'md', onClick: close })));
}

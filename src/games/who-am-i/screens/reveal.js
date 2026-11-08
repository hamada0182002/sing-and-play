// شاشة ١١: كشف الشخصية بعد نهاية الدور · شاشة ١٢: الانتقال للاعب التالي
import { h, ar, roomLabel } from '../components/dom.js';
import { Button, Header, Ticket, CategoryChip, ScoreStrip, Vinyl, Avatar, colorIndex, Chip } from '../components/ui.js';

export function RevealScreen(c) {
  const { view } = c;
  const t = view.turn;
  const me = view.viewerId;
  const p = view.players.find((x) => x.id === t.playerId);
  const mine = t.playerId === me;
  const who = mine ? 'أنت' : p.name;
  const answered = t.questions.filter((q) => q.status === 'answered').length;
  const isHost = view.players.find((x) => x.isHost)?.id === me;
  const headline = {
    correct: mine ? 'عرفتها! 🎉' : `${p.name} عرفها! 🎉`,
    timeout: 'الوقت خلص ⏱',
    exhausted: 'خلصت المحاولات',
  }[t.outcome];
  const sub = {
    correct: `${who} خمّن صح من المحاولة ${ar(t.attempts.length)} وكسب ${ar(t.points)} نقطة`,
    timeout: `${who} ما لحقش يعرف — صفر نقطة`,
    exhausted: `${who} استهلك ${ar(t.attempts.length)} محاولات — صفر نقطة`,
  }[t.outcome];
  const isLast = view.remaining.length === 0;
  return h('div', { class: 'wai-screen' },
    Header({ left: `الدور ${ar(t.turnNo)} / ${ar(view.players.length)}`, right: `الغرفة ${roomLabel(view.roomId)}` }),
    h('div', { class: 'wai-center', style: { marginTop: '16px' } },
      h('div', { class: 'wai-eyebrow' }, 'الشخصية كانت'),
      h('div', { class: 'wai-reveal-card' },
        h('div', { class: 'wai-reveal-card__in' },
          Ticket([h('div', { class: 'wai-ticket__name' }, t.character.name), h('div', { style: { marginTop: '6px' } }, CategoryChip(t.character.category))],
            { tone: t.outcome === 'correct' ? 'butter' : 'ivory' })))),
    h('div', { class: 'wai-center', style: { marginTop: '14px' } },
      h('div', { class: `wai-title`, style: t.outcome === 'correct' ? null : { color: 'var(--wai-flame)' } }, headline),
      h('p', { class: 'wai-lead', style: { margin: '4px 0 0' } }, sub),
      h('div', { class: 'wai-row', style: { justifyContent: 'center', marginTop: '10px', flexWrap: 'wrap' } },
        Chip(`${ar(answered)} أسئلة اتجاوبت`, 'ivory'), Chip(`${ar(t.attempts.length)} محاولات تخمين`, 'ivory'))),
    h('div', { class: 'wai-grow' }),
    h('div', { class: 'wai-footer' },
      h('div', { class: 'wai-bar', 'aria-hidden': 'true' }, h('i', { 'data-wai-bar': '' })),
      h('div', { class: 'wai-small wai-center' }, isLast ? 'بعد لحظات: ترتيب الجولة النهائي' : 'الدور اللي بعده هيبدأ تلقائيًا'),
      isHost && Button(isLast ? 'شوف الترتيب' : 'التالي', { variant: 'butter', size: 'md', block: true, iconName: 'next', onClick: () => c.act(c.adapter.advance()) }),
      ScoreStrip(view, view.players, { activeId: t.playerId })));
}

export function TransitionScreen(c) {
  const { view } = c;
  const nextId = view.nextPlayerId;
  const next = view.players.find((x) => x.id === nextId);
  const isMe = nextId === view.viewerId;
  const done = view.results.length;
  return h('div', { class: 'wai-screen' },
    Header({ left: `الدور ${ar(done + 1)} / ${ar(view.players.length)}`, right: `الغرفة ${roomLabel(view.roomId)}` }),
    h('div', { class: 'wai-grow' }),
    h('div', { class: 'wai-center' },
      h('div', { class: 'wai-eyebrow' }, 'الدور القادم'),
      Vinyl({ label: h('span', { 'data-wai-count': '' }, '٣'), progress: 1, size: 'lg', spin: true }),
      h('div', { class: 'wai-title wai-title--xl', style: { marginTop: '14px' } }, isMe ? 'دورك أنت!' : next.name),
      h('p', { class: 'wai-lead' }, isMe ? 'جهّز نفسك — هتخمّن شخصية الكل شايفها إلا إنت' : 'الكل هيشوف الشخصية إلا هو — جهّزوا إجاباتكم')),
    h('div', { class: 'wai-grow' }),
    h('div', { class: 'wai-footer' },
      h('div', { class: 'wai-bar', 'aria-hidden': 'true' }, h('i', { 'data-wai-bar': '' })),
      ScoreStrip(view, view.players, { activeId: nextId })));
}

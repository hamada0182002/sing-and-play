// شاشة ١: تعريف اللعبة والقوانين
import { h, ar, durationText } from '../components/dom.js';
import { Button, Ticket, Vinyl } from '../components/ui.js';

export function IntroScreen(c) {
  const s = c.ctx.gameSettings;
  const rule = (n, ...t) => h('div', { class: 'wai-rule' }, h('div', { class: 'wai-rule__n' }, ar(n)), h('div', { class: 'wai-rule__t' }, ...t));
  return h('div', { class: 'wai-screen' },
    h('div', { class: 'wai-brand' }, 'SING & ', h('b', null, 'PLAY')),
    h('div', { class: 'wai-center', style: { marginTop: '4px' } },
      Vinyl({ label: '؟', progress: 1, size: 'sm', spin: true }),
      h('h1', { class: 'wai-title wai-title--xl', style: { marginTop: '6px' } }, 'أنا مين؟'),
      h('p', { class: 'wai-lead', style: { margin: '2px 0 0' } }, `لعبة جماعية من ${ar(s.minPlayers)} لـ ${ar(s.maxPlayers)} لاعبين — كلها كتابة، من غير ميكروفون.`)),
    h('div', { class: 'wai-stack', style: { margin: '14px 0 12px', gap: '10px' } },
      rule(1, 'كل لاعب له دور مدته ', h('b', null, durationText(s.turnSeconds)), '. النظام يختار لك شخصية عشوائية، والكل يشوفها ', h('b', null, 'إلا أنت'), '.'),
      rule(2, 'اسأل أي لاعب سؤال مكتوب، وهو بس اللي يجاوب: ', h('b', null, 'أيوه · لأ · ممكن · مش عارف'), '. الإجابة بتظهر للجميع في السجل.'),
      rule(3, 'في أي وقت اضغط ', h('b', null, '«أنا عرفت!»'), ' واختار من ٤ شخصيات. معاك ', h('b', null, `${ar(s.maxGuesses)} محاولات`), '.'),
      rule(4, 'كل ما عرفت أسرع بمحاولات أقل، كسبت نقاط أكتر:')),
    h('div', { class: 'wai-pts' },
      ...s.points.map((p, i) => Ticket([
        h('div', { class: 'wai-ticket__name' }, ar(p)),
        h('div', { style: { fontSize: '12px', fontWeight: 800 } }, ['من أول محاولة', 'تاني محاولة', 'تالت محاولة'][i]),
      ], { tone: ['butter', 'olive', 'flame'][i] }))),
    h('p', { class: 'wai-small wai-center', style: { margin: '12px 0 0' } }, 'انتهى الوقت أو خلصت المحاولات؟ صفر نقطة. وبعد ما الكل يلعب تظهر لوحة الترتيب.'),
    h('div', { class: 'wai-footer wai-footer--sticky' },
      Button('يلا نبدأ', { variant: 'butter', size: 'lg', block: true, iconName: 'next', onClick: () => c.setUi({ screen: null }) })));
}

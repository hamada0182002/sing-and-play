// 1) شاشة الدخول: اسم اللعبة + القواعد المختصرة
import { h, ar } from '../components/dom.js';
import { Button, rich } from '../components/ui.js';
import { GAME_NAME, GAME_NAME_EN, BRAND, RULES } from '../data/copy.js';

function hero() {
  return h('div', { class: 'bc-hero' }, h('svg', { viewBox: '0 0 320 150', 'aria-hidden': 'true' },
    h('rect', { x: 30, y: 30, width: 260, height: 78, rx: 22, fill: '#F2B93B' }),
    h('rect', { x: 46, y: 44, width: 44, height: 30, rx: 8, fill: '#101412' }),
    h('rect', { x: 100, y: 44, width: 44, height: 30, rx: 8, fill: '#101412' }),
    h('rect', { x: 154, y: 44, width: 44, height: 30, rx: 8, fill: '#101412' }),
    h('rect', { x: 208, y: 44, width: 64, height: 30, rx: 8, fill: '#101412' }),
    h('rect', { x: 30, y: 84, width: 260, height: 10, fill: '#F26A2E' }),
    h('circle', { cx: 86, cy: 112, r: 18, fill: '#101412', stroke: '#F4EBD9', 'stroke-width': 5 }),
    h('circle', { cx: 234, cy: 112, r: 18, fill: '#101412', stroke: '#F4EBD9', 'stroke-width': 5 }),
    h('circle', { cx: 160, cy: 20, r: 12, fill: '#B5391F' })));
}

export function IntroScreen(c) {
  return h('div', { class: 'bc-screen' },
    h('div', { class: 'bc-brand' }, h('b', null, 'SING'), ' & PLAY'),
    hero(),
    h('div', { class: 'bc-center' },
      h('div', { class: 'bc-eyebrow' }, GAME_NAME_EN),
      h('h1', { class: 'bc-title bc-title--xl', style: { margin: 0 } }, GAME_NAME),
      h('p', { class: 'bc-lead' }, 'من ٣ إلى ١٠ لاعبين. إجابة واحدة، حرف واحد، وجولة تتحسم في آخر سؤال.')),
    h('div', { class: 'bc-card' }, h('div', { class: 'bc-card__title' }, 'القواعد'),
      RULES.map((r, i) => h('div', { class: 'bc-rule' }, h('div', { class: 'bc-rule__n' }, ar(i + 1)), h('div', { class: 'bc-rule__t' }, rich(r.t))))),
    h('div', { class: 'bc-footer' },
      Button('ادخل الغرفة', { size: 'lg', block: true, iconName: 'next', onClick: () => c.enter() }),
      h('div', { class: 'bc-small bc-center' }, `${BRAND} · نقاط الجولة منفصلة عن نقاط المنصة`)));
}

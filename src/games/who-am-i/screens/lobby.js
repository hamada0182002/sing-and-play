// شاشة ٢: انتظار وتجهيز اللاعبين (اللاعبون والغرفة تأتي من المنصة — لا نظام غرف هنا)
import { h, ar, durationText, roomLabel } from '../components/dom.js';
import { Button, Avatar, Chip, Header } from '../components/ui.js';

export function LobbyScreen(c) {
  const { view } = c;
  const s = view.settings;
  const n = view.players.length;
  const me = view.viewerId;
  const isHost = view.players.find((p) => p.isHost)?.id === me;
  const okCount = n >= s.minPlayers && n <= s.maxPlayers;
  return h('div', { class: 'wai-screen' },
    Header({ left: 'أنا مين؟', right: `الغرفة ${roomLabel(view.roomId)}` }),
    h('div', { class: 'wai-center', style: { marginTop: '18px' } },
      h('div', { class: 'wai-eyebrow' }, view.roundNo ? 'جاهزين للجولة الجاية؟' : 'تجهيز اللاعبين'),
      h('div', { class: 'wai-title' }, `${ar(n)} لاعبين في الغرفة`)),
    h('div', { class: 'wai-players' },
      view.players.map((p, i) => h('div', { class: `wai-lobbyp${p.id === me ? ' is-me' : ''}` },
        Avatar(p, i, { size: 52 }),
        h('div', null, p.name),
        h('small', null, p.isHost ? 'المضيف' : p.id === me ? 'أنت' : 'جاهز')))),
    !okCount && h('div', { class: 'wai-note wai-note--warn' },
      n < s.minPlayers ? `محتاجين ${ar(s.minPlayers)} لاعبين على الأقل عشان نبدأ.` : `الحد الأقصى ${ar(s.maxPlayers)} لاعبين في الجولة.`),
    h('div', { class: 'wai-note', style: { marginTop: '10px' } },
      `كل لاعب له دور ${durationText(s.turnSeconds)}. ترتيب الأدوار عشوائي ومحدش بيلعب مرتين في نفس الجولة.`),
    h('div', { class: 'wai-footer wai-footer--sticky' },
      isHost
        ? Button('ابدأ الجولة', { variant: 'butter', size: 'lg', block: true, iconName: 'next', disabled: !okCount, onClick: () => c.act(c.adapter.startRound()) })
        : h('div', { class: 'wai-note wai-center' }, 'مستنيين المضيف يبدأ الجولة…'),
      Button('القوانين', { variant: 'ghost', size: 'sm', block: true, iconName: 'info', onClick: () => c.setUi({ screen: 'intro' }) })));
}

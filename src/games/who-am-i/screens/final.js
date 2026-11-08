// شاشة ١٣: لوحة النتائج النهائية · شاشة ١٤: بدء جولة جديدة
import { h, ar, arGroup, durationText, roomLabel } from '../components/dom.js';
import { Button, Avatar, Header, Ticket, Chip, colorIndex } from '../components/ui.js';
import { CATEGORIES } from '../data/categories.js';

function rankRows(view) {
  const rows = view.players
    .map((p) => ({ id: p.id, name: p.name, score: view.scores[p.id] || 0 }))
    .sort((a, b) => b.score - a.score);
  let rank = 0; let prev = null;
  rows.forEach((r, i) => { if (r.score !== prev) { rank = i + 1; prev = r.score; } r.rank = rank; });
  return rows;
}

export function FinalScreen(c) {
  const { view } = c;
  const rows = rankRows(view);
  const me = view.viewerId;
  const top = rows.filter((r) => r.rank <= 3).slice(0, 3);
  // ترتيب المنصة: الثاني — الأول — الثالث
  const order = [top[1], top[0], top[2]].filter(Boolean);
  const heights = { 1: 120, 2: 90, 3: 66 };
  const tones = { 1: 'var(--wai-butter)', 2: 'var(--wai-ivory)', 3: 'var(--wai-flame)' };
  const winner = rows[0];
  const results = view.results;
  return h('div', { class: 'wai-screen' },
    Header({ left: `نتيجة الجولة ${ar(view.roundNo)}`, right: `الغرفة ${roomLabel(view.roomId)}` }),
    h('div', { class: 'wai-center', style: { marginTop: '16px' } },
      h('div', { class: 'wai-eyebrow' }, 'الفايز'),
      h('div', { class: 'wai-title wai-title--xl' }, winner.score > 0 ? (winner.id === me ? 'إنت الفايز! 🏆' : `${winner.name} 🏆`) : 'مفيش فايز المرة دي')),
    h('div', { class: 'wai-podium' },
      order.map((r) => h('div', { class: 'wai-podium__col' },
        Avatar({ name: r.name }, colorIndex(view.players, r.id), { size: 52, ring: r.rank === 1 }),
        h('div', { class: 'wai-podium__name' }, r.id === me ? 'أنت' : r.name),
        h('div', { class: 'wai-podium__pts' }, ar(r.score)),
        h('div', { class: 'wai-podium__block', style: { height: `${heights[r.rank] || 60}px`, background: tones[r.rank] || 'var(--wai-olive)' } }, ar(r.rank))))),
    h('div', { class: 'wai-log__title', style: { marginTop: '10px' } }, 'الترتيب الكامل'),
    h('div', { class: 'wai-rows' },
      rows.map((r) => {
        const res = results.find((x) => x.playerId === r.id);
        const total = (view.existingScores[r.id] || 0) + r.score;
        return h('div', { class: `wai-prow${r.id === me ? ' is-me' : ''}` },
          h('div', { class: 'wai-prow__rank' }, ar(r.rank)),
          Avatar({ name: r.name }, colorIndex(view.players, r.id), { size: 40 }),
          h('div', { class: 'wai-prow__name' }, r.id === me ? `${r.name} (أنت)` : r.name,
            h('div', { class: 'wai-prow__sub' }, res ? `الشخصية: ${res.character.name}` : '', ' · ', `رصيدك في المنصة ${arGroup(total)}`)),
          h('div', { class: 'wai-prow__pts' }, `+${ar(r.score)}`));
      })),
    h('div', { class: 'wai-footer wai-footer--sticky' },
      Button('جولة جديدة', { variant: 'butter', size: 'lg', block: true, iconName: 'replay', onClick: () => c.setUi({ screen: 'newround' }) }),
      c.onExit && Button('رجوع للغرفة', { variant: 'ghost', size: 'sm', block: true, onClick: () => c.onExit() })));
}

export function NewRoundScreen(c) {
  const { view } = c;
  const s = view.settings;
  const me = view.viewerId;
  const isHost = view.players.find((p) => p.isHost)?.id === me;
  const n = view.players.length;
  const ok = n >= s.minPlayers && n <= s.maxPlayers;
  return h('div', { class: 'wai-screen' },
    Header({ left: 'أنا مين؟', right: `الغرفة ${roomLabel(view.roomId)}` }),
    h('div', { class: 'wai-center', style: { marginTop: '24px' } },
      h('div', { class: 'wai-eyebrow' }, 'جاهزين؟'),
      h('div', { class: 'wai-title wai-title--xl' }, `الجولة ${ar(view.roundNo + 1)}`),
      h('p', { class: 'wai-lead' }, 'النقاط هتبدأ من الصفر، وكل لاعب هياخد دور جديد بشخصية جديدة.')),
    h('div', { class: 'wai-players' },
      view.players.map((p, i) => h('div', { class: `wai-lobbyp${p.id === me ? ' is-me' : ''}` }, Avatar(p, i, { size: 48 }), h('div', null, p.name), h('small', null, p.isHost ? 'المضيف' : 'جاهز')))),
    h('div', { class: 'wai-note' }, `${ar(n)} لاعبين · دور كل لاعب ${durationText(s.turnSeconds)} · ${ar(s.maxGuesses)} محاولات تخمين`),
    !ok && h('div', { class: 'wai-note wai-note--warn', style: { marginTop: '10px' } }, `عدد اللاعبين لازم يكون بين ${ar(s.minPlayers)} و${ar(s.maxPlayers)}.`),
    h('div', { class: 'wai-footer wai-footer--sticky' },
      isHost
        ? Button(`ابدأ الجولة ${ar(view.roundNo + 1)}`, { variant: 'butter', size: 'lg', block: true, iconName: 'next', disabled: !ok, onClick: () => c.act(c.adapter.startRound()) })
        : h('div', { class: 'wai-note wai-center' }, 'مستنيين المضيف يبدأ الجولة الجديدة…'),
      Button('ارجع للنتائج', { variant: 'ghost', size: 'sm', block: true, iconName: 'back', onClick: () => c.setUi({ screen: null }) })));
}

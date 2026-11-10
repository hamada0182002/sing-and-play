// 12) مراجعة الأدمن · 13) نتائج السؤال (+ معاينة الجاي للأدمن) · 15) رهان نهائي · 16) نتيجة السؤال النهائي · 17) الترتيب النهائي
import { h, icon, ar, signed } from '../components/dom.js';
import { Button, Avatar, Chip, Header, Ticket, Countdown, ScoreStrip, Sheet, StatusBadge, TimeBar } from '../components/ui.js';
import { qLabel, playerIndex, nameOf } from './shared.js';
import { letterLabel, ARABIC_LETTERS } from '../data/letters.js';

export function reviewTable(c, rev, { editable }) {
  const v = c.view;
  return h('div', { class: 'bc-review' }, rev.rows.filter((r) => !r.left || r.answer).map((r) => {
    const has = r.answer != null;
    const auto = r.source !== 'admin';
    return h('div', { class: `bc-rv${r.unresolved ? ' is-pending' : ''}` },
      h('div', null, h('div', { class: 'bc-rv__name' }, Avatar({ name: r.name }, playerIndex(v, r.playerId), { size: 24 }), r.name, StatusBadge(r.status), r.dup && r.status !== 'duplicate' && Chip('مكرر', 'flame')),
        h('div', { class: `bc-rv__text${has ? '' : ' is-none'}` }, has ? r.answer : 'لم يرسل')),
      editable && has && h('div', { class: 'bc-rv__actions' },
        h('button', { type: 'button', class: `bc-iconbtn bc-iconbtn--ok${r.status === 'correct' && !auto ? ' is-on' : ''}`, 'aria-label': `صح لـ${r.name}`, onClick: () => c.act('gradeAnswer', { questionNo: rev.questionNo, playerId: r.playerId, status: 'correct' }) }, icon('check', 22)),
        h('button', { type: 'button', class: `bc-iconbtn bc-iconbtn--no${r.status === 'wrong' && !auto ? ' is-on' : ''}`, 'aria-label': `غلط لـ${r.name}`, onClick: () => c.act('gradeAnswer', { questionNo: rev.questionNo, playerId: r.playerId, status: 'wrong' }) }, icon('x', 22))),
      h('div', { class: 'bc-rv__meta' },
        h('span', null, `${r.wager != null ? `رهان ${ar(r.wager)}` : `${ar(r.points)} نقطة${r.doubled ? ' ×٢' : ''}`}`),
        r.reasonText && r.status !== 'correct' && h('span', null, `· ${r.reasonText}`),
        h('span', { style: { marginInlineStart: 'auto', fontWeight: 800 }, class: r.delta > 0 ? 'bc-pos' : r.delta < 0 ? 'bc-neg' : 'bc-zero' }, `${signed(r.delta)} نقطة`)));
  }));
}

/** 12) شاشة المراجعة للأدمن */
export function AdminReviewScreen(c) {
  const v = c.view; const q = v.question; const rev = v.admin.reviews[q.no];
  const pending = rev.unresolvedCount;
  return h('div', { class: 'bc-screen bc-screen--wide' },
    Header({ left: `${qLabel(v)} · مراجعة`, right: pending ? `${ar(pending)} محتاجة قرار` : 'جاهز للاعتماد', rightTone: pending ? 'bc-pill--flame' : '' }),
    h('div', { class: 'bc-row', style: { justifyContent: 'center' } }, Chip(q.category, 'butter'), Chip(`حرف ${letterLabel(q.letter)}`, 'ivory'), Chip(q.kind === 'final' ? 'سؤال نهائي' : 'سؤال عادي', 'line')),
    pending > 0 && h('div', { class: 'bc-note bc-note--warn' }, `${ar(pending)} إجابة محتاجة قرارك (صح/غلط) قبل الاعتماد. الاعتماد بيحسب النقاط ويعرضها للكل.`),
    h('div', { class: 'bc-bulk' },
      Button('الكل صح', { variant: 'dark', size: 'sm', iconName: 'check', onClick: () => c.act('bulkGrade', { questionNo: q.no, status: 'correct' }) }),
      Button('الكل غلط', { variant: 'dark', size: 'sm', iconName: 'x', onClick: () => c.act('bulkGrade', { questionNo: q.no, status: 'wrong' }) })),
    reviewTable(c, rev, { editable: true }),
    h('div', { class: 'bc-footer bc-footer--sticky' },
      Button('اعتمد النتيجة', { size: 'lg', block: true, variant: 'flame', iconName: 'check', disabled: !rev.canApprove, onClick: () => c.act('approveQuestion') }),
      h('button', { class: 'bc-link', type: 'button', onClick: () => c.confirmEnd() }, 'إنهاء الجولة الآن')));
}

/** 13)+16) نتائج السؤال (العادي والنهائي) */
export function ResultsScreen(c) {
  const v = c.view; const q = v.question; const final = q.kind === 'final';
  const mine = q.results.find((r) => r.playerId === v.viewerId);
  const rows = q.results.slice().sort((a, b) => b.delta - a.delta || b.total - a.total);
  const nextBtn = v.isAdmin && h('div', { class: 'bc-footer bc-footer--sticky' },
    Button(final ? 'اعرض الترتيب النهائي' : (c.view.nextQuestion ? 'السؤال التالي' : 'الرهان النهائي'), { size: 'lg', block: true, variant: 'flame', iconName: 'next', onClick: () => c.act('advance') }),
    !final && h('button', { class: 'bc-link', type: 'button', onClick: () => c.confirmEnd() }, 'إنهاء الجولة الآن'));
  return h('div', { class: `bc-screen${v.isAdmin ? ' bc-screen--wide' : ''}` },
    Header({ left: `${qLabel(v)} · النتيجة`, right: v.phaseEndsAt ? h('span', null, Countdown(v.phaseEndsAt, { label: '' }).firstChild) : null }),
    v.phaseEndsAt && TimeBar(v.phaseEndsAt, v.settings.resultsSeconds * 1000),
    mine && Ticket([h('div', { class: 'bc-mine' },
      h('div', { class: 'bc-ticket__cap' }, final ? 'نتيجة الرهان' : 'نقاطك في السؤال'),
      h('div', { class: 'bc-mine__delta' }, signed(mine.delta)),
      h('div', { class: 'bc-mine__t' }, mine.status === 'correct' ? 'إجابة صح 🎉' : mine.status === 'duplicate' ? 'إجابة مكررة' : (mine.answer ? 'إجابة غلط' : 'ما أرسلتش إجابة')),
      mine.doubled && h('span', { class: 'bc-x2' }, '×٢ اتفعّل'))], { tone: mine.delta > 0 ? 'olive' : mine.delta < 0 ? 'brick' : 'dark' }),
    h('div', { class: 'bc-card' }, h('div', { class: 'bc-card__title' }, `${q.category} · حرف ${letterLabel(q.letter)}`),
      h('div', { class: 'bc-review' }, rows.map((r) => h('div', { class: `bc-res${r.playerId === v.viewerId ? ' is-me' : ''}` },
        Avatar({ name: r.name }, playerIndex(v, r.playerId), { size: 38 }),
        h('div', null, h('div', { class: `bc-res__ans${r.answer ? '' : ' bc-zero'}` }, r.answer || '—'), h('div', { class: 'bc-res__sub' }, nameOf(v, r.playerId), StatusBadge(r.status), final ? Chip(`رهان ${ar(r.wager || 0)}`, 'line') : Chip(`${ar(r.points)}${r.doubled ? ' ×٢' : ''}`, 'line'))),
        h('div', null, h('div', { class: `bc-res__delta ${r.delta > 0 ? 'bc-pos' : r.delta < 0 ? 'bc-neg' : 'bc-zero'}` }, signed(r.delta)), h('div', { class: 'bc-res__total' }, `إجمالي ${ar(r.total)}`)))))),
    v.isAdmin && NextPreview(c),
    v.isAdmin && v.admin.reviews[q.no] && h('details', { class: 'bc-adv' }, h('summary', null, 'تعديل نتيجة هذا السؤال (الأدمن)', icon('next', 18)), reviewTable(c, v.admin.reviews[q.no], { editable: true })),
    nextBtn, h('div', { class: 'bc-grow' }), ScoreStrip(v));
}

/** معاينة السؤال الجاي — للأدمن فقط، ويقدر يغيّر الحرف/التصنيف قبل ما يبدأ. */
function NextPreview(c) {
  const v = c.view; const nq = v.nextQuestion;
  if (!nq) return h('div', { class: 'bc-note' }, 'الخطوة الجاية: الرهان النهائي.');
  const cats = v.settings.categories.filter((x) => x.enabled);
  return h('div', { class: 'bc-next' },
    h('div', { class: 'bc-card__title' }, 'السؤال الجاي', h('small', null, 'للأدمن فقط — اللاعبين مش شايفينه')),
    h('div', { class: 'bc-row' }, Chip(`${ar(nq.no)}`, 'line'), Chip(nq.category, 'butter'), Chip(`حرف ${letterLabel(nq.letter)}`, 'ivory'),
      Button('حرف تاني', { variant: 'dark', size: 'sm', iconName: 'dice', onClick: () => c.act('adjustNext', { reroll: true }) })),
    h('details', { class: 'bc-adv' }, h('summary', null, 'اختار يدويًا', icon('next', 18)),
      h('div', { class: 'bc-stack' },
        h('div', { class: 'bc-pickgrid' }, cats.map((x) => h('button', { type: 'button', class: `bc-tab${x.id === nq.categoryId ? ' is-on' : ''}`, onClick: () => c.act('adjustNext', { categoryId: x.id }) }, x.name))),
        h('div', { class: 'bc-lettergrid' }, ARABIC_LETTERS.map((l) => h('button', { type: 'button', class: `bc-letter${l === nq.letter ? ' is-on' : ''}`, onClick: () => c.act('adjustNext', { letter: l }) }, letterLabel(l)))))));
}

/** 15) الرهان النهائي */
export function WagerScreen(c) {
  const v = c.view; const w = v.wager; const mine = w.mine; const locked = mine != null;
  const sel = c.ui.pendingWager;
  const confirmed = w.players.filter((p) => p.confirmed).length;
  return h('div', { class: 'bc-screen' },
    Header({ left: 'السؤال النهائي · الرهان', right: h('span', null, Countdown(w.endsAt, { label: '' }).firstChild) }),
    TimeBar(w.endsAt, v.settings.wagerSeconds * 1000),
    h('div', { class: 'bc-center bc-stack' }, h('div', { class: 'bc-title' }, 'راهن على الإجابة'), h('div', { class: 'bc-lead' }, 'التصنيف والحرف هيظهروا بعد ما الرهان يتقفل. رهانات الباقيين مخفية لحد وقتها.')),
    h('div', { class: 'bc-wagers', role: 'radiogroup', 'aria-label': 'قيمة الرهان' }, w.options.map((o) => {
      const on = locked ? mine === o : sel === o;
      return h('button', { type: 'button', role: 'radio', 'aria-checked': String(on), class: `bc-wager${on ? ' is-sel' : ''}`, disabled: locked, onClick: () => { c.ui.pendingWager = o; c.render(); } }, h('span', { class: 'bc-wager__n' }, ar(o)), h('span', { class: 'bc-wager__t' }, o === 0 ? 'من غير مخاطرة' : 'نقطة'));
    })),
    (locked || sel != null) && h('div', { class: 'bc-stakes' }, h('div', { class: 'bc-stake bc-stake--win' }, 'لو صح', h('b', null, `+${ar(locked ? mine : sel)}`)), h('div', { class: 'bc-stake bc-stake--lose' }, 'لو غلط', h('b', null, `−${ar(locked ? mine : sel)}`))),
    locked ? h('div', { class: 'bc-note bc-note--ok' }, `رهانك (${ar(mine)}) اتأكّد ومينفعش يتغيّر. مستنيين الباقي...`)
      : Button('أكّد الرهان', { size: 'lg', block: true, iconName: 'lock', disabled: sel == null, onClick: () => c.act('lockWager', sel) }),
    h('div', { class: 'bc-card' }, h('div', { class: 'bc-card__title' }, 'اللي أكّدوا', h('small', null, `${ar(confirmed)} من ${ar(w.players.length)}`)),
      h('div', { class: 'bc-cats' }, w.players.map((p) => Chip(`${p.confirmed ? '✓' : '…'} ${p.id === v.viewerId ? 'أنا' : p.name}`, p.confirmed ? 'olive' : 'line')))),
    v.isAdmin && h('div', { class: 'bc-footer' }, Button('اقفل الرهان وابدأ السؤال', { variant: 'flame', block: true, iconName: 'next', onClick: () => c.act('advance') })),
    h('div', { class: 'bc-grow' }), ScoreStrip(v));
}

function confetti() {
  const cols = ['#F2B93B', '#F26A2E', '#8A9145', '#F4EBD9', '#B5391F'];
  return h('div', { class: 'bc-confetti', 'aria-hidden': 'true' }, Array.from({ length: 28 }, (_, i) => h('i', { style: { left: `${(i * 37) % 100}%`, background: cols[i % cols.length], animationDuration: `${3 + (i % 5) * 0.6}s`, animationDelay: `${(i % 7) * 0.35}s` } })));
}

/** 17) الترتيب النهائي (تعادل = نفس المركز) */
export function StandingsScreen(c) {
  const v = c.view; const st = v.standings; const rows = st.rows;
  const winners = rows.filter((r) => st.winners.includes(r.id));
  const top3 = rows.filter((r) => r.rank <= 3).slice(0, 3);
  const meRow = rows.find((r) => r.id === v.viewerId);
  const podOrder = [top3.find((r) => r.rank === 2), top3.find((r) => r.rank === 1), top3.find((r) => r.rank === 3)].filter(Boolean);
  const heights = { 1: 120, 2: 90, 3: 66 }; const tones = { 1: 'var(--bc-butter)', 2: 'var(--bc-ivory)', 3: 'var(--bc-flame)' };
  return h('div', { class: 'bc-screen' },
    Header({ left: 'النتيجة النهائية', right: st.early ? 'انتهت بقرار الأدمن' : null }),
    h('div', { class: 'bc-winner' }, confetti(), h('div', { class: 'bc-winner__crown' }, icon('crown', 56)),
      h('div', { class: 'bc-eyebrow' }, winners.length > 1 ? 'تعادل على المركز الأول' : 'الفائز'),
      h('div', { class: 'bc-winner__name' }, winners.map((w) => w.name).join(' و ')),
      h('div', { class: 'bc-winner__pts' }, `${ar(winners[0] ? winners[0].total : 0)} نقطة`)),
    h('div', { class: 'bc-podium' }, podOrder.map((r) => h('div', { class: 'bc-podium__col' }, Avatar({ name: r.name }, playerIndex(v, r.id), { size: 48 }), h('div', { class: 'bc-podium__name' }, r.name), h('div', { class: 'bc-podium__pts' }, ar(r.total)),
      h('div', { class: 'bc-podium__block', style: { height: `${heights[r.rank] || 50}px`, background: tones[r.rank] || 'var(--bc-olive)' } }, ar(r.rank))))),
    meRow && h('div', { class: 'bc-note' }, `ترتيبك: ${ar(meRow.rank)}${meRow.tied ? ' (تعادل)' : ''} · ${ar(meRow.total)} نقطة`),
    h('div', { class: 'bc-rows' }, rows.map((r) => h('div', { class: `bc-prow${r.id === v.viewerId ? ' is-me' : ''}` },
      h('div', { class: 'bc-prow__rank' }, ar(r.rank)), h('div', { class: 'bc-prow__name' }, r.name, r.tied && Chip('تعادل', 'flame')), h('div', { class: 'bc-prow__pts' }, ar(r.total)),
      h('div', { class: 'bc-prow__sub' }, h('span', null, `الأسئلة ${ar(r.normal)}`), h('span', null, `النهائي ${signed(r.finalDelta)}`), h('span', null, `صح ${ar(r.correct)} · غلط ${ar(r.wrong)}`), r.cardUsed && h('span', null, `×٢ في س${ar(r.cardQuestion)}`))))),
    h('div', { class: 'bc-note' }, 'نقاط المنصة بتتضاف مرة واحدة بعد انتهاء الجولة، ومنفصلة عن نقاط اللعبة دي.'),
    h('div', { class: 'bc-footer' }, v.isAdmin ? Button('جولة جديدة', { size: 'lg', block: true, variant: 'flame', iconName: 'replay', onClick: () => c.act('newRound') }) : h('div', { class: 'bc-note bc-center' }, 'في انتظار الأدمن لبدء جولة جديدة'),
      c.onExit && Button('خروج من اللعبة', { variant: 'ghost', block: true, onClick: () => c.onExit() })));
}

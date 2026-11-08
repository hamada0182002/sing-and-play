// شاشات ٣–٨: شاشة صاحب الدور، شاشة المتابعين، اختيار اللاعب، كتابة السؤال، الإجابة، سجل الأسئلة
import { h, ar, icon, roomLabel } from '../components/dom.js';
import { Button, Avatar, Chip, CategoryChip, Header, ScoreStrip, Ticket, Vinyl, colorIndex, ANSWER_TONE } from '../components/ui.js';

const ANSWERS = [
  { id: 'yes', label: 'أيوه', variant: 'butter' },
  { id: 'no', label: 'لأ', variant: 'brick' },
  { id: 'maybe', label: 'ممكن', variant: 'flame' },
  { id: 'unknown', label: 'مش عارف', variant: 'dark' },
];
const ANSWER_LABEL = Object.fromEntries(ANSWERS.map((a) => [a.id, a.label]));
const SUGGESTIONS = ['هل هو إنسان حقيقي؟', 'هل هو عايش دلوقتي؟', 'هل هو مصري؟', 'هل هو رجل؟', 'هل هو لاعب كرة؟', 'هل بيغني؟', 'هل هو شخصية كرتون؟', 'هل هو مشهور عالميًا؟'];

export function TurnScreen(c) {
  const { view, ui } = c;
  const t = view.turn;
  const me = view.viewerId;
  const players = view.players;
  const isActive = t.playerId === me;
  const active = players.find((p) => p.id === t.playerId);
  const nameOf = (id) => (id === me ? 'أنت' : (players.find((p) => p.id === id) || {}).name || '؟');
  const pending = t.questions.find((q) => q.status === 'pending');
  const attemptsLeft = view.settings.maxGuesses - t.attempts.length;
  const myPending = !isActive && pending && pending.targetId === me ? pending : null;

  // المرحلة: الأسطوانة والوقت جنب بعض (توفير مساحة عشان سجل الأسئلة ياخد الباقي)
  const timeEl = h('div', { class: 'wai-time' },
    h('span', { class: 'wai-time__n', 'data-wai-time': '' }, '٣:٠٠'), h('span', { class: 'wai-time__l' }, 'متبقي'));
  const stage = [
    h('div', { class: 'wai-stage-row' },
      Vinyl({ label: '؟', progress: 1, spin: true, size: 'xs' }),
      h('div', { class: 'wai-stage-info' },
        timeEl,
        isActive && h('p', { class: 'wai-small wai-center', style: { margin: '2px 0 0' } }, 'الشخصية سرّ… اسأل واكتشف!'))),
    !isActive && Ticket(h('div', { class: 'wai-secret' },
      h('div', { class: 'wai-secret__cap' }, `الشخصية — ${active.name} ما يعرفهاش، متقولهاش!`),
      h('div', { class: 'wai-ticket__name' }, t.character.name),
      CategoryChip(t.character.category)), { tone: 'butter', className: '' }),
  ];

  const actions = isActive ? [
    pending && h('div', { class: 'wai-note wai-center' },
      `مستني ${nameOf(pending.targetId)} يجاوب…`,
      h('div', null, h('button', { class: 'wai-link', type: 'button', onClick: () => c.act(c.adapter.cancelQuestion({ questionId: pending.id })) }, 'اسحب السؤال واسأل حد تاني'))),
    Button('اسأل لاعب', { variant: 'butter', size: 'md', block: true, iconName: 'ask', disabled: !!pending, onClick: () => c.setUi({ sheet: 'target' }) }),
    Button(`أنا عرفت! (${ar(attemptsLeft)})`, { variant: 'flame', size: 'md', block: true, iconName: 'guess', ariaLabel: `أنا عرفت! (${ar(attemptsLeft)} محاولات)`, disabled: attemptsLeft <= 0, onClick: () => c.act(c.adapter.requestGuess()) }),
  ] : [
    h('div', { class: 'wai-note wai-center' },
      t.guessing ? `${active.name} بيخمّن دلوقتي…` :
      pending ? (pending.targetId === me ? 'السؤال موجّه لك — جاوب!' : `مستنيين ${nameOf(pending.targetId)} يجاوب`) :
      `${active.name} بيفكّر في سؤاله الجاي. لو سأل حد منكم تقدر تجاوب هنا.`),
  ];

  const logItems = buildLog(t, players, me);
  const log = h('div', { class: 'wai-turn__log' },
    h('div', { class: 'wai-log__title' }, 'سجل الأسئلة', h('span', { class: 'wai-small' }, `${ar(t.questions.filter((q) => q.status === 'answered').length)} إجابات`)),
    h('div', { class: 'wai-log', role: 'log', 'aria-live': 'polite' },
      logItems.length ? logItems : h('div', { class: 'wai-log__empty' }, isActive ? 'لسه ما سألتش حد. اختار لاعب واكتب سؤالك.' : 'مفيش أسئلة لسه.')));

  const screen = h('div', { class: 'wai-screen wai-screen--wide' },
    h('div', { class: 'wai-turn' },
      Header({ left: `الدور ${ar(t.turnNo)} / ${ar(players.length)}`, right: `الغرفة ${roomLabel(view.roomId)}` }),
      h('div', { class: 'wai-turn__who' },
        h('div', { class: 'wai-eyebrow' }, isActive ? 'دورك أنت!' : 'دور المغامر'),
        h('div', { class: 'wai-turn__target-name' }, isActive ? 'خمّن الشخصية' : active.name)),
      h('div', { class: 'wai-turn__stage' }, stage),
      h('div', { class: 'wai-turn__actions' }, actions),
      log,
      ScoreStrip(view, players, { activeId: t.playerId, answeringId: pending && pending.targetId })));

  const layers = [screen];
  if (isActive && ui.sheet === 'target') layers.push(TargetSheet(c));
  if (isActive && ui.sheet === 'compose') layers.push(ComposeSheet(c));
  if (myPending) layers.push(AnswerSheet(c, myPending, nameOf));
  return h('div', { style: { height: '100%', position: 'relative' } }, ...layers);
}

// ───── سجل الأسئلة والإجابات (شاشة ٨) ─────
function buildLog(t, players, me) {
  const nameOf = (id) => (id === me ? 'أنت' : (players.find((p) => p.id === id) || {}).name || '؟');
  const items = [
    ...t.questions.map((q) => ({ at: q.at, q })),
    ...t.attempts.map((a) => ({ at: a.at, a })),
  ].sort((x, y) => x.at - y.at);
  return items.map((it) => {
    if (it.q) {
      const q = it.q;
      return h('div', { class: `wai-qa wai-qa--${q.status}` },
        h('div', { class: 'wai-qa__who' }, `${nameOf(q.askerId)} ← ${nameOf(q.targetId)}`),
        h('div', { class: 'wai-qa__text' }, q.text),
        h('div', { class: 'wai-qa__ans' },
          q.status === 'answered' ? [Chip(ANSWER_LABEL[q.answer], ANSWER_TONE[q.answer]), h('span', { class: 'wai-small' }, `${nameOf(q.targetId)} جاوب`)]
          : q.status === 'pending' ? h('span', { class: 'wai-small', style: { color: 'var(--wai-butter)' } }, `مستني ${nameOf(q.targetId)}…`)
          : h('span', { class: 'wai-small' }, 'السؤال اتسحب')));
    }
    const a = it.a;
    return h('div', { class: 'wai-qa' },
      h('div', { class: 'wai-qa__who' }, `محاولة تخمين ${ar(a.n)}`),
      h('div', { class: 'wai-qa__text' }, a.choice.name),
      h('div', { class: 'wai-qa__ans' }, Chip(a.correct ? 'صح ✓' : 'غلط ✗', a.correct ? 'olive' : 'brick')));
  });
}

// ───── شاشة ٥: اختيار اللاعب ─────
function TargetSheet(c) {
  const { view } = c;
  const others = view.players.filter((p) => p.id !== view.viewerId);
  return Sheet(c, [
    h('div', { class: 'wai-sheet__title' }, 'تسأل مين؟'),
    h('div', { class: 'wai-small' }, 'تقدر تسأل نفس الشخص أكتر من مرة، أو تغيّر اللاعب كل مرة.'),
    h('div', { class: 'wai-targets' },
      others.map((p) => h('button', {
        class: `wai-target${c.ui.targetId === p.id ? ' is-sel' : ''}`, type: 'button',
        onClick: () => c.setUi({ targetId: p.id, sheet: 'compose', focusCompose: true }),
      }, Avatar(p, colorIndex(view.players, p.id), { size: 46 }), h('span', { class: 'wai-target__name' }, p.name)))),
    Button('إلغاء', { variant: 'ghost', size: 'sm', block: true, onClick: () => c.setUi({ sheet: null }) }),
  ]);
}

// ───── شاشة ٦: كتابة وإرسال السؤال ─────
function ComposeSheet(c) {
  const { view, ui } = c;
  const max = view.settings.maxQuestionLength || 140;
  const target = view.players.find((p) => p.id === ui.targetId);
  if (!target) { ui.sheet = 'target'; return TargetSheet(c); }
  const normalize = (v) => v.replace(/\s+/g, ' ').trim();
  let sending = false;
  const counter = h('span', { class: 'wai-count' }, `${ar(ui.draft.length)}/${ar(max)}`);
  const sendBtn = Button('ابعت السؤال', { variant: 'butter', size: 'lg', block: true, iconName: 'send', disabled: normalize(ui.draft).length < 2 });
  const sync = () => {
    const ok = normalize(ta.value).length >= 2;
    sendBtn.disabled = !ok; sendBtn.setAttribute('aria-disabled', String(!ok));
    counter.textContent = `${ar(ta.value.length)}/${ar(max)}`;
    c.ui.draft = ta.value;
  };
  const submit = async () => {
    const text = normalize(ta.value);
    if (sending || text.length < 2) return;
    sending = true; sendBtn.disabled = true; // يمنع الإرسال المزدوج
    const r = await c.act(c.adapter.submitQuestion({ targetId: target.id, text }));
    sending = false;
    if (r.ok) c.setUi({ sheet: null, draft: '' }); else sync();
  };
  const ta = h('textarea', {
    placeholder: `اكتب سؤالك لـ ${target.name}…`, maxlength: max, 'aria-label': 'نص السؤال', rows: 3,
    onInput: sync,
    onKeydown: (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } },
  });
  ta.value = ui.draft;
  sendBtn.addEventListener('click', submit);
  return Sheet(c, [
    h('div', { class: 'wai-row', style: { marginBottom: '10px' } },
      Avatar(target, colorIndex(view.players, target.id), { size: 44 }),
      h('div', null, h('div', { class: 'wai-small' }, 'سؤالك موجّه لـ'), h('div', { class: 'wai-sheet__title', style: { margin: 0 } }, target.name)),
      h('button', { class: 'wai-link', type: 'button', style: { marginInlineStart: 'auto' }, onClick: () => c.setUi({ sheet: 'target' }) }, 'غيّر اللاعب')),
    ta,
    h('div', { class: 'wai-row', style: { marginTop: '4px' } }, h('span', { class: 'wai-small' }, 'اسأل سؤال إجابته أيوه / لأ'), counter),
    h('div', { class: 'wai-suggests' }, SUGGESTIONS.map((s) => h('button', {
      class: 'wai-suggest', type: 'button',
      onClick: () => { ta.value = s; sync(); ta.focus(); },
    }, s))),
    sendBtn,
  ]);
}

// ───── شاشة ٧: واجهة الإجابة ─────
function AnswerSheet(c, q, nameOf) {
  const busy = c.ui.answering === q.id;
  return h('div', { class: 'wai-sheet-wrap', role: 'dialog', 'aria-label': 'جاوب على السؤال' },
    h('div', { class: 'wai-sheet' },
      h('div', { class: 'wai-sheet__grab' }),
      h('div', { class: 'wai-sheet__title' }, 'السؤال موجّه لك!'),
      h('div', { class: 'wai-question-card' },
        h('div', { class: 'wai-qa__who' }, `${nameOf(q.askerId)} بيسألك`),
        h('div', { class: 'wai-qa__text' }, q.text)),
      h('div', { class: 'wai-small', style: { marginTop: '8px' } }, 'إنت بس اللي تقدر تجاوب — والإجابة هتظهر للجميع.'),
      h('div', { class: 'wai-answers' },
        ANSWERS.map((a) => Button(a.label, {
          variant: a.variant, size: 'lg', disabled: busy,
          onClick: async () => { c.ui.answering = q.id; c.render(); const r = await c.act(c.adapter.submitAnswer({ questionId: q.id, answer: a.id })); if (!r.ok) c.setUi({ answering: null }); },
        })).map((b) => { b.classList.add('wai-answer'); return b; }))));
}

function Sheet(c, children) {
  return h('div', {
    class: 'wai-sheet-wrap',
    onClick: (e) => { if (e.target === e.currentTarget) c.setUi({ sheet: null }); },
  }, h('div', { class: 'wai-sheet', role: 'dialog' }, h('div', { class: 'wai-sheet__grab' }), children));
}

// الإسقاط الآمن: «نسخة اللاعب» من الحالة. هو الشيء الوحيد اللي بيوصل للأجهزة.
//  - مفيش مسودات أصلًا على الخادم (المسودة بتفضل في جهاز صاحبها فقط).
//  - إجابات اللاعبين الآخرين ما بتظهرش إلا لو اللاعب نفسه أرسل إجابته (أو السؤال اتقفل).
//  - رهانات السؤال النهائي مخفية عن الباقيين لحد ما مرحلة المراهنة تنتهي.
//  - الأسئلة الجاية (حرف/تصنيف) ما بتتبعتش لأي لاعب؛ الأدمن بس بيشوف «السؤال الجاي» عشان يعدّله.
import { PHASE } from './constants.js';
import { derive } from './grading.js';
import { hostId, currentQuestion, presentPlayers, nextIndex, questionDelta, computeScores, standings, normalCount } from './selectors.js';

const byName = (a, b) => String(a.name).localeCompare(String(b.name), 'ar');

function publicSettings(s) {
  const x = s.settings;
  return {
    questionCount: x.questionCount, questionSeconds: x.questionSeconds, finalSeconds: x.finalSeconds, wagerSeconds: x.wagerSeconds,
    resultsSeconds: x.resultsSeconds, confirmSeconds: x.confirmSeconds, duplicatePolicy: x.duplicatePolicy, autoApprove: x.autoApprove,
    wagerOptions: x.wagerOptions, minPlayers: x.minPlayers, maxPlayers: x.maxPlayers, maxAnswerLength: x.maxAnswerLength,
    letters: x.letters.slice(),
    categories: x.categories.map((c) => ({ id: c.id, name: c.name, enabled: c.enabled, builtin: !!c.builtin })),
  };
}

function nameOf(state, id) { const p = state.players.find((x) => x.id === id); return p ? p.name : 'لاعب'; }

/** صفوف المراجعة/النتائج لسؤال مغلق. */
function rowsFor(state, q) {
  const d = derive(state, q);
  return state.players.map((p) => {
    const a = q.answers[p.id];
    const g = d[p.id];
    return {
      playerId: p.id, name: p.name, left: !!p.left,
      answer: a ? a.text : null, edited: !!(a && a.edited), originalAnswer: a && a.edited ? a.original : null,
      submittedAt: a ? a.at : null,
      points: (q.picks[p.id] && q.picks[p.id].points) || 0, doubled: !!q.doubled[p.id],
      wager: q.kind === 'final' ? (state.wagers[p.id] || 0) : null,
      status: g.status, reason: g.reason, reasonText: g.reasonText, unresolved: g.unresolved, dup: g.dup, suggestion: g.suggestion || null,
      source: g.source, delta: questionDelta(state, q, p.id, d),
    };
  });
}

function reviewFor(state, q) {
  const rows = rowsFor(state, q);
  const unresolved = rows.filter((r) => r.unresolved).length;
  return { questionNo: q.no, kind: q.kind, category: q.category, letter: q.letter, approved: q.approved, rows, unresolvedCount: unresolved, canApprove: state.phase === PHASE.REVIEW && currentQuestion(state) === q && unresolved === 0 };
}

export function projectFor(state, viewerId, now) {
  const admin = hostId(state) === viewerId;
  const me = state.players.find((p) => p.id === viewerId) || null;
  const scores = computeScores(state);
  const N = normalCount(state);
  const q = (state.phase === PHASE.QUESTION || state.phase === PHASE.REVIEW || state.phase === PHASE.RESULTS) ? currentQuestion(state) : null;

  const view = {
    viewerId, isAdmin: admin, serverNow: now, roomId: state.roomId, roundNo: state.roundNo,
    phase: state.phase, phaseEndsAt: state.phaseEndsAt,
    settings: publicSettings(state),
    players: state.players.map((p) => ({ id: p.id, name: p.name, isHost: p.id === hostId(state), left: !!p.left, score: scores[p.id].total })),
    scores: Object.fromEntries(state.players.map((p) => [p.id, scores[p.id].total])),
    existingScores: state.existingScores,
    progress: {
      no: q ? q.no : (state.phase === PHASE.WAGER ? N + 1 : 0),
      total: N + 1, normalTotal: N, final: !!(q && q.kind === 'final') || state.phase === PHASE.WAGER,
    },
    me: null, question: null, wager: null, standings: null,
  };

  if (me) {
    const used = (state.used[me.id] || []).slice().sort((a, b) => a - b);
    const available = state.questions.length ? Array.from({ length: N }, (_, i) => i + 1).filter((n) => !used.includes(n)) : [];
    view.me = {
      id: me.id, name: me.name, isHost: admin, score: scores[me.id].total, used, available,
      card: { state: state.cards[me.id] == null ? 'available' : 'used', questionNo: state.cards[me.id] ?? null },
      wager: state.wagers[me.id] ?? null,
      history: state.questions.filter((x) => x.approved).map((x) => {
        const d = derive(state, x);
        return { no: x.no, kind: x.kind, category: x.category, letter: x.letter, points: (x.picks[me.id] && x.picks[me.id].points) || 0, doubled: !!x.doubled[me.id], status: d[me.id].status, delta: questionDelta(state, x, me.id, d) };
      }),
    };
  }

  // مرحلة المراهنة: حالة التأكيد فقط (من غير قيم الباقيين)
  if (state.phase === PHASE.WAGER) {
    view.wager = {
      endsAt: state.phaseEndsAt,
      options: state.settings.wagerOptions.slice(),
      mine: me ? (state.wagers[me.id] ?? null) : null,
      players: presentPlayers(state).map((p) => ({ id: p.id, name: p.name, confirmed: state.wagers[p.id] !== undefined })),
    };
  }

  if (q) {
    const closed = q.closedAt != null;
    const mineSubmitted = !!(me && q.answers[me.id]);
    const answersVisible = closed || mineSubmitted;
    const answers = answersVisible
      ? state.players.filter((p) => q.answers[p.id]).map((p) => ({ playerId: p.id, name: p.name, text: q.answers[p.id].text, at: q.answers[p.id].at, edited: !!q.answers[p.id].edited })).sort(byName)
      : [];
    const showWagers = q.kind === 'final';   // السؤال النهائي بيبدأ بعد إغلاق المراهنة، فالرهانات بقت معروفة للكل
    view.question = {
      no: q.no, kind: q.kind, categoryId: q.categoryId, category: q.category, letter: q.letter,
      startedAt: q.startedAt, endsAt: q.endsAt, closedAt: q.closedAt, closeReason: q.closeReason, status: closed ? 'closed' : 'open',
      players: state.players.map((p) => ({ id: p.id, name: p.name, left: !!p.left, picked: !!q.picks[p.id], submitted: !!q.answers[p.id] })).sort(byName),
      submittedCount: presentPlayers(state).filter((p) => q.answers[p.id]).length,
      totalPresent: presentPlayers(state).length,
      mine: me ? {
        points: q.picks[me.id] ? q.picks[me.id].points : null, doubled: !!q.doubled[me.id], submitted: mineSubmitted,
        answer: mineSubmitted ? q.answers[me.id].text : null, wager: q.kind === 'final' ? (state.wagers[me.id] ?? 0) : null,
        canDouble: q.kind === 'normal' && !closed && state.cards[me.id] == null && !!q.picks[me.id] && !mineSubmitted,
      } : null,
      answersVisible, answers,
      reveal: closed ? {
        picks: Object.fromEntries(state.players.filter((p) => q.picks[p.id]).map((p) => [p.id, { points: q.picks[p.id].points, doubled: !!q.doubled[p.id] }])),
      } : null,
      wagers: showWagers ? Object.fromEntries(state.players.map((p) => [p.id, state.wagers[p.id] || 0])) : null,
      approved: q.approved,
      results: q.approved ? rowsFor(state, q).map((r) => ({
        playerId: r.playerId, name: r.name, answer: r.answer, status: r.status, reasonText: r.status === 'correct' ? '' : r.reasonText,
        points: r.points, doubled: r.doubled, wager: r.wager, delta: r.delta, total: scores[r.playerId].total, dup: !!r.dup,
      })) : null,
    };
  }

  if (state.phase === PHASE.STANDINGS) {
    const rows = standings(state).map((r) => ({
      rank: r.rank, tied: r.tied, id: r.id, name: r.name, total: r.score, normal: r.normal, finalDelta: r.finalDelta, wager: r.wager, finalStatus: r.finalStatus,
      correct: r.correct, wrong: r.wrong, cardUsed: r.cardQuestion != null, cardQuestion: r.cardQuestion,
    }));
    view.standings = { rows, winners: rows.filter((r) => r.rank === 1).map((r) => r.id), early: !!state.endedEarly, normalTotal: N };
  }

  if (admin) {
    const idx = nextIndex(state);
    const nq = idx != null ? state.questions[idx] : null;
    view.nextQuestion = nq ? { no: nq.no, kind: nq.kind, categoryId: nq.categoryId, category: nq.category, letter: nq.letter } : null;
    const reviews = {};
    for (const x of state.questions) if (x.closedAt != null) reviews[x.no] = reviewFor(state, x);
    view.admin = {
      roster: state.players.map((p) => {
        const cq = q;
        return {
          id: p.id, name: p.name, left: !!p.left, score: scores[p.id].total,
          used: (state.used[p.id] || []).slice().sort((a, b) => a - b),
          cardUsed: state.cards[p.id] != null, cardQuestion: state.cards[p.id] ?? null,
          wager: state.wagers[p.id] ?? null,
          picked: !!(cq && cq.picks[p.id]), submitted: !!(cq && cq.answers[p.id]),
        };
      }),
      reviews,
      currentReviewNo: q && q.closedAt != null ? q.no : null,
      audit: state.audit.slice(-80).reverse().map((a) => ({ ...a, byName: nameOf(state, a.by), playerName: a.playerId ? nameOf(state, a.playerId) : null })),
      learnedCount: Object.values(state.learned || {}).reduce((n, arr) => n + arr.length, 0),
    };
  }
  return view;
}

// دوال قراءة مشتركة بين المحرك والإسقاط (projection) — بدون تعديل أي حالة.
import { PHASE } from './constants.js';
import { derive } from './grading.js';
import { ANSWER_STATUS, pointsForAnswer, rank } from '../scoring/scoring.js';

export function hostId(state) { return (state.players.find((p) => p.isHost) || state.players[0]).id; }
export function isAdmin(state, userId) { return hostId(state) === userId; }
export function presentPlayers(state) { return state.players.filter((p) => !p.left); }
export function currentQuestion(state) { return state.cursor >= 0 ? state.questions[state.cursor] : null; }
export function findQuestion(state, no) { return state.questions.find((q) => q.no === no) || null; }
export function normalCount(state) { return state.settings.questionCount; }
export function finalIndex(state) { return normalCount(state); }

/** فهرس السؤال الجاي (اللي لسه ما بدأش) أو null. */
export function nextIndex(state) {
  if (state.phase === PHASE.CONFIRM) return 0;
  if (state.phase === PHASE.WAGER) return finalIndex(state);
  if (state.phase === PHASE.RESULTS) {
    const q = currentQuestion(state);
    if (!q || q.kind === 'final') return null;
    return state.cursor + 1 <= finalIndex(state) ? state.cursor + 1 : null;
  }
  return null;
}

/** نقاط لاعب في سؤال (حسب الحالة الحالية، سواء اتعتمد ولا لسه). */
export function questionDelta(state, q, pid, derived = derive(state, q)) {
  const d = derived[pid];
  if (!d) return 0;
  return pointsForAnswer({
    kind: q.kind, status: d.status,
    points: (q.picks[pid] && q.picks[pid].points) || 0, doubled: !!q.doubled[pid],
    wager: state.wagers[pid] || 0,
  });
}

/** رصيد وإحصائيات كل لاعب من الأسئلة المعتمدة فقط. */
export function computeScores(state) {
  const out = {};
  for (const p of state.players) out[p.id] = { total: 0, normal: 0, finalDelta: 0, wager: state.wagers[p.id] || 0, finalStatus: null, correct: 0, wrong: 0, cardQuestion: state.cards[p.id] ?? null };
  for (const q of state.questions) {
    if (!q.approved) continue;
    const d = derive(state, q);
    for (const p of state.players) {
      const delta = questionDelta(state, q, p.id, d);
      const row = out[p.id];
      if (q.kind === 'final') { row.finalDelta = delta; row.finalStatus = d[p.id].status; row.total += delta; } else {
        row.normal += delta; row.total += delta;
        if (d[p.id].status === ANSWER_STATUS.CORRECT) row.correct += 1; else row.wrong += 1;
      }
    }
  }
  return out;
}

export function standings(state) {
  const sc = computeScores(state);
  return rank(state.players.map((p) => ({ id: p.id, name: p.name, score: sc[p.id].total, ...sc[p.id] })));
}

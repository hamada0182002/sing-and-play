// التصحيح: التقييم التلقائي لكل إجابة + اشتقاق الحالة النهائية (مع التكرار وتدخل الأدمن).
// «الحالة» دائمًا بتتحسب من المخزّن (التقييم التلقائي + تعديل الأدمن + سياسة التكرار) → أي تعديل = إعادة احتساب صحيحة تلقائيًا.
import { validateAnswer, VERDICT, REASON, REASON_TEXT } from '../validation/validator.js';
import { ANSWER_STATUS } from '../scoring/scoring.js';

export function categoryOf(state, q) {
  const c = state.settings.categories.find((x) => x.id === q.categoryId);
  return { id: q.categoryId, name: q.category, builtin: !!(c && c.builtin) };
}

function learnedSet(state, categoryId) {
  return new Set((state.learned && state.learned[categoryId]) || []);
}

/** تقييم تلقائي لإجابة لاعب واحد وتخزينه في q.grades. (بيحافظ على تعديل الأدمن لو موجود إلا لو reset=true) */
export function autoGradeOne(state, q, pid, { reset = false } = {}) {
  const a = q.answers[pid];
  const prev = q.grades[pid];
  const auto = a
    ? validateAnswer({
      text: a.text, letter: q.letter, category: categoryOf(state, q), learned: learnedSet(state, q.categoryId),
      options: { maxLength: state.settings.maxAnswerLength },
    })
    : { verdict: VERDICT.WRONG, reason: REASON.NO_ANSWER, key: '' };
  q.grades[pid] = { auto, override: reset ? null : (prev ? prev.override : null) };
}

export function autoGradeAll(state, q) {
  for (const p of state.players) autoGradeOne(state, q, p.id);
}

const mapVerdict = (v) => (v === VERDICT.CORRECT ? ANSWER_STATUS.CORRECT : v === VERDICT.WRONG ? ANSWER_STATUS.WRONG : ANSWER_STATUS.REVIEW);

/** مجموعات التكرار: مفتاح الإجابة → [أسماء اللاعبين] (للإجابات اللي مش غلط بشكل مؤكد ولا ألغاها الأدمن). */
export function duplicateGroups(state, q) {
  const groups = new Map();
  for (const p of state.players) {
    const a = q.answers[p.id];
    const g = q.grades[p.id];
    if (!a || !g || !g.auto.key) continue;
    if (g.auto.verdict === VERDICT.WRONG || g.override === 'wrong') continue;
    if (!groups.has(g.auto.key)) groups.set(g.auto.key, []);
    groups.get(g.auto.key).push(p.id);
  }
  for (const [k, ids] of groups) if (ids.length < 2) groups.delete(k);
  return groups;
}

/**
 * الحالة النهائية لكل لاعب في السؤال.
 * @returns {{[pid:string]: {status:string, reason:string, reasonText:string, unresolved:boolean, dup:null|{size:number,with:string[]},
 *            suggestion?:string, source:'auto'|'admin', edited:boolean}}}
 */
export function derive(state, q) {
  const policy = state.settings.duplicatePolicy;
  const groups = duplicateGroups(state, q);
  const groupOf = new Map();
  for (const [k, ids] of groups) for (const id of ids) groupOf.set(id, { key: k, ids });
  const order = new Map(state.players.map((p, i) => [p.id, i]));
  const out = {};
  for (const p of state.players) {
    const a = q.answers[p.id];
    const g = q.grades[p.id];
    if (!a || !g) {
      out[p.id] = { status: ANSWER_STATUS.WRONG, reason: REASON.NO_ANSWER, reasonText: REASON_TEXT.no_answer, unresolved: false, dup: null, source: 'auto', edited: false };
      continue;
    }
    const dupGroup = groupOf.get(p.id);
    const dup = dupGroup ? { size: dupGroup.ids.length, with: dupGroup.ids.filter((x) => x !== p.id) } : null;
    const base = mapVerdict(g.auto.verdict);
    const row = {
      reason: g.auto.reason, reasonText: REASON_TEXT[g.auto.reason] || '', suggestion: g.auto.suggestion,
      dup, source: g.override ? 'admin' : 'auto', edited: !!a.edited,
    };
    if (g.override) {
      out[p.id] = { ...row, status: g.override, unresolved: false };
    } else if (dup) {
      if (policy === 'review') out[p.id] = { ...row, status: ANSWER_STATUS.DUPLICATE, unresolved: true };
      else if (policy === 'void') out[p.id] = { ...row, status: ANSWER_STATUS.DUPLICATE, unresolved: false };
      else if (policy === 'first') {
        const first = dupGroup.ids.slice().sort((x, y) => (q.answers[x].at - q.answers[y].at) || (order.get(x) - order.get(y)))[0];
        out[p.id] = first === p.id
          ? { ...row, status: base, unresolved: base === ANSWER_STATUS.REVIEW }
          : { ...row, status: ANSWER_STATUS.DUPLICATE, unresolved: false };
      } else { // share
        out[p.id] = { ...row, status: base, unresolved: base === ANSWER_STATUS.REVIEW };
      }
    } else {
      out[p.id] = { ...row, status: base, unresolved: base === ANSWER_STATUS.REVIEW };
    }
  }
  return out;
}

export function unresolvedPlayers(state, q) {
  const d = derive(state, q);
  return state.players.filter((p) => d[p.id].unresolved).map((p) => p.id);
}

const LEARNABLE = new Set([REASON.UNKNOWN_WORD, REASON.CUSTOM_CATEGORY, REASON.OTHER_CATEGORY, REASON.NEAR_MATCH]);

/** بعد اعتماد السؤال: أي كلمة كان النظام مش متأكد منها واعتمدها الأدمن (أو النظام بعد المراجعة) كصحيحة تتحفظ للتصحيح التلقائي بعد كده. */
export function learnFrom(state, q) {
  const d = derive(state, q);
  state.learned ||= {};
  const set = new Set(state.learned[q.categoryId] || []);
  for (const p of state.players) {
    const g = q.grades[p.id];
    if (!g || d[p.id].status !== ANSWER_STATUS.CORRECT || !LEARNABLE.has(g.auto.reason) || !g.auto.key) continue;
    set.add(g.auto.key);
  }
  state.learned[q.categoryId] = [...set].slice(-400);
}

// محرك قواعد «أتوبيس كومبليت» — دوال نقية بلا DOM وبلا شبكة. هو «الحَكَم» (authoritative).
// كل أمر: (state, userId, params, ctx{now, rng}) → { state, events }. لو الأمر ما غيّرش حاجة بيرجّع نفس كائن state (بدون أحداث).
// الواجهة بتستقبل فقط ما يرجعه projectFor() (انظر projection.js): مفيش مسودات ولا إجابات غير مرسلة بتوصل لأي لاعب.
import { GameError, need } from './errors.js';
import { seededRng } from './rng.js';
import { defaultSettings, applySettingsPatch, addCategory as addCat, updateCategory as updCat, removeCategory as rmCat, resetCategories as resetCats, enabledCategories } from './settings.js';
import { generateQuestions, rerollLetter } from './questions.js';
import { autoGradeAll, autoGradeOne, derive, unresolvedPlayers, learnFrom } from './grading.js';
import { cleanText } from '../utils/arabic.js';
import { isValidLetter } from '../data/letters.js';

export { GameError, seededRng };
import { PHASE } from './constants.js';
import { hostId, isAdmin, presentPlayers, currentQuestion, findQuestion, normalCount, finalIndex, nextIndex, questionDelta, computeScores, standings } from './selectors.js';

export { projectFor } from './projection.js';
export { PHASE, hostId, isAdmin, presentPlayers, currentQuestion, nextIndex, questionDelta, computeScores, standings };

const AUDIT_LIMIT = 300;
const ev = (state, type, payload = {}) => ({ type, payload: { roomId: state.roomId, roundNo: state.roundNo, ...payload } });

// ───────── إنشاء اللعبة ─────────
export function createGame({ roomId, players, existingScores = {}, settings = {} }) {
  return {
    roomId,
    settings: defaultSettings(settings),
    players: players.map((p) => ({ id: p.id, name: p.name, isHost: !!p.isHost, left: false })),
    existingScores: { ...existingScores },
    phase: PHASE.LOBBY,
    roundNo: 0,
    questions: [],
    cursor: -1,
    phaseEndsAt: null,
    used: {},          // { [pid]: number[] } الأرقام المستخدمة (بتتحرق لحظة التثبيت)
    cards: {},         // { [pid]: questionNo|null } كارت المضاعفة: مين استخدمه وفي أنهي سؤال
    wagers: {},        // { [pid]: 0|10|20 } رهان السؤال النهائي
    learned: {},       // { [categoryId]: string[] } إجابات اعتمدها الأدمن (توسّع التصحيح التلقائي)
    catSeq: 1,
    audit: [],
    endedEarly: false,
    seen: {},          // { [pid]: requestId[] } لمنع تنفيذ نفس الطلب مرتين (يستخدمها الخادم)
  };
}

// ───────── أدوات ─────────
function mustAdmin(state, userId) { need(isAdmin(state, userId), 'NOT_ADMIN'); }
function mustPlayer(state, userId) {
  const p = state.players.find((x) => x.id === userId);
  need(p, 'NOT_IN_ROOM');
  need(!p.left, 'LEFT_ROOM');
  return p;
}
function mustPhase(state, ...phases) { need(phases.includes(state.phase), 'BAD_PHASE'); }
function audit(s, now, by, type, data = {}) {
  s.audit.push({ at: now, by, type, ...data });
  if (s.audit.length > AUDIT_LIMIT) s.audit.splice(0, s.audit.length - AUDIT_LIMIT);
}

// ───────── إعدادات اللوبي (الأدمن) ─────────
export function updateSettings(state, userId, patch) {
  mustAdmin(state, userId); mustPhase(state, PHASE.LOBBY);
  const s = structuredClone(state);
  s.settings = applySettingsPatch(s.settings, patch);
  return { state: s, events: [ev(s, 'settingsUpdated', { patch })] };
}
export function addCategory(state, userId, { name }) {
  mustAdmin(state, userId); mustPhase(state, PHASE.LOBBY);
  const s = structuredClone(state);
  s.settings = addCat(s.settings, s.catSeq, { name });
  s.catSeq += 1;
  return { state: s, events: [ev(s, 'settingsUpdated', { categories: true })] };
}
export function updateCategory(state, userId, params) {
  mustAdmin(state, userId); mustPhase(state, PHASE.LOBBY);
  const s = structuredClone(state);
  s.settings = updCat(s.settings, params);
  return { state: s, events: [ev(s, 'settingsUpdated', { categories: true })] };
}
export function removeCategory(state, userId, params) {
  mustAdmin(state, userId); mustPhase(state, PHASE.LOBBY);
  const s = structuredClone(state);
  s.settings = rmCat(s.settings, params);
  return { state: s, events: [ev(s, 'settingsUpdated', { categories: true })] };
}
export function resetCategories(state, userId) {
  mustAdmin(state, userId); mustPhase(state, PHASE.LOBBY);
  const s = structuredClone(state);
  s.settings = resetCats(s.settings);
  return { state: s, events: [ev(s, 'settingsUpdated', { categories: true })] };
}

// ───────── بدء الجولة ─────────
export function startRound(state, userId, ctx) {
  mustAdmin(state, userId); mustPhase(state, PHASE.LOBBY);
  const n = presentPlayers(state).length;
  need(n >= state.settings.minPlayers, 'TOO_FEW');
  need(n <= state.settings.maxPlayers, 'TOO_MANY');
  need(enabledCategories(state.settings).length >= 1, 'NO_CATEGORIES');
  const s = structuredClone(state);
  s.players = s.players.filter((p) => !p.left);
  s.roundNo += 1;
  s.questions = generateQuestions(s.settings, ctx.rng);
  s.cursor = -1;
  s.used = Object.fromEntries(s.players.map((p) => [p.id, []]));
  s.cards = Object.fromEntries(s.players.map((p) => [p.id, null]));
  s.wagers = {};
  s.endedEarly = false;
  s.phase = PHASE.CONFIRM;
  s.phaseEndsAt = ctx.now + s.settings.confirmSeconds * 1000;
  audit(s, ctx.now, userId, 'startRound', { questions: s.questions.length });
  return { state: s, events: [ev(s, 'gameStarted', { questionCount: s.settings.questionCount, playerIds: s.players.map((p) => p.id), settings: { questionCount: s.settings.questionCount, questionSeconds: s.settings.questionSeconds } })] };
}

// ───────── تقدّم المراحل (داخلي: بيعدّل نسخة s) ─────────
function openQuestion(s, index, now, events) {
  const q = s.questions[index];
  s.cursor = index;
  q.startedAt = now;
  q.endsAt = now + (q.kind === 'final' ? s.settings.finalSeconds : s.settings.questionSeconds) * 1000;
  s.phase = PHASE.QUESTION;
  s.phaseEndsAt = null;
  events.push(ev(s, 'questionStarted', { questionNo: q.no, kind: q.kind, category: q.category, letter: q.letter, endsAt: q.endsAt }));
}

function approveInternal(s, q, now, by, events) {
  autoGradeAllKeep(s, q);
  learnFrom(s, q);
  q.approved = true;
  q.approvedAt = now;
  const d = derive(s, q);
  const deltas = {};
  for (const p of s.players) deltas[p.id] = questionDelta(s, q, p.id, d);
  const totals = computeScores(s);
  events.push(ev(s, 'questionApproved', { questionNo: q.no, kind: q.kind, deltas }));
  for (const p of s.players) {
    if (deltas[p.id] !== 0) events.push(ev(s, 'scoreUpdated', { playerId: p.id, questionNo: q.no, delta: deltas[p.id], total: totals[p.id].total }));
  }
  s.phase = PHASE.RESULTS;
  s.phaseEndsAt = s.settings.resultsSeconds > 0 ? now + s.settings.resultsSeconds * 1000 : null;
  if (by) audit(s, now, by, 'approve', { questionNo: q.no });
}

// التقييم التلقائي بيتعاد قبل الاعتماد عشان «المتعلَّم» الجديد (من أسئلة سابقة) يتطبّق، مع الحفاظ على تعديلات الأدمن
function autoGradeAllKeep(s, q) { for (const p of s.players) if (!(q.grades[p.id] && q.answers[p.id] && q.grades[p.id].override)) autoGradeOne(s, q, p.id); }

function closeInternal(s, now, reason, events) {
  const q = currentQuestion(s);
  q.closedAt = now;
  q.closeReason = reason;
  autoGradeAll(s, q);
  s.phase = PHASE.REVIEW;
  s.phaseEndsAt = null;
  events.push(ev(s, 'questionClosed', { questionNo: q.no, reason }));
  if (s.settings.autoApprove && unresolvedPlayers(s, q).length === 0) approveInternal(s, q, now, null, events);
}

function startWager(s, now) {
  s.phase = PHASE.WAGER;
  s.wagers = {};
  s.phaseEndsAt = now + s.settings.wagerSeconds * 1000;
}

function closeWagerInternal(s, now, events) {
  for (const p of s.players) if (s.wagers[p.id] === undefined) s.wagers[p.id] = 0;
  events.push(ev(s, 'wagerClosed', {}));
  openQuestion(s, finalIndex(s), now, events);
}

function toStandings(s, now, early, events) {
  s.phase = PHASE.STANDINGS;
  s.phaseEndsAt = null;
  s.endedEarly = !!early;
  s.finishedAt = now;
  const ranking = standings(s).map((r) => ({ id: r.id, total: r.score, rank: r.rank }));
  events.push(ev(s, 'roundCompleted', { ranking, early: !!early }));
}

function advanceFromResults(s, now, events) {
  const q = currentQuestion(s);
  if (q.kind === 'final') return toStandings(s, now, false, events);
  if (s.cursor + 1 < normalCount(s)) return openQuestion(s, s.cursor + 1, now, events);
  return startWager(s, now);
}

/** الأدمن يتخطى الانتظار: بدء السؤال / إغلاق السؤال / السؤال التالي / إغلاق المراهنة. */
export function advance(state, userId, ctx) {
  mustAdmin(state, userId);
  const s = structuredClone(state);
  const events = [];
  switch (s.phase) {
    case PHASE.CONFIRM: openQuestion(s, 0, ctx.now, events); break;
    case PHASE.QUESTION: closeInternal(s, ctx.now, 'admin', events); break;
    case PHASE.RESULTS: advanceFromResults(s, ctx.now, events); break;
    case PHASE.WAGER: closeWagerInternal(s, ctx.now, events); break;
    default: throw new GameError('BAD_PHASE');
  }
  audit(s, ctx.now, userId, 'advance', { from: state.phase });
  return { state: s, events };
}

export function closeQuestion(state, userId, ctx) {
  mustAdmin(state, userId); mustPhase(state, PHASE.QUESTION);
  return advance(state, userId, ctx);
}

/** تذكير بالوقت: آمن للتكرار، أي لاعب يقدر يناديه. */
export function tick(state, ctx) {
  const now = ctx.now;
  const events = [];
  let s = null;
  const clone = () => (s ||= structuredClone(state));
  switch (state.phase) {
    case PHASE.CONFIRM:
      if (state.phaseEndsAt != null && now >= state.phaseEndsAt) openQuestion(clone(), 0, now, events);
      break;
    case PHASE.QUESTION: {
      const q = currentQuestion(state);
      const everyone = presentPlayers(state).every((p) => q.answers[p.id]);
      if (now >= q.endsAt) closeInternal(clone(), now, 'timeout', events);
      else if (everyone) closeInternal(clone(), now, 'all_submitted', events);
      break;
    }
    case PHASE.RESULTS:
      if (state.phaseEndsAt != null && now >= state.phaseEndsAt) advanceFromResults(clone(), now, events);
      break;
    case PHASE.WAGER: {
      const everyone = presentPlayers(state).every((p) => state.wagers[p.id] !== undefined);
      if (now >= state.phaseEndsAt || everyone) closeWagerInternal(clone(), now, events);
      break;
    }
    default: break;
  }
  return s ? { state: s, events } : { state, events: [] };
}

// ───────── أوامر اللاعب ─────────
function openQuestionFor(state, now) {
  mustPhase(state, PHASE.QUESTION);
  const q = currentQuestion(state);
  need(now < q.endsAt, 'TIME_UP');
  return q;
}

/** تثبيت قيمة النقاط للسؤال الحالي. الرقم بيتحرق من لوحة اللاعب بس (مش من لوحات الباقيين). */
export function lockPoints(state, userId, { points }, ctx) {
  mustPlayer(state, userId);
  const q = openQuestionFor(state, ctx.now);
  need(q.kind === 'normal', 'BAD_PHASE');
  const p = Number(points);
  need(Number.isInteger(p) && p >= 1 && p <= normalCount(state), 'BAD_POINTS');
  const existing = q.picks[userId];
  if (existing) {
    if (existing.points === p) return { state, events: [] };   // نفس الطلب اتكرر (ضغطتين/إعادة إرسال): مفيش تغيير
    throw new GameError('POINTS_LOCKED');
  }
  need(!(state.used[userId] || []).includes(p), 'NUMBER_USED');
  const s = structuredClone(state);
  s.questions[s.cursor].picks[userId] = { points: p, at: ctx.now };
  (s.used[userId] ||= []).push(p);
  return { state: s, events: [ev(s, 'pointsLocked', { playerId: userId, questionNo: q.no })] };
}

/** تفعيل كارت DOUBLE POINTS ×2 على السؤال الحالي فقط. مرة واحدة في الجولة ومينفعش التراجع. */
export function activateDouble(state, userId, ctx) {
  mustPlayer(state, userId);
  const q = openQuestionFor(state, ctx.now);
  need(q.kind === 'normal', 'NO_CARD_IN_FINAL');
  if (state.cards[userId] === q.no) return { state, events: [] };   // نفس الطلب اتكرر
  need(state.cards[userId] == null, 'CARD_USED');
  need(q.picks[userId], 'POINTS_FIRST');
  need(!q.answers[userId], 'ALREADY_SUBMITTED');
  const s = structuredClone(state);
  s.cards[userId] = q.no;
  s.questions[s.cursor].doubled[userId] = true;
  return { state: s, events: [ev(s, 'cardUsed', { playerId: userId, questionNo: q.no })] };
}

/** إرسال الإجابة الوحيدة (والنقاط وكارت ×٢ معاها في خطوة واحدة: اختار الرقم واكتب واضغط أرسل).
 *  بعد الإرسال بتتثبّت وتظهر لباقي اللاعبين اللي أرسلوا، ومينفعش تتعدّل.
 *  السؤال العادي: points إجباري (لو لسه مثبّتش رقم بـlockPoints)، و double اختياري. السؤال النهائي: بدون نقاط ولا كارت.
 *  كل التحققات قبل أي تعديل: لو حاجة غلط ما بيتغيّرش أي شيء (الرقم ما بيتحرقش والكارت ما بيتستهلكش). */
export function submitAnswer(state, userId, { text, points, double } = {}, ctx) {
  mustPlayer(state, userId);
  const q = openQuestionFor(state, ctx.now);
  need(!q.answers[userId], 'ALREADY_SUBMITTED');
  const clean = cleanText(typeof text === 'string' ? text : '');
  need(clean.length > 0, 'EMPTY_ANSWER');
  need(clean.length <= Math.max(state.settings.maxAnswerLength * 2, 60), 'ANSWER_TOO_LONG');
  const events = [];
  let pick = q.picks[userId] || null;
  let newPoints = null;
  let useCard = false;
  if (q.kind === 'normal') {
    if (pick) {
      if (points != null) need(Number(points) === pick.points, 'POINTS_LOCKED');
    } else {
      need(points != null, 'POINTS_FIRST');
      const p = Number(points);
      need(Number.isInteger(p) && p >= 1 && p <= normalCount(state), 'BAD_POINTS');
      need(!(state.used[userId] || []).includes(p), 'NUMBER_USED');
      newPoints = p;
    }
    if (double) {
      if (state.cards[userId] !== q.no) { need(state.cards[userId] == null, 'CARD_USED'); useCard = true; }
    }
  }
  const s = structuredClone(state);
  const sq = s.questions[s.cursor];
  if (newPoints != null) {
    sq.picks[userId] = { points: newPoints, at: ctx.now };
    (s.used[userId] ||= []).push(newPoints);
    events.push(ev(s, 'pointsLocked', { playerId: userId, questionNo: q.no }));
  }
  if (useCard) {
    s.cards[userId] = q.no;
    sq.doubled[userId] = true;
    events.push(ev(s, 'cardUsed', { playerId: userId, questionNo: q.no }));
  }
  sq.answers[userId] = { text: clean, at: ctx.now };
  events.push(ev(s, 'answerSubmitted', { playerId: userId, questionNo: q.no }));
  if (presentPlayers(s).every((p) => sq.answers[p.id])) closeInternal(s, ctx.now, 'all_submitted', events);
  return { state: s, events };
}

/** رهان السؤال النهائي (0/10/20). مخفي عن الباقيين لحد ما مرحلة المراهنة تنتهي. */
export function lockWager(state, userId, { amount }, ctx) {
  mustPlayer(state, userId); mustPhase(state, PHASE.WAGER);
  need(ctx.now < state.phaseEndsAt, 'TIME_UP');
  const a = Number(amount);
  need(state.settings.wagerOptions.includes(a), 'BAD_WAGER');
  if (state.wagers[userId] !== undefined) {
    if (state.wagers[userId] === a) return { state, events: [] };
    throw new GameError('WAGER_LOCKED');
  }
  const s = structuredClone(state);
  s.wagers[userId] = a;
  const events = [ev(s, 'wagerLocked', { playerId: userId })];
  if (presentPlayers(s).every((p) => s.wagers[p.id] !== undefined)) closeWagerInternal(s, ctx.now, events);
  return { state: s, events };
}

// ───────── أوامر الأدمن: التصحيح ─────────
function gradableQuestion(state, questionNo) {
  need(state.phase !== PHASE.STANDINGS && state.phase !== PHASE.LOBBY, 'BAD_PHASE');
  const q = questionNo ? findQuestion(state, questionNo) : currentQuestion(state);
  need(q, 'NO_SUCH_QUESTION');
  need(q.closedAt != null, 'BAD_PHASE');
  return q;
}

/** تغيير حالة إجابة: correct | wrong | auto (يرجّعها للتقييم التلقائي). */
export function gradeAnswer(state, userId, { questionNo, playerId, status }, ctx) {
  mustAdmin(state, userId);
  const q0 = gradableQuestion(state, questionNo);
  need(['correct', 'wrong', 'auto'].includes(status), 'BAD_SETTINGS');
  need(q0.answers[playerId], 'NO_SUCH_ANSWER');
  const before = derive(state, q0)[playerId].status;
  const s = structuredClone(state);
  const q = findQuestion(s, q0.no);
  q.grades[playerId].override = status === 'auto' ? null : status;
  const after = derive(s, q)[playerId].status;
  audit(s, ctx.now, userId, 'grade', { questionNo: q.no, playerId, before, after });
  return { state: s, events: [ev(s, 'answerGraded', { questionNo: q.no, playerId, status: after })] };
}

/** اعتماد/رفض كل الإجابات المعلّقة (مراجعة/مكرر) دفعة واحدة. */
export function bulkGrade(state, userId, { questionNo, status }, ctx) {
  mustAdmin(state, userId);
  const q0 = gradableQuestion(state, questionNo);
  need(['correct', 'wrong'].includes(status), 'BAD_SETTINGS');
  const pending = unresolvedPlayers(state, q0);
  if (!pending.length) return { state, events: [] };
  const s = structuredClone(state);
  const q = findQuestion(s, q0.no);
  for (const pid of pending) q.grades[pid].override = status;
  audit(s, ctx.now, userId, 'bulkGrade', { questionNo: q.no, status, count: pending.length });
  return { state: s, events: [ev(s, 'answerGraded', { questionNo: q.no, bulk: true, status })] };
}

/** اعتماد التصحيح والنتائج: بيتطلب إن كل الإجابات المعلّقة اتحسمت. */
export function approveQuestion(state, userId, ctx) {
  mustAdmin(state, userId); mustPhase(state, PHASE.REVIEW);
  const q0 = currentQuestion(state);
  need(unresolvedPlayers(state, q0).length === 0, 'UNRESOLVED');
  const s = structuredClone(state);
  const events = [];
  approveInternal(s, currentQuestion(s), ctx.now, userId, events);
  return { state: s, events };
}

/** تعديل السؤال الجاي (حرف/تصنيف/إعادة سحب) قبل ما يبدأ — مرئي للأدمن فقط. */
export function adjustNext(state, userId, { categoryId, letter, reroll }, ctx) {
  mustAdmin(state, userId);
  const idx = nextIndex(state);
  need(idx !== null && idx !== undefined, 'NO_NEXT');
  const s = structuredClone(state);
  const q = s.questions[idx];
  if (categoryId !== undefined) {
    const cat = s.settings.categories.find((c) => c.id === categoryId);
    need(cat, 'BAD_CATEGORY');
    q.categoryId = cat.id; q.category = cat.name;
  }
  if (letter !== undefined) { need(isValidLetter(letter), 'BAD_LETTER'); q.letter = letter; }
  if (reroll) q.letter = rerollLetter(s.settings, s.questions, idx, ctx.rng);
  if (s.phase === PHASE.RESULTS && s.settings.resultsSeconds > 0) s.phaseEndsAt = ctx.now + s.settings.resultsSeconds * 1000;
  audit(s, ctx.now, userId, 'adjustNext', { questionNo: q.no, categoryId: q.categoryId, letter: q.letter });
  return { state: s, events: [] };
}

// ───────── إنهاء/إعادة ─────────
/** إنهاء الجولة فورًا (الأدمن): الترتيب بيتحسب من الأسئلة المعتمدة فقط. */
export function endRound(state, userId, ctx) {
  mustAdmin(state, userId);
  need(state.phase !== PHASE.LOBBY && state.phase !== PHASE.STANDINGS, 'BAD_PHASE');
  const s = structuredClone(state);
  const events = [];
  audit(s, ctx.now, userId, 'endRound', { at: state.phase });
  toStandings(s, ctx.now, true, events);
  return { state: s, events };
}

/** جولة جديدة: إعادة ضبط الأرقام والكارت ونقاط الجولة. (الإعدادات واللاعبين ونقاط المنصة العامة بتفضل.) */
export function newRound(state, userId, ctx) {
  mustAdmin(state, userId);
  need(state.phase === PHASE.STANDINGS || state.phase === PHASE.LOBBY, 'BAD_PHASE');
  if (state.phase === PHASE.LOBBY) return { state, events: [] };
  const s = structuredClone(state);
  s.players = s.players.filter((p) => !p.left);
  s.phase = PHASE.LOBBY;
  s.questions = []; s.cursor = -1; s.phaseEndsAt = null;
  s.used = {}; s.cards = {}; s.wagers = {};
  s.endedEarly = false; delete s.finishedAt;
  audit(s, ctx.now, userId, 'newRound', {});
  return { state: s, events: [] };
}

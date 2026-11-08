// محرك قواعد «أنا مين؟» — دوال نقية بلا DOM وبلا شبكة.
// هذا هو "الحَكَم" (authoritative). في الدمج الحقيقي ينتقل نفس المنطق إلى الخادم (Supabase RPC / Edge Function)
// وتبقى الواجهة تستقبل فقط ما تُرجعه projectFor().
import { CHARACTERS, CHARACTER_BY_ID } from '../data/characters.js';

export const PHASE = { LOBBY: 'lobby', TURN: 'turn', REVEAL: 'reveal', TRANSITION: 'transition', FINAL: 'final' };

export const ANSWERS = [
  { id: 'yes', label: 'أيوه' },
  { id: 'no', label: 'لأ' },
  { id: 'maybe', label: 'ممكن' },
  { id: 'unknown', label: 'مش عارف' },
];

export const DEFAULT_SETTINGS = {
  turnSeconds: 180,
  finalGuessSeconds: 10, // لما وقت الدور يخلص: صاحب الدور يختار تخمينه في الوقت ده بدل ما النقط تروح
  maxGuesses: 3,
  points: [100, 70, 40],
  revealSeconds: 7,
  transitionSeconds: 3,
  minPlayers: 3,
  maxPlayers: 10,
  maxQuestionLength: 140,
};

export class GameError extends Error {
  constructor(code, message) { super(message || code); this.code = code; }
}

// ───────── أدوات ─────────
export function pickOne(list, rng) { return list[Math.floor(rng() * list.length)]; }

export function shuffle(list, rng) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** مولّد عشوائي قابل للتثبيت في الاختبارات. */
export function seededRng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function need(cond, code, msg) { if (!cond) throw new GameError(code, msg); }
const ev = (state, type, payload = {}) => ({
  type,
  payload: { roomId: state.roomId, roundNo: state.roundNo, ...payload },
});

// ───────── إنشاء اللعبة ─────────
export function createGame({ roomId, players, existingScores = {}, gameSettings = {} }) {
  const settings = { ...DEFAULT_SETTINGS, ...gameSettings };
  return {
    version: 0,
    seq: 0,
    roomId,
    settings,
    players: players.map((p) => ({ id: p.id, name: p.name, isHost: !!p.isHost })),
    existingScores: { ...existingScores },
    phase: PHASE.LOBBY,
    roundNo: 0,
    remaining: [],
    usedCharacterIds: [],
    turnNo: 0,
    turn: null,
    secret: null, // { characterId } ← لا يُرسل أبدًا لصاحب الدور
    nextPlayerId: null,
    phaseEndsAt: null,
    scores: Object.fromEntries(players.map((p) => [p.id, 0])),
    results: [],
  };
}

export function hostId(state) {
  return (state.players.find((p) => p.isHost) || state.players[0]).id;
}

function assertPlayer(state, id) {
  need(state.players.some((p) => p.id === id), 'NOT_IN_ROOM', 'اللاعب غير موجود في الغرفة');
}

// ───────── أدوار اللعبة ─────────
function beginTurn(state, rng, now, events) {
  const playerId = state.nextPlayerId || pickOne(state.remaining, rng);
  state.remaining = state.remaining.filter((id) => id !== playerId);
  state.nextPlayerId = null;

  let pool = CHARACTERS.filter((c) => !state.usedCharacterIds.includes(c.id));
  if (!pool.length) { state.usedCharacterIds = []; pool = CHARACTERS.slice(); }
  const character = pickOne(pool, rng);
  state.usedCharacterIds.push(character.id);

  state.turnNo += 1;
  state.phase = PHASE.TURN;
  state.phaseEndsAt = null;
  state.secret = { characterId: character.id };
  state.turn = {
    turnNo: state.turnNo,
    playerId,
    startedAt: now,
    endsAt: now + state.settings.turnSeconds * 1000,
    status: 'active',
    questions: [],
    attempts: [],
    guessOptions: null,
    finalGuess: false,
    skipFinal: false,
    outcome: null,
    points: 0,
    scored: false,
    revealed: null,
  };
  events.push(ev(state, 'turnStarted', {
    turnNo: state.turnNo, playerId, endsAt: state.turn.endsAt, totalTurns: state.players.length,
  }));
}

export function startRound(state, actorId, { rng = Math.random, now = Date.now() } = {}) {
  const s = structuredClone(state);
  const events = [];
  need(s.phase === PHASE.LOBBY || s.phase === PHASE.FINAL, 'BAD_PHASE', 'الجولة شغالة بالفعل');
  need(actorId === hostId(s), 'NOT_HOST', 'مضيف الغرفة فقط يبدأ الجولة');
  const n = s.players.length;
  need(n >= s.settings.minPlayers, 'TOO_FEW', `محتاجين ${s.settings.minPlayers} لاعبين على الأقل`);
  need(n <= s.settings.maxPlayers, 'TOO_MANY', `الحد الأقصى ${s.settings.maxPlayers} لاعبين`);

  s.roundNo += 1;
  s.turnNo = 0;
  s.results = [];
  s.scores = Object.fromEntries(s.players.map((p) => [p.id, 0]));
  s.remaining = s.players.map((p) => p.id);
  s.nextPlayerId = null;
  events.push(ev(s, 'gameStarted', { playerIds: s.remaining.slice(), turnSeconds: s.settings.turnSeconds }));
  beginTurn(s, rng, now, events);
  s.version += 1;
  return { state: s, events };
}

function activeTurn(s, now) {
  need(s.phase === PHASE.TURN && s.turn && s.turn.status === 'active', 'NO_ACTIVE_TURN', 'مفيش دور شغال');
  need(now < s.turn.endsAt, 'TIME_UP', 'الوقت خلص');
  return s.turn;
}

export function submitQuestion(state, actorId, { targetId, text }, { now = Date.now() } = {}) {
  const s = structuredClone(state);
  const t = activeTurn(s, now);
  need(actorId === t.playerId, 'NOT_YOUR_TURN', 'مش دورك');
  need(!t.finalGuess, 'FINAL_GUESS', 'الوقت خلص — اختار تخمينك');
  assertPlayer(s, targetId);
  need(targetId !== actorId, 'SELF_TARGET', 'اختار لاعب غيرك');
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  need(clean.length >= 2, 'EMPTY_QUESTION', 'اكتب سؤالك الأول');
  need(clean.length <= s.settings.maxQuestionLength, 'LONG_QUESTION', 'السؤال طويل');
  need(!t.questions.some((q) => q.status === 'pending'), 'PENDING_QUESTION', 'في سؤال لسه مستني إجابة');

  const q = { id: `q${++s.seq}`, askerId: actorId, targetId, text: clean, status: 'pending', answer: null, at: now };
  t.questions.push(q);
  s.version += 1;
  return { state: s, events: [ev(s, 'questionSubmitted', { turnNo: t.turnNo, questionId: q.id, askerId: actorId, targetId, text: clean })] };
}

export function cancelQuestion(state, actorId, { questionId }, { now = Date.now() } = {}) {
  const s = structuredClone(state);
  const t = activeTurn(s, now);
  need(actorId === t.playerId, 'NOT_YOUR_TURN', 'مش دورك');
  const q = t.questions.find((x) => x.id === questionId);
  need(q && q.status === 'pending', 'NOT_PENDING', 'السؤال اتجاوب أو اتسحب');
  q.status = 'cancelled';
  s.version += 1;
  return { state: s, events: [] };
}

export function submitAnswer(state, actorId, { questionId, answer }, { now = Date.now() } = {}) {
  const s = structuredClone(state);
  const t = activeTurn(s, now);
  const q = t.questions.find((x) => x.id === questionId);
  need(q, 'NO_QUESTION', 'السؤال مش موجود');
  need(q.targetId === actorId, 'NOT_TARGET', 'السؤال مش موجّه لك');
  need(q.status === 'pending' && q.answer === null, 'ALREADY_ANSWERED', 'السؤال ده اتجاوب قبل كده');
  need(ANSWERS.some((a) => a.id === answer), 'BAD_ANSWER', 'إجابة غير صالحة');
  q.answer = answer;
  q.status = 'answered';
  q.answeredAt = now;
  s.version += 1;
  return { state: s, events: [ev(s, 'answerSubmitted', { turnNo: t.turnNo, questionId: q.id, targetId: actorId, answer })] };
}

// 4 اختيارات: الصحيحة + 3 من نفس التصنيف وبصعوبة متقاربة، بترتيب عشوائي.
export function buildGuessOptions(correctId, excludeIds, rng) {
  const correct = CHARACTER_BY_ID[correctId];
  const candidates = CHARACTERS.filter((c) => c.id !== correctId && !excludeIds.includes(c.id));
  const score = (c) => (c.category === correct.category ? 0 : 10) + Math.abs(c.difficulty - correct.difficulty) * 2 + rng();
  const picked = shuffle(candidates, rng).sort((a, b) => score(a) - score(b)).slice(0, 3);
  return shuffle([correct, ...picked], rng).map((c) => c.id);
}

export function requestGuess(state, actorId, { rng = Math.random, now = Date.now() } = {}) {
  const s = structuredClone(state);
  const t = activeTurn(s, now);
  need(actorId === t.playerId, 'NOT_YOUR_TURN', 'مش دورك');
  need(t.attempts.length < s.settings.maxGuesses, 'NO_ATTEMPTS', 'خلصت محاولاتك');
  if (!t.guessOptions) {
    const wrong = t.attempts.map((a) => a.choiceId);
    t.guessOptions = buildGuessOptions(s.secret.characterId, wrong, rng);
    s.version += 1;
  }
  return { state: s, events: [] };
}

export function cancelGuess(state, actorId, { now = Date.now() } = {}) {
  const s = structuredClone(state);
  const t = activeTurn(s, now);
  need(actorId === t.playerId, 'NOT_YOUR_TURN', 'مش دورك');
  need(!t.finalGuess, 'FINAL_GUESS', 'الوقت خلص — لازم تختار');
  t.guessOptions = null;
  s.version += 1;
  return { state: s, events: [] };
}

function finishTurn(s, outcome, now, events) {
  const t = s.turn;
  if (!t || t.status !== 'active') return; // يمنع إنهاء/احتساب مرتين
  t.status = 'done';
  t.outcome = outcome;
  t.guessOptions = null;
  t.revealed = s.secret.characterId;
  if (!t.scored) {
    t.scored = true;
    if (outcome === 'correct') t.points = s.settings.points[t.attempts.length - 1] || 0;
    if (t.points > 0) s.scores[t.playerId] += t.points;
    events.push(ev(s, 'scoreUpdated', {
      turnNo: t.turnNo, playerId: t.playerId, delta: t.points, roundTotal: s.scores[t.playerId],
      existingTotal: (s.existingScores[t.playerId] || 0) + s.scores[t.playerId],
    }));
  }
  s.results.push({
    turnNo: t.turnNo, playerId: t.playerId, characterId: t.revealed, outcome,
    points: t.points, attempts: t.attempts.length, questions: t.questions.filter((q) => q.status === 'answered').length,
  });
  s.phase = PHASE.REVEAL;
  s.phaseEndsAt = now + s.settings.revealSeconds * 1000;
  events.push(ev(s, 'turnCompleted', {
    turnNo: t.turnNo, playerId: t.playerId, characterId: t.revealed, outcome, points: t.points, attempts: t.attempts.length,
  }));
}

export function submitGuess(state, actorId, { choiceId }, { now = Date.now() } = {}) {
  const s = structuredClone(state);
  const t = activeTurn(s, now);
  const events = [];
  need(actorId === t.playerId, 'NOT_YOUR_TURN', 'مش دورك');
  need(t.guessOptions && t.guessOptions.includes(choiceId), 'BAD_CHOICE', 'اختيار غير صالح');
  need(t.attempts.length < s.settings.maxGuesses, 'NO_ATTEMPTS', 'خلصت محاولاتك');

  const correct = choiceId === s.secret.characterId;
  const attempt = { n: t.attempts.length + 1, choiceId, correct, at: now };
  t.attempts.push(attempt);
  t.guessOptions = null;
  events.push(ev(s, 'guessSubmitted', { turnNo: t.turnNo, playerId: actorId, attempt: attempt.n, choiceId, correct }));
  if (correct) finishTurn(s, 'correct', now, events);
  else if (t.attempts.length >= s.settings.maxGuesses) finishTurn(s, 'exhausted', now, events);
  else if (t.finalGuess) {
    // الوقت خلص قبل كده: نفس المهلة (ما بتتجدّدش)، واختيارات جديدة من غير اللي غلط
    t.guessOptions = buildGuessOptions(s.secret.characterId, t.attempts.map((a) => a.choiceId), Math.random);
  }
  s.version += 1;
  return { state: s, events };
}

/** يُستدعى دوريًا (من أي عميل أو من خادم). آمن للتكرار: لا يفعل شيئًا إن لم يحن الوقت. */
export function tick(state, { rng = Math.random, now = Date.now() } = {}) {
  const s = structuredClone(state);
  const events = [];
  let changed = false;
  if (s.phase === PHASE.TURN && s.turn.status === 'active' && now >= s.turn.endsAt) {
    const t = s.turn;
    const canFinalGuess = !t.finalGuess && !t.skipFinal && t.attempts.length < s.settings.maxGuesses;
    if (canFinalGuess) {
      // الوقت خلص: بدل ما الدور يروح، نطلّع اختيارات التخمين ونديله مهلة قصيرة يختار فيها
      t.finalGuess = true;
      t.endsAt = now + (s.settings.finalGuessSeconds || 10) * 1000;
      if (!t.guessOptions) t.guessOptions = buildGuessOptions(s.secret.characterId, t.attempts.map((a) => a.choiceId), rng);
    } else {
      finishTurn(s, 'timeout', now, events);
    }
    changed = true;
  }
  if (s.phase === PHASE.REVEAL && now >= s.phaseEndsAt) {
    if (s.remaining.length === 0) {
      s.phase = PHASE.FINAL; s.phaseEndsAt = null;
      events.push(ev(s, 'roundCompleted', { ranking: ranking(s), results: s.results }));
    } else {
      s.nextPlayerId = pickOne(s.remaining, rng);
      s.phase = PHASE.TRANSITION;
      s.phaseEndsAt = now + s.settings.transitionSeconds * 1000;
    }
    changed = true;
  }
  if (s.phase === PHASE.TRANSITION && now >= s.phaseEndsAt) {
    beginTurn(s, rng, now, events); changed = true;
  }
  if (changed) s.version += 1;
  return { state: changed ? s : state, events };
}

/** المضيف يتخطى انتظار الكشف/الانتقال. */
export function advance(state, actorId, { rng = Math.random, now = Date.now() } = {}) {
  need(actorId === hostId(state), 'NOT_HOST', 'المضيف فقط');
  need(state.phase === PHASE.REVEAL || state.phase === PHASE.TRANSITION, 'BAD_PHASE', 'مفيش حاجة تتخطاها');
  const s = structuredClone(state);
  s.phaseEndsAt = now;
  return tick(s, { rng, now });
}

export function ranking(state) {
  const rows = state.players
    .map((p) => ({ playerId: p.id, name: p.name, score: state.scores[p.id] || 0 }))
    .sort((a, b) => b.score - a.score);
  let rank = 0; let prev = null;
  rows.forEach((r, i) => { if (r.score !== prev) { rank = i + 1; prev = r.score; } r.rank = rank; });
  return rows;
}

// ───────── العرض الآمن لكل لاعب ─────────
// أهم دالة أمنية: صاحب الدور لا يستلم الشخصية السرية أبدًا (لا في JSON ولا في أي حقل).
export function projectFor(state, viewerId, now = Date.now()) {
  const v = structuredClone(state);
  delete v.secret;
  delete v.usedCharacterIds;
  delete v.seq;
  if (v.turn) delete v.turn.skipFinal;
  v.serverNow = now;
  v.viewerId = viewerId;
  const t = v.turn;
  if (t) {
    const isActivePlayer = t.playerId === viewerId;
    if (t.status === 'active') {
      delete t.revealed;
      if (!isActivePlayer) {
        const ch = CHARACTER_BY_ID[state.secret.characterId];
        t.character = { id: ch.id, name: ch.name, category: ch.category };
      }
      if (isActivePlayer) {
        t.guessOptions = t.guessOptions ? t.guessOptions.map(describe) : null;
      } else {
        t.guessing = !!t.guessOptions; // الآخرون يعرفون فقط أنه يخمّن
        t.guessOptions = null;
      }
    } else {
      t.character = describe(t.revealed);
      t.guessOptions = null;
    }
    t.attempts = t.attempts.map((a) => ({ ...a, choice: describe(a.choiceId) }));
    // السؤال المعلّق يظهر للجميع، لكن الإجابة تظهر للجميع بعد الرد (حسب قواعد اللعبة).
  }
  if (v.results) v.results = v.results.map((r) => ({ ...r, character: describe(r.characterId) }));
  return v;
}

function describe(id) {
  const c = CHARACTER_BY_ID[id];
  return c ? { id: c.id, name: c.name, category: c.category } : null;
}

// @ts-nocheck
// ⚠️ ملف مولَّد تلقائياً — لا تعدّله يدوياً. المصدر: supabase/functions/who-am-i/*  والبناء: node scripts/build-edge-function.mjs
import { createClient } from 'npm:@supabase/supabase-js@2';

// ───── game/data/categories.js ─────
const m_categories = (() => {
// أسماء التصنيفات فقط (آمنة للعميل — لا تحتوي أسماء شخصيات).
const CATEGORIES = {
  football: 'كرة القدم',
  music: 'غناء وموسيقى',
  screen: 'تمثيل وسينما',
  cartoon: 'كرتون وأنمي',
  history: 'تاريخ ومشاهير العالم',
  fiction: 'شخصيات خيالية',
};

return { CATEGORIES };
})();

// ───── game/data/characters.js ─────
const m_characters = (() => {
// قاعدة الشخصيات (بيانات تجريبية).
// ⚠️ في الدمج الحقيقي: هذا الملف يبقى على الخادم فقط (جدول/Edge Function) ولا يُرسل للعميل.
// difficulty: 1 سهل · 2 متوسط · 3 صعب
const { CATEGORIES } = m_categories;


const c = (id, name, category, difficulty) => ({ id, name, category, difficulty });

const CHARACTERS = [
  c('f1', 'محمد صلاح', 'football', 1), c('f2', 'ليونيل ميسي', 'football', 1),
  c('f3', 'كريستيانو رونالدو', 'football', 1), c('f4', 'محمد أبو تريكة', 'football', 2),
  c('f5', 'نيمار', 'football', 1), c('f6', 'زين الدين زيدان', 'football', 2),
  c('f7', 'مارادونا', 'football', 2), c('f8', 'بيليه', 'football', 2),
  c('f9', 'كيليان مبابي', 'football', 1), c('f10', 'أحمد حسن (كوكا)', 'football', 3),

  c('m1', 'عمرو دياب', 'music', 1), c('m2', 'أم كلثوم', 'music', 1),
  c('m3', 'عبد الحليم حافظ', 'music', 2), c('m4', 'فيروز', 'music', 2),
  c('m5', 'محمد منير', 'music', 2), c('m6', 'شيرين عبد الوهاب', 'music', 1),
  c('m7', 'تامر حسني', 'music', 1), c('m8', 'محمد عبده', 'music', 2),
  c('m9', 'كاظم الساهر', 'music', 2), c('m10', 'مايكل جاكسون', 'music', 1),

  c('s1', 'عادل إمام', 'screen', 1), c('s2', 'أحمد زكي', 'screen', 2),
  c('s3', 'محمد هنيدي', 'screen', 1), c('s4', 'فاتن حمامة', 'screen', 2),
  c('s5', 'أحمد حلمي', 'screen', 1), c('s6', 'نور الشريف', 'screen', 3),
  c('s7', 'ياسمين عبد العزيز', 'screen', 1), c('s8', 'يحيى الفخراني', 'screen', 3),
  c('s9', 'توم هانكس', 'screen', 2), c('s10', 'شارلي شابلن', 'screen', 2),

  c('c1', 'سبونج بوب', 'cartoon', 1), c('c2', 'توم', 'cartoon', 1),
  c('c3', 'جيري', 'cartoon', 1), c('c4', 'بطوط', 'cartoon', 1),
  c('c5', 'ميكي ماوس', 'cartoon', 1), c('c6', 'ناروتو', 'cartoon', 2),
  c('c7', 'سالي', 'cartoon', 2), c('c8', 'عدنان ولينا', 'cartoon', 3),
  c('c9', 'بوكيمون: بيكاتشو', 'cartoon', 1), c('c10', 'شنكول', 'cartoon', 3),

  c('h1', 'نابليون بونابرت', 'history', 2), c('h2', 'كليوباترا', 'history', 1),
  c('h3', 'أينشتاين', 'history', 1), c('h4', 'صلاح الدين الأيوبي', 'history', 2),
  c('h5', 'توت عنخ آمون', 'history', 1), c('h6', 'نيلسون مانديلا', 'history', 2),
  c('h7', 'ليوناردو دا فينشي', 'history', 2), c('h8', 'جمال عبد الناصر', 'history', 2),
  c('h9', 'مصطفى كامل', 'history', 3), c('h10', 'نيوتن', 'history', 2),

  c('x1', 'سوبرمان', 'fiction', 1), c('x2', 'باتمان', 'fiction', 1),
  c('x3', 'سبايدرمان', 'fiction', 1), c('x4', 'هاري بوتر', 'fiction', 1),
  c('x5', 'شرلوك هولمز', 'fiction', 2), c('x6', 'علاء الدين', 'fiction', 2),
  c('x7', 'السندباد', 'fiction', 2), c('x8', 'الكونت دي مونت كريستو', 'fiction', 3),
  c('x9', 'جاك سبارو', 'fiction', 2), c('x10', 'شهريار', 'fiction', 3),
];

const CHARACTER_BY_ID = Object.fromEntries(CHARACTERS.map((x) => [x.id, x]));

return { CATEGORIES, CHARACTERS, CHARACTER_BY_ID };
})();

// ───── game/logic/engine.js ─────
const m_engine = (() => {
// محرك قواعد «أنا مين؟» — دوال نقية بلا DOM وبلا شبكة.
// هذا هو "الحَكَم" (authoritative). في الدمج الحقيقي ينتقل نفس المنطق إلى الخادم (Supabase RPC / Edge Function)
// وتبقى الواجهة تستقبل فقط ما تُرجعه projectFor().
const { CHARACTERS, CHARACTER_BY_ID } = m_characters;

const PHASE = { LOBBY: 'lobby', TURN: 'turn', REVEAL: 'reveal', TRANSITION: 'transition', FINAL: 'final' };

const ANSWERS = [
  { id: 'yes', label: 'أيوه' },
  { id: 'no', label: 'لأ' },
  { id: 'maybe', label: 'ممكن' },
  { id: 'unknown', label: 'مش عارف' },
];

const DEFAULT_SETTINGS = {
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

class GameError extends Error {
  constructor(code, message) { super(message || code); this.code = code; }
}

// ───────── أدوات ─────────
function pickOne(list, rng) { return list[Math.floor(rng() * list.length)]; }

function shuffle(list, rng) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** مولّد عشوائي قابل للتثبيت في الاختبارات. */
function seededRng(seed = 1) {
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
function createGame({ roomId, players, existingScores = {}, gameSettings = {} }) {
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

function hostId(state) {
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

function startRound(state, actorId, { rng = Math.random, now = Date.now() } = {}) {
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

function submitQuestion(state, actorId, { targetId, text }, { now = Date.now() } = {}) {
  const s = structuredClone(state);
  const t = activeTurn(s, now);
  need(actorId === t.playerId, 'NOT_YOUR_TURN', 'مش دورك');
  need(!t.finalGuess, 'FINAL_GUESS', 'الوقت خلص — اختار تخمينك');
  need(!t.guessOptions, 'GUESSING', 'إنت في وضع التخمين — اختار شخصية'); // مفيش رجوع للأسئلة بعد «أنا عرفت!»
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

function cancelQuestion(state, actorId, { questionId }, { now = Date.now() } = {}) {
  const s = structuredClone(state);
  const t = activeTurn(s, now);
  need(actorId === t.playerId, 'NOT_YOUR_TURN', 'مش دورك');
  const q = t.questions.find((x) => x.id === questionId);
  need(q && q.status === 'pending', 'NOT_PENDING', 'السؤال اتجاوب أو اتسحب');
  q.status = 'cancelled';
  s.version += 1;
  return { state: s, events: [] };
}

function submitAnswer(state, actorId, { questionId, answer }, { now = Date.now() } = {}) {
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
function buildGuessOptions(correctId, excludeIds, rng) {
  const correct = CHARACTER_BY_ID[correctId];
  const candidates = CHARACTERS.filter((c) => c.id !== correctId && !excludeIds.includes(c.id));
  const score = (c) => (c.category === correct.category ? 0 : 10) + Math.abs(c.difficulty - correct.difficulty) * 2 + rng();
  const picked = shuffle(candidates, rng).sort((a, b) => score(a) - score(b)).slice(0, 3);
  return shuffle([correct, ...picked], rng).map((c) => c.id);
}

function requestGuess(state, actorId, { rng = Math.random, now = Date.now() } = {}) {
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

function cancelGuess(state, actorId, { now = Date.now() } = {}) {
  const t = activeTurn(state, now);
  need(actorId === t.playerId, 'NOT_YOUR_TURN', 'مش دورك');
  // مفيش رجوع: أول ما تدوس «أنا عرفت!» لازم تختار (ممنوع تشوف الاختيارات وترجع تسأل)
  throw new GameError('NO_RETURN', 'مفيش رجوع — لازم تختار');
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

function submitGuess(state, actorId, { choiceId }, { now = Date.now() } = {}) {
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
function tick(state, { rng = Math.random, now = Date.now() } = {}) {
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
function advance(state, actorId, { rng = Math.random, now = Date.now() } = {}) {
  need(actorId === hostId(state), 'NOT_HOST', 'المضيف فقط');
  need(state.phase === PHASE.REVEAL || state.phase === PHASE.TRANSITION, 'BAD_PHASE', 'مفيش حاجة تتخطاها');
  const s = structuredClone(state);
  s.phaseEndsAt = now;
  return tick(s, { rng, now });
}

function ranking(state) {
  const rows = state.players
    .map((p) => ({ playerId: p.id, name: p.name, score: state.scores[p.id] || 0 }))
    .sort((a, b) => b.score - a.score);
  let rank = 0; let prev = null;
  rows.forEach((r, i) => { if (r.score !== prev) { rank = i + 1; prev = r.score; } r.rank = rank; });
  return rows;
}

// ───────── العرض الآمن لكل لاعب ─────────
// أهم دالة أمنية: صاحب الدور لا يستلم الشخصية السرية أبدًا (لا في JSON ولا في أي حقل).
function projectFor(state, viewerId, now = Date.now()) {
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

return { PHASE, ANSWERS, DEFAULT_SETTINGS, GameError, pickOne, shuffle, seededRng, createGame, hostId, startRound, submitQuestion, cancelQuestion, submitAnswer, buildGuessOptions, requestGuess, cancelGuess, submitGuess, tick, advance, ranking, projectFor };
})();

// ───── supabase-db.js ─────
const m_supabaseDb = (() => {
// طبقة الاتصال بقاعدة البيانات (Supabase بمفتاح الخدمة). هي الوحيدة اللي بتعرف أسماء الجداول.
function makeSupabaseDb(sb) {
  const must = ({ data, error }) => { if (error) throw error; return data; };
  const stamp = () => new Date().toISOString();
  return {
    async getRoom(roomId) {
      return must(await sb.from('rooms').select('id, code, admin_id, status, active_game, selected_game').eq('id', roomId).maybeSingle());
    },
    async getRoomPlayers(roomId) {
      const rows = must(await sb.from('room_players').select('user_id, joined_at, profiles(display_name)').eq('room_id', roomId).order('joined_at'));
      return rows.map((r) => {
        const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
        return { user_id: r.user_id, joined_at: r.joined_at, name: (p && p.display_name) || 'لاعب' };
      });
    },
    async getTotals(userIds) {
      if (!userIds.length) return {};
      const rows = must(await sb.from('profiles').select('id, total_points').in('id', userIds));
      return Object.fromEntries(rows.map((r) => [r.id, r.total_points || 0]));
    },
    async getState(roomId) {
      const r = must(await sb.from('who_am_i_games').select('state, version').eq('room_id', roomId).maybeSingle());
      return r ? { state: r.state, version: r.version } : null;
    },
    async upsertNewState(roomId, state) {
      must(await sb.from('who_am_i_games').upsert({ room_id: roomId, state, version: 0, updated_at: stamp() }, { onConflict: 'room_id' }));
      must(await sb.from('who_am_i_signal').upsert({ room_id: roomId, version: 0, updated_at: stamp() }, { onConflict: 'room_id' }));
    },
    async deleteState(roomId) {
      must(await sb.from('who_am_i_games').delete().eq('room_id', roomId));
      must(await sb.from('who_am_i_signal').delete().eq('room_id', roomId));
    },
    // كتابة بشرط النسخة (compare-and-swap): بترجّع رقم النسخة الجديدة، أو null لو حد كتب قبلنا
    async saveState(roomId, expectedVersion, state) {
      const rows = must(await sb.from('who_am_i_games')
        .update({ state, version: expectedVersion + 1, updated_at: stamp() })
        .eq('room_id', roomId).eq('version', expectedVersion).select('version'));
      return rows && rows.length ? rows[0].version : null;
    },
    async setSignal(roomId, version) {
      must(await sb.from('who_am_i_signal').upsert({ room_id: roomId, version, updated_at: stamp() }, { onConflict: 'room_id' }));
    },
    async activate(roomId, userId) {
      const { error } = await sb.rpc('wai_activate', { p_room: roomId, p_user: userId });
      if (error) throw new Error(error.message);
    },
    async award(gameId, key, roomId, userId, points) {
      must(await sb.rpc('award_game_points', { p_game: gameId, p_key: key, p_room: roomId, p_user: userId, p_points: points }));
    },
  };
}

return { makeSupabaseDb };
})();

// ───── handler.js ─────
const m_handler = (() => {
// منطق Edge Function لعبة «أنا مين؟» — كل القرارات هنا على الخادم.
// ما فيهوش أي اعتماد على Deno أو Supabase: التعامل مع القاعدة بيتم عن طريق الكائن `db` (انظر supabase-db.js).
// المحرك (engine) هو نفسه الأصلي بدون تعديل.
const E = m_engine;

const GAME_ID = 'who_am_i';

const MESSAGES = {
  NOT_AUTH: 'لازم تسجّل دخول الأول',
  NOT_IN_ROOM: 'انت مش موجود في الغرفة دي',
  NO_GAME: 'اللعبة مش شغالة في الغرفة دي',
  BAD_ACTION: 'طلب غير معروف',
  BAD_REQUEST: 'طلب غير صحيح',
  BUSY: 'السيرفر مشغول، جرّب تاني',
  INTERNAL: 'حصلت مشكلة غير متوقعة',
  // من دالة wai_activate في قاعدة البيانات
  not_admin: 'الأدمن فقط يقدر يعمل ده',
  bad_phase: 'مش وقت ده دلوقتي',
  wrong_game: 'لعبة أنا مين مش هي المختارة',
  too_few: 'لازم 3 لاعبين على الأقل',
  too_many: 'الحد الأقصى 10 لاعبين',
  room_not_found: 'الغرفة مش موجودة',
  unknown_game: 'اللعبة دي مش متاحة',
};
const DB_CODES = ['not_admin', 'bad_phase', 'wrong_game', 'too_few', 'too_many', 'room_not_found', 'unknown_game'];

class HandlerError extends Error {
  constructor(code, message) { super(message || MESSAGES[code] || code); this.code = code; }
}
const he = (code, message) => new HandlerError(code, message);

function codeFromMessage(msg) {
  const m = String(msg || '').toLowerCase();
  return DB_CODES.find((k) => m.includes(k)) || null;
}

// الأوامر المسموحة (المعاملات بتتنقّى واحد واحد، فمفيش حاجة غريبة من العميل بتدخل المحرك)
const COMMANDS = {
  startRound: (s, u, p, c) => E.startRound(s, u, c),
  submitQuestion: (s, u, p, c) => E.submitQuestion(s, u, { targetId: p.targetId, text: p.text }, c),
  cancelQuestion: (s, u, p, c) => E.cancelQuestion(s, u, { questionId: p.questionId }, c),
  submitAnswer: (s, u, p, c) => E.submitAnswer(s, u, { questionId: p.questionId, answer: p.answer }, c),
  requestGuess: (s, u, p, c) => E.requestGuess(s, u, c),
  cancelGuess: (s, u, p, c) => E.cancelGuess(s, u, c),
  submitGuess: (s, u, p, c) => E.submitGuess(s, u, { choiceId: p.choiceId }, c),
  advance: (s, u, p, c) => E.advance(s, u, c),
  tick: (s, u, p, c) => E.tick(s, c),
};

/** العرض الآمن للاعب: المحرك بيشيل الشخصية السرية، ونحن بنشيل الحقول الداخلية كمان. */
function projectView(state, userId, now) {
  const v = E.projectFor(state, userId, now);
  delete v.pendingAwards;
  delete v.sessionId;
  return v;
}

/**
 * مزامنة قايمة اللاعبين مع الغرفة الحقيقية (بدون ما نلمس المحرك):
 *  - المضيف = أدمن الغرفة الحالي (لو الأدمن اتغيّر).
 *  - في اللوبي وشاشة النتيجة بس: اللي خرج من الغرفة بيتشال من القايمة.
 *  - لو صاحب الدور الحالي خرج من الغرفة: دوره بيخلص فوراً (بدل ما الباقيين يستنوا 3 دقايق).
 */
function syncRoster(state, members, adminId, now) {
  const ids = new Set(members.map((m) => m.user_id));
  let players = state.players;
  if (state.phase === E.PHASE.LOBBY || state.phase === E.PHASE.FINAL) players = players.filter((p) => ids.has(p.id));
  players = players.map((p) => ({ ...p, isHost: p.id === adminId }));
  let s = state;
  if (JSON.stringify(players) !== JSON.stringify(state.players)) {
    s = structuredClone(state);
    s.players = players;
  }
  const t = s.turn;
  if (s.phase === E.PHASE.TURN && t && t.status === 'active' && !ids.has(t.playerId)) {
    // صاحب الدور خرج/اتطرد: الدور بيخلص فوراً من غير مهلة تخمين (مفيش حد يختار)
    if (t.endsAt > now || !t.skipFinal) {
      if (s === state) s = structuredClone(state);
      s.turn.endsAt = Math.min(s.turn.endsAt, now);
      s.turn.skipFinal = true;
    }
  }
  // سؤال معلّق موجّه للاعب خرج/اتطرد: بيتسحب تلقائياً عشان صاحب الدور ما يفضلش مستني
  const t2 = s.turn;
  if (s.phase === E.PHASE.TURN && t2 && t2.status === 'active') {
    const stuck = t2.questions.filter((q) => q.status === 'pending' && !ids.has(q.targetId));
    if (stuck.length) {
      if (s === state) s = structuredClone(state);
      s.turn.questions.forEach((q) => { if (q.status === 'pending' && !ids.has(q.targetId)) q.status = 'cancelled'; });
    }
  }
  return s;
}

function createHandler({ db, now = () => Date.now(), rng = Math.random, newId = () => globalThis.crypto.randomUUID() }) {
  async function load(userId, roomId) {
    const room = await db.getRoom(roomId);
    if (!room || room.active_game !== GAME_ID || room.status !== 'playing') throw he('NO_GAME');
    const members = await db.getRoomPlayers(roomId);
    if (!members.some((m) => m.user_id === userId)) throw he('NOT_IN_ROOM');
    const row = await db.getState(roomId);
    if (!row) throw he('NO_GAME');
    return { room, members, row };
  }

  // ───── بدء اللعبة من شاشة اختيار الألعاب (الأدمن فقط) ─────
  async function start(userId, roomId) {
    const room = await db.getRoom(roomId);
    if (!room) throw he('room_not_found');
    if (room.admin_id !== userId) throw he('not_admin');
    if (room.status !== 'waiting') throw he('bad_phase');
    if (room.selected_game !== GAME_ID) throw he('wrong_game');
    const members = await db.getRoomPlayers(roomId);
    const totals = await db.getTotals(members.map((m) => m.user_id));
    const state = E.createGame({
      roomId: room.code || roomId,   // كود الغرفة القصير (بيظهر في ترويسة اللعبة)
      players: members.map((m) => ({ id: m.user_id, name: m.name, isHost: m.user_id === room.admin_id })),
      existingScores: totals,
    });
    state.sessionId = newId();   // يميّز كل مرة تتلعب فيها اللعبة في نفس الغرفة (لمفاتيح النقاط)
    state.pendingAwards = [];
    await db.upsertNewState(roomId, state);
    try {
      await db.activate(roomId, userId); // بتتأكد من كل الشروط وتقلب الغرفة لـ playing في خطوة واحدة
    } catch (err) {
      const after = await db.getRoom(roomId).catch(() => null);
      if (!(after && after.active_game === GAME_ID)) await db.deleteState(roomId).catch(() => undefined);
      const code = codeFromMessage(err && err.message);
      throw code ? he(code) : err;
    }
    return { ok: true };
  }

  // ───── بيانات الغرفة للواجهة (adapter.init) ─────
  async function init(userId, roomId) {
    const { room, members, row } = await load(userId, roomId);
    const s = syncRoster(row.state, members, room.admin_id, now());
    const me = s.players.find((p) => p.id === userId);
    return {
      ok: true,
      data: {
        roomId,
        players: s.players.map((p) => ({ id: p.id, name: p.name, isHost: p.isHost })),
        currentUserId: userId,
        playerName: me ? me.name : '',
        existingScores: s.existingScores,
        gameSettings: s.settings,
      },
    };
  }

  // ───── العرض الحالي للاعب ─────
  async function view(userId, roomId) {
    const { room, members, row } = await load(userId, roomId);
    const t = now();
    return { ok: true, view: projectView(syncRoster(row.state, members, room.admin_id, t), userId, t) };
  }

  // ───── النقاط: بتتسجّل جوه الحالة نفسها (نفس الكتابة)، وبعدين بتتبعت للسجل العام. السجل بيمنع التكرار ─────
  function queueAwards(next, events) {
    const adds = events
      .filter((e) => e.type === 'scoreUpdated' && e.payload.delta > 0)
      .map((e) => ({ key: `${next.sessionId}:${e.payload.roundNo}:${e.payload.turnNo}`, playerId: e.payload.playerId, points: e.payload.delta }));
    if (adds.length) next.pendingAwards = [...(next.pendingAwards || []), ...adds];
  }

  async function flushAwards(roomId, state, version) {
    const pending = state.pendingAwards || [];
    if (!pending.length) return;
    const done = new Set();
    for (const a of pending) {
      try { await db.award(GAME_ID, a.key, roomId, a.playerId, a.points); done.add(`${a.key}|${a.playerId}`); }
      catch (err) { console.error('award failed (هيتعاد تاني مع أول أمر جاي):', err && err.message); }
    }
    if (!done.size) return;
    const remaining = pending.filter((a) => !done.has(`${a.key}|${a.playerId}`));
    try { await db.saveState(roomId, version, { ...state, pendingAwards: remaining }); } catch { /* مش مشكلة: السجل بيمنع التكرار */ }
  }

  // ───── أي أمر لعب ─────
  async function command(userId, roomId, action, params) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const { room, members, row } = await load(userId, roomId);
      const t = now();
      const synced = syncRoster(row.state, members, room.admin_id, t);
      const result = COMMANDS[action](synced, userId, params || {}, { rng, now: t });
      const next = result.state;
      if (next === row.state) {          // مفيش تغيير فعلي (مثلاً tick في وقت بدري)
        await flushAwards(roomId, row.state, row.version);
        return { ok: true, view: projectView(row.state, userId, t) };
      }
      queueAwards(next, result.events || []);
      const version = await db.saveState(roomId, row.version, next);
      if (version === null) continue;    // لاعب تاني كتب قبلنا: نقرا الحالة الجديدة ونعيد
      await db.setSignal(roomId, version);
      await flushAwards(roomId, next, version);
      return { ok: true, view: projectView(next, userId, t) };
    }
    throw he('BUSY');
  }

  async function handle({ userId, body }) {
    try {
      if (!userId) throw he('NOT_AUTH');
      if (!body || typeof body !== 'object' || typeof body.roomId !== 'string' || !body.roomId) throw he('BAD_REQUEST');
      const { action, roomId } = body;
      if (action === 'start') return await start(userId, roomId);
      if (action === 'init') return await init(userId, roomId);
      if (action === 'view') return await view(userId, roomId);
      if (Object.prototype.hasOwnProperty.call(COMMANDS, action)) return await command(userId, roomId, action, body);
      throw he('BAD_ACTION');
    } catch (err) {
      if (err instanceof HandlerError || err instanceof E.GameError) return { ok: false, error: { code: err.code, message: err.message } };
      console.error('[who-am-i] internal error', err);
      return { ok: false, error: { code: 'INTERNAL', message: MESSAGES.INTERNAL } };
    }
  }

  return { handle };
}

return { GAME_ID, createHandler };
})();

const { createHandler } = m_handler;
const { makeSupabaseDb } = m_supabaseDb;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const sb = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});
const api = createHandler({ db: makeSupabaseDb(sb) });
const reply = (obj) => new Response(JSON.stringify(obj), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    // هوية اللاعب بتتاخد من التوكن (JWT) وبتتأكد منها السيرفر، مش من أي حاجة مكتوبة في الطلب
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data, error } = await sb.auth.getUser(token);
    const userId = !error && data && data.user ? data.user.id : null;
    let body = null;
    try { body = await req.json(); } catch { body = null; }
    return reply(await api.handle({ userId, body }));
  } catch (err) {
    console.error('[who-am-i] fatal', err);
    return reply({ ok: false, error: { code: 'INTERNAL', message: 'حصلت مشكلة غير متوقعة' } });
  }
});

// منطق Edge Function لعبة «أنا مين؟» — كل القرارات هنا على الخادم.
// ما فيهوش أي اعتماد على Deno أو Supabase: التعامل مع القاعدة بيتم عن طريق الكائن `db` (انظر supabase-db.js).
// المحرك (engine) هو نفسه الأصلي بدون تعديل.
import * as E from './game/logic/engine.js';

export const GAME_ID = 'who_am_i';

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

export function createHandler({ db, now = () => Date.now(), rng = Math.random, newId = () => globalThis.crypto.randomUUID() }) {
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

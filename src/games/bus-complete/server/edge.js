// واجهة الـEdge Function: بتاخد { userId (من الـJWT)، body } وترجّع { ok, view | data | error }.
// الإجراءات: init · start · exit + كل أوامر اللعبة (انظر COMMANDS في handler.js).
import { handle as handleGame } from './handler.js';
import { GameError, MESSAGES } from '../game-engine/errors.js';

const ACTIVATION_ERRORS = {
  not_admin: 'NOT_ADMIN', bad_phase: 'BAD_PHASE', too_few: 'TOO_FEW', too_many: 'TOO_MANY', wrong_game: 'BAD_PHASE', unknown_game: 'BAD_PHASE', room_not_found: 'NOT_IN_ROOM',
};
const fail = (code, message) => ({ ok: false, error: { code, message: message || MESSAGES[code] || code } });
function fromDbError(err) {
  const msg = String((err && err.message) || '');
  for (const [k, code] of Object.entries(ACTIVATION_ERRORS)) if (msg.includes(k)) return fail(code);
  return null;
}

export function createEdgeApi({ db, now = () => Date.now() }) {
  async function member(userId, roomId) {
    const room = await db.getRoom(roomId);
    if (!room || !room.members.some((m) => m.id === userId)) throw new GameError('NOT_IN_ROOM');
    return room;
  }

  async function init(userId, roomId) {
    const room = await member(userId, roomId);
    const me = room.members.find((m) => m.id === userId);
    return { ok: true, data: {
      roomId, players: room.members.map((m) => ({ id: m.id, name: m.name, isHost: m.id === room.adminId })),
      currentUserId: userId, playerName: me ? me.name : '', existingScores: room.existingScores || {}, gameSettings: {},
    } };
  }

  /** الأدمن يبدأ اللعبة من غرفة SING & PLAY: التحقق (أدمن/حالة/عدد لاعبين) داخل دالة قاعدة البيانات، وبعدها بنجهّز الحالة. */
  async function start(userId, roomId) {
    await member(userId, roomId);
    try { await db.activate(roomId, userId); } catch (err) { const m = fromDbError(err); if (m) return m; throw err; }
    return handleGame(db, { roomId, userId, action: 'view', now: now() });
  }

  async function exit(userId, roomId) {
    await member(userId, roomId);
    try { await db.returnToRoom(roomId, userId); } catch (err) { const m = fromDbError(err); if (m) return m; throw err; }
    return { ok: true };
  }

  async function handle({ userId, body }) {
    try {
      if (!userId) return fail('NOT_IN_ROOM', 'سجّل دخولك الأول');
      if (!body || typeof body !== 'object' || typeof body.roomId !== 'string' || !body.roomId) return fail('BAD_PHASE', 'طلب غير صحيح');
      const { action, roomId, requestId } = body;
      const params = body.params && typeof body.params === 'object' ? body.params : {};
      if (action === 'init') return await init(userId, roomId);
      if (action === 'start') return await start(userId, roomId);
      if (action === 'exit') return await exit(userId, roomId);
      return await handleGame(db, { roomId, userId, action: String(action), params, requestId: typeof requestId === 'string' ? requestId.slice(0, 80) : undefined, now: now() });
    } catch (err) {
      if (err instanceof GameError) return fail(err.code, err.message);
      console.error('[bus-complete] internal error', err);
      return fail('INTERNAL', 'حصلت مشكلة غير متوقعة، جرّب تاني');
    }
  }
  return { handle };
}

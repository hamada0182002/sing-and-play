// معالج الخادم: الطبقة الوحيدة اللي بتربط المحرك بقاعدة البيانات. نفس الكود بيشتغل في:
//   • Edge Function (Supabase) عبر supabase-db.js
//   • LocalAdapter (تجربة بدون خادم) عبر memory-db.js / localstorage-db.js
//   • الاختبارات
// واجهة الـdb (أي تنفيذ لازم يوفّرها):
//   db.getRoom(roomId)            → { adminId, members:[{id,name}], existingScores?:{id:number} } | null
//   db.loadGame(roomId)           → { state, version } | null
//   db.saveGame(roomId, state, expectedVersion|null) → { ok:boolean, version:number }   (CAS: يفشل لو النسخة اتغيّرت)
//   db.award(playerId, key, points, meta) → Promise<void>   (منح نقاط المنصة؛ key فريد يمنع التكرار)
import * as E from '../game-engine/engine.js';
import { GameError } from '../game-engine/errors.js';

export const COMMANDS = {
  updateSettings: (s, u, p) => E.updateSettings(s, u, p),
  addCategory: (s, u, p) => E.addCategory(s, u, p),
  updateCategory: (s, u, p) => E.updateCategory(s, u, p),
  removeCategory: (s, u, p) => E.removeCategory(s, u, p),
  resetCategories: (s, u) => E.resetCategories(s, u),
  startRound: (s, u, p, c) => E.startRound(s, u, c),
  advance: (s, u, p, c) => E.advance(s, u, c),
  closeQuestion: (s, u, p, c) => E.closeQuestion(s, u, c),
  lockPoints: (s, u, p, c) => E.lockPoints(s, u, p, c),
  activateDouble: (s, u, p, c) => E.activateDouble(s, u, c),
  submitAnswer: (s, u, p, c) => E.submitAnswer(s, u, p, c),
  lockWager: (s, u, p, c) => E.lockWager(s, u, p, c),
  gradeAnswer: (s, u, p, c) => E.gradeAnswer(s, u, p, c),
  bulkGrade: (s, u, p, c) => E.bulkGrade(s, u, p, c),
  approveQuestion: (s, u, p, c) => E.approveQuestion(s, u, c),
  adjustNext: (s, u, p, c) => E.adjustNext(s, u, p, c),
  endRound: (s, u, p, c) => E.endRound(s, u, c),
  newRound: (s, u, p, c) => E.newRound(s, u, c),
  tick: (s) => ({ state: s, events: [] }),   // الـtick بيتنفّذ دايمًا قبل أي أمر
  view: (s) => ({ state: s, events: [] }),
};

const MAX_RETRIES = 12;
const SEEN_LIMIT = 24;

/** يزامن قايمة اللاعبين مع أعضاء الغرفة (اللوبي/الترتيب: إضافة وحذف؛ أثناء اللعب: علامة «خرج» فقط ورجوعه بيفك العلامة). */
export function syncRoster(state, room) {
  const members = room.members;
  const ids = new Set(members.map((m) => m.id));
  const s = structuredClone(state);
  let changed = false;
  const open = s.phase === 'lobby' || s.phase === 'standings';
  for (const p of s.players) {
    const isHost = p.id === room.adminId;
    if (p.isHost !== isHost) { p.isHost = isHost; changed = true; }
    const gone = !ids.has(p.id);
    if (open) continue;
    if (p.left !== gone) { p.left = gone; changed = true; }
  }
  if (open) {
    const before = s.players.length;
    s.players = s.players.filter((p) => ids.has(p.id));
    for (const m of members) {
      if (!s.players.some((p) => p.id === m.id)) s.players.push({ id: m.id, name: m.name, isHost: m.id === room.adminId, left: false });
    }
    if (s.players.length !== before || s.players.some((p) => { const m = members.find((x) => x.id === p.id); return m && m.name !== p.name; })) {
      for (const p of s.players) { const m = members.find((x) => x.id === p.id); if (m) p.name = m.name; }
      changed = true;
    }
    s.players.sort((a, b) => members.findIndex((m) => m.id === a.id) - members.findIndex((m) => m.id === b.id));
  }
  if (!s.players.some((p) => p.isHost) && s.players.length) { s.players[0].isHost = true; changed = true; }
  if (room.existingScores) s.existingScores = { ...room.existingScores };
  return changed ? s : state;
}

function fail(error) { return { ok: false, error: { code: error.code || 'INTERNAL', message: error.message } }; }

/**
 * @param db
 * @param {{roomId:string, userId:string, action:string, params?:object, requestId?:string, now?:number, rng?:()=>number}} req
 */
export async function handle(db, req) {
  const { roomId, userId, action, params = {}, requestId } = req;
  const now = req.now ?? Date.now();
  const rng = req.rng ?? Math.random;
  const ctx = { now, rng };
  if (!roomId || !userId) return fail(new GameError('NOT_IN_ROOM'));
  if (!COMMANDS[action]) return fail(new GameError('BAD_PHASE', `أمر غير معروف: ${action}`));
  const room = await db.getRoom(roomId);
  if (!room || !room.members.some((m) => m.id === userId)) return fail(new GameError('NOT_IN_ROOM'));
  if (room.activeGame !== undefined && room.activeGame !== 'bus_complete') return fail(new GameError('BAD_PHASE', 'اللعبة دي مش شغّالة في الغرفة'));

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const row = await db.loadGame(roomId);
    let state = row ? row.state : E.createGame({ roomId, players: room.members.map((m) => ({ id: m.id, name: m.name, isHost: m.id === room.adminId })), existingScores: room.existingScores });
    let version = row ? row.version : null;
    const events = [];
    let dirty = !row;
    let commandError = null;

    // 1) مزامنة الأعضاء  2) تحديث الوقت (tick)  3) الأمر نفسه
    const synced = syncRoster(state, room);
    if (synced !== state) { state = synced; dirty = true; }
    const t = E.tick(state, ctx);
    if (t.state !== state) { state = t.state; dirty = true; events.push(...t.events); }
    const awarded = await ensureAwards(db, state);        // منح نقاط المنصة (متكرّر بأمان لو فشل قبل كده)
    if (awarded !== state) { state = awarded; dirty = true; }

    const seenList = (state.seen && state.seen[userId]) || [];
    const isDuplicateRequest = !!requestId && seenList.includes(requestId);
    if (action !== 'view' && action !== 'tick' && !isDuplicateRequest) {
      try {
        const r = COMMANDS[action](state, userId, params, ctx);
        if (r.state !== state) {
          state = r.state; dirty = true; events.push(...r.events);
          if (requestId) { state = structuredClone(state); state.seen ||= {}; state.seen[userId] = [...seenList, requestId].slice(-SEEN_LIMIT); }
        }
        // لو الأمر نجح بس ما غيّرش حاجة (طلب مكرر)، ده مش خطأ
      } catch (e) {
        if (e instanceof GameError) commandError = e; else throw e;
      }
      // لو الأمر ما اتنفذش بسبب خطأ لازم نحفظ اللي حصل قبله (tick/sync) لكن نرجّع الخطأ
    }

    if (dirty) {
      const saved = await db.saveGame(roomId, state, version);
      if (!saved.ok) continue;            // حد سبقنا → نعيد المحاولة على النسخة الجديدة
      version = saved.version;
    }
    const view = { ...E.projectFor(state, userId, now), version: version ?? 0 };
    if (commandError) return { ...fail(commandError), view };
    return { ok: true, view, events: events.filter((e) => e.type !== 'pointsLocked') };
  }
  return fail(new GameError('BAD_PHASE', 'الغرفة مشغولة، جرّب تاني'));
}

/** منح نقاط المنصة مرة واحدة لكل جولة (key فريد في قاعدة البيانات) — الموجب فقط، ولا يحدث عند الإنهاء المبكر.
 *  لو المنح فشل (شبكة/قاعدة) الحالة ما بتتعلّمش «تم»، فيتعاد مع أول طلب جاي من غير ما يتكرر المنح. */
async function ensureAwards(db, state) {
  if (state.phase !== 'standings' || state.awardsDone === state.roundNo || !db.award) return state;
  if (!state.endedEarly) {
    try {
      for (const r of E.standings(state)) {
        if (r.score > 0) await db.award(r.id, `bus-complete:${state.roomId}:${state.roundNo}`, r.score, { rank: r.rank });
      }
    } catch (err) { console.error('[bus-complete] award failed, will retry', err && err.message); return state; }
  }
  const s = structuredClone(state);
  s.awardsDone = state.roundNo;
  return s;
}

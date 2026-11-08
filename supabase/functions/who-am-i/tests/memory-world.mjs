// «عالم» اختبار: غرفة وأعضاء وقاعدة بيانات وهمية في الذاكرة بتتصرّف زي Supabase (نفس شروط wai_activate وaward_game_points)
import { createHandler, engine as E, GAME_ID } from './.core.mjs';
export { GAME_ID };

export function makeWorld({ n = 4, selected = GAME_ID } = {}) {
  const ids = Array.from({ length: n }, (_, i) => `u${i + 1}`);
  const w = {
    clock: 1_000_000,
    room: { id: 'r1', code: 'ABC123', admin_id: 'u1', status: 'waiting', active_game: null, selected_game: selected },
    members: ids.map((id, i) => ({ user_id: id, joined_at: `t${i}`, name: `لاعب${i + 1}` })),
    totals: Object.fromEntries(ids.map((id) => [id, 1000])),
    row: null, signal: null, ledger: new Map(), failAwards: 0, conflictOnce: false, awardCalls: 0, signalListeners: [],
  };
  const db = {
    async getRoom(id) { return id === w.room.id ? { ...w.room } : null; },
    async getRoomPlayers() { return w.members.map((m) => ({ ...m })); },
    async getTotals() { return { ...w.totals }; },
    async getState() { return w.row ? { state: structuredClone(w.row.state), version: w.row.version } : null; },
    async upsertNewState(_, state) { w.row = { state: structuredClone(state), version: 0 }; w.signal = 0; },
    async deleteState() { w.row = null; w.signal = null; },
    async saveState(_, expected, state) {
      if (w.conflictOnce) { w.conflictOnce = false; w.row.version += 1; } // محاكاة: لاعب تاني كتب قبلنا
      if (!w.row || w.row.version !== expected) return null;
      w.row = { state: structuredClone(state), version: expected + 1 };
      return w.row.version;
    },
    async setSignal(_, v) { w.signal = v; for (const f of w.signalListeners) f(v); }, // بيحاكي Realtime
    async activate(_, userId) { // نفس شروط wai_activate في قاعدة البيانات
      const r = w.room;
      if (r.admin_id !== userId) throw new Error('not_admin');
      if (r.status !== 'waiting') throw new Error('bad_phase');
      if (r.selected_game !== 'who_am_i') throw new Error('wrong_game');
      if (w.members.length < 3) throw new Error('too_few');
      if (w.members.length > 10) throw new Error('too_many');
      r.status = 'playing'; r.active_game = 'who_am_i';
    },
    async award(game, key, _room, userId, points) { // نفس سلوك award_game_points (قيد فريد)
      w.awardCalls++;
      if (w.failAwards > 0) { w.failAwards--; throw new Error('db down'); }
      const k = `${game}|${key}|${userId}`;
      if (w.ledger.has(k)) return false;
      w.ledger.set(k, points);
      w.totals[userId] = (w.totals[userId] || 0) + points;
      return true;
    },
  };
  let ids2 = 0;
  const h = createHandler({ db, now: () => w.clock, rng: E.seededRng(7), newId: () => `session-${++ids2}` });
  const call = (userId, action, params = {}) => h.handle({ userId, body: { roomId: 'r1', action, ...params } });
  return { w, call, handler: h };
}


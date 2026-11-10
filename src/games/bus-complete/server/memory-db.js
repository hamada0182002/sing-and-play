// قاعدة بيانات في الذاكرة (للاختبارات والتجربة): نفس واجهة الإنتاج مع CAS على النسخة.
export function createMemoryDb({ members = [], adminId, existingScores } = {}) {
  const rooms = new Map();
  const games = new Map();
  const awards = new Map();   // key → {playerId, points}
  const log = [];
  const db = {
    rooms, games, awards, log,
    setRoom(roomId, room) { rooms.set(roomId, room); },
    async getRoom(roomId) { return rooms.get(roomId) || null; },
    async loadGame(roomId) { const g = games.get(roomId); return g ? { state: structuredClone(g.state), version: g.version } : null; },
    async saveGame(roomId, state, expected) {
      const g = games.get(roomId);
      const cur = g ? g.version : null;
      if (cur !== expected) return { ok: false, version: cur };
      const version = (cur ?? 0) + 1;
      games.set(roomId, { state: structuredClone(state), version });
      return { ok: true, version };
    },
    async award(playerId, key, points, meta) {
      if (awards.has(`${key}:${playerId}`)) return;      // منع المنح مرتين
      awards.set(`${key}:${playerId}`, { playerId, points, meta });
    },
  };
  if (members.length) rooms.set('room1', { adminId: adminId || members[0].id, members, existingScores });
  return db;
}

// طبقة الاتصال بقاعدة بيانات SING & PLAY (Supabase بمفتاح الخدمة). هي الوحيدة اللي بتعرف أسماء الجداول.
// تنفّذ نفس واجهة الـdb اللي بيستخدمها server/handler.js. كل الجداول مقفولة على التطبيق (القراءة/الكتابة من الـEdge Function فقط).
const GAME_ID = 'bus_complete';

export function makeSupabaseDb(sb) {
  const must = ({ data, error }) => { if (error) throw error; return data; };
  const stamp = () => new Date().toISOString();

  return {
    GAME_ID,

    /** الغرفة + أعضاؤها + نقاط المنصة الحالية. */
    async getRoom(roomId) {
      const room = must(await sb.from('rooms').select('id, code, admin_id, status, active_game, selected_game').eq('id', roomId).maybeSingle());
      if (!room) return null;
      const rows = must(await sb.from('room_players').select('user_id, joined_at, profiles(display_name)').eq('room_id', roomId).order('joined_at'));
      const members = rows.map((r) => {
        const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
        return { id: r.user_id, name: (p && p.display_name) || 'لاعب' };
      });
      let existingScores = {};
      if (members.length) {
        const t = must(await sb.from('profiles').select('id, total_points').in('id', members.map((m) => m.id)));
        existingScores = Object.fromEntries(t.map((x) => [x.id, x.total_points || 0]));
      }
      return { id: room.id, code: room.code, adminId: room.admin_id, status: room.status, activeGame: room.active_game, selectedGame: room.selected_game, members, existingScores };
    },

    async loadGame(roomId) {
      const r = must(await sb.from('bus_complete_games').select('state, version').eq('room_id', roomId).maybeSingle());
      return r ? { state: r.state, version: r.version } : null;
    },

    /** كتابة بشرط النسخة (compare-and-swap). expected=null يعني «لسه مفيش لعبة». */
    async saveGame(roomId, state, expected) {
      if (expected === null || expected === undefined) {
        const { error } = await sb.from('bus_complete_games').insert({ room_id: roomId, state, version: 1, updated_at: stamp() });
        if (error) { if (error.code === '23505') return { ok: false, version: null }; throw error; }
        await this.setSignal(roomId, 1);
        return { ok: true, version: 1 };
      }
      const rows = must(await sb.from('bus_complete_games').update({ state, version: expected + 1, updated_at: stamp() }).eq('room_id', roomId).eq('version', expected).select('version'));
      if (!rows || !rows.length) return { ok: false, version: null };
      await this.setSignal(roomId, rows[0].version);
      return { ok: true, version: rows[0].version };
    },

    /** إشارة بس (رقم نسخة من غير أي إجابات): لما تتغيّر كل لاعب يطلب نسخته الآمنة من الخادم. */
    async setSignal(roomId, version) {
      must(await sb.from('bus_complete_signal').upsert({ room_id: roomId, version, updated_at: stamp() }, { onConflict: 'room_id' }));
    },

    /** منح نقاط المنصة مرة واحدة (السجل العام game_point_awards بيمنع التكرار). key = bus-complete:<room>:<round> */
    async award(playerId, key, points) {
      const roomId = key.split(':')[1] || null;
      must(await sb.rpc('award_game_points', { p_game: GAME_ID, p_key: key, p_room: roomId, p_user: playerId, p_points: points }));
    },

    async activate(roomId, userId) {
      const { error } = await sb.rpc('bc_activate', { p_room: roomId, p_user: userId });
      if (error) throw new Error(error.message);
    },
    async returnToRoom(roomId, userId) {
      const { error } = await sb.rpc('bc_return_to_room', { p_room: roomId, p_user: userId });
      if (error) throw new Error(error.message);
    },
  };
}

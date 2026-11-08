// طبقة الاتصال بقاعدة البيانات (Supabase بمفتاح الخدمة). هي الوحيدة اللي بتعرف أسماء الجداول.
export function makeSupabaseDb(sb) {
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

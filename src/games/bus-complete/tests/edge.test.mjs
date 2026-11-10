// اختبارات طبقة الـEdge (server/edge.js + server/supabase-db.js) على «Supabase مزيّف» في الذاكرة.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSupabaseDb } from '../server/supabase-db.js';
import { createEdgeApi } from '../server/edge.js';

function fakeSupabase() {
  const t = { rooms: [{ id: 'r1', code: 'ABC', admin_id: 'u1', status: 'waiting', active_game: null, selected_game: 'bus_complete' }],
    room_players: ['u1', 'u2', 'u3'].map((id, i) => ({ room_id: 'r1', user_id: id, joined_at: i, profiles: { display_name: `لاعب${i + 1}` } })),
    profiles: ['u1', 'u2', 'u3'].map((id) => ({ id, total_points: 100 })), bus_complete_games: [], bus_complete_signal: [], awards: new Set() };
  const q = (name) => {
    let rows = t[name]; let op = 'select'; let payload; const filters = [];
    const api = {
      select() { if (op === 'select') op = 'select'; return api; }, order() { return api; },
      eq(k, v) { filters.push((r) => r[k] === v); return api; }, in(k, vs) { filters.push((r) => vs.includes(r[k])); return api; },
      insert(p) { op = 'insert'; payload = p; return api; }, update(p) { op = 'update'; payload = p; return api; },
      upsert(p, o) { op = 'upsert'; payload = p; api._k = o.onConflict; return api; },
      then(res) { return Promise.resolve(run()).then(res); },
      maybeSingle() { op = op === 'select' ? 'single' : op; return api; },
    };
    function run() {
      const match = rows.filter((r) => filters.every((f) => f(r)));
      if (op === 'single') return { data: match[0] || null, error: null };
      if (op === 'select') return { data: match, error: null };
      if (op === 'insert') { if (name === 'bus_complete_games' && rows.some((r) => r.room_id === payload.room_id)) return { data: null, error: { code: '23505' } }; rows.push(payload); return { data: null, error: null }; }
      if (op === 'update') { match.forEach((r) => Object.assign(r, payload)); return { data: match.map((r) => ({ version: r.version })), error: null }; }
      if (op === 'upsert') { const ex = rows.find((r) => r[api._k] === payload[api._k]); if (ex) Object.assign(ex, payload); else rows.push(payload); return { data: null, error: null }; }
    }
    return api;
  };
  return {
    t, from: q,
    async rpc(name, a) {
      if (name === 'bc_activate') {
        const r = t.rooms[0];
        if (r.admin_id !== a.p_user) return { error: { message: 'not_admin' } };
        if (r.status !== 'waiting') return { error: { message: 'bad_phase' } };
        r.status = 'playing'; r.active_game = 'bus_complete'; return { error: null };
      }
      if (name === 'bc_return_to_room') { t.rooms[0].status = 'waiting'; t.rooms[0].active_game = null; return { error: null }; }
      if (name === 'award_game_points') { const k = `${a.p_key}:${a.p_user}`; if (!t.awards.has(k)) { t.awards.add(k); t.profiles.find((p) => p.id === a.p_user).total_points += a.p_points; } return { error: null }; }
      return { error: { message: 'unknown rpc' } };
    },
  };
}

const call = (api, userId, body) => api.handle({ userId, body: { roomId: 'r1', ...body } });
async function approveAllCorrect(api) {
  const v = (await call(api, 'u1', { action: 'view' })).view;
  for (const r of v.admin.reviews[v.question.no].rows) if (r.answer) await call(api, 'u1', { action: 'gradeAnswer', params: { questionNo: v.question.no, playerId: r.playerId, status: 'correct' } });
  return call(api, 'u1', { action: 'approveQuestion' });
}

test('Edge: بدء اللعبة للأدمن فقط ثم لعب كامل مع حفظ النسخة والإشارة', async () => {
  const sb = fakeSupabase(); let clock = 1_000_000; const api = createEdgeApi({ db: makeSupabaseDb(sb), now: () => clock });
  assert.equal((await call(api, null, { action: 'init' })).ok, false);                 // بدون تسجيل دخول
  assert.equal((await call(api, 'ghost', { action: 'init' })).error.code, 'NOT_IN_ROOM'); // مش عضو
  const init = await call(api, 'u2', { action: 'init' });
  assert.equal(init.ok, true); assert.deepEqual(init.data.players.map((p) => p.isHost), [true, false, false]);
  assert.equal((await call(api, 'u2', { action: 'start' })).error.code, 'NOT_ADMIN');   // غير الأدمن
  assert.equal((await call(api, 'u1', { action: 'start' })).ok, true);
  assert.equal(sb.t.rooms[0].status, 'playing');
  assert.equal(sb.t.bus_complete_games.length, 1);
  assert.equal(sb.t.bus_complete_signal[0].version >= 1, true);
  // عميل عادي مينفعش يبدأ جولة
  assert.equal((await call(api, 'u2', { action: 'startRound', requestId: 'a' })).error.code, 'NOT_ADMIN');
  const r = await call(api, 'u1', { action: 'startRound', requestId: 'b' });
  assert.equal(r.ok, true); assert.equal(r.view.phase, 'confirm');
  // نفس الطلب لو اتكرر (إعادة شبكة) ما يتنفّذش مرتين
  const v1 = r.view.version; const again = await call(api, 'u1', { action: 'startRound', requestId: 'b' });
  assert.equal(again.view.version, v1);
});

test('Edge: نقاط المنصة بتتمنح مرة واحدة حتى لو الطلبات اتكررت', async () => {
  const sb = fakeSupabase(); let clock = 1_000_000; const api = createEdgeApi({ db: makeSupabaseDb(sb), now: () => clock });
  await call(api, 'u1', { action: 'start' });
  await call(api, 'u1', { action: 'updateSettings', params: { questionCount: 10 } });
  await call(api, 'u1', { action: 'startRound' });
  await call(api, 'u1', { action: 'advance' });
  const ids = ['u1', 'u2', 'u3'];
  for (let i = 0; i < 10; i++) {
    for (const u of ids) {
      const v = (await call(api, u, { action: 'view' })).view;
      const pts = v.me.available[0];
      await call(api, u, { action: 'lockPoints', params: { points: pts } });
      await call(api, u, { action: 'submitAnswer', params: { text: 'كلمة' } });
    }
    let v = (await call(api, 'u1', { action: 'view' })).view;
    if (v.phase === 'review') {
      assert.equal((await approveAllCorrect(api)).ok, true);
    }
    await call(api, 'u1', { action: 'advance' });
  }
  // الرهان النهائي
  for (const u of ids) await call(api, u, { action: 'lockWager', params: { amount: 10 } });
  let v = (await call(api, 'u1', { action: 'view' })).view;
  assert.equal(v.phase, 'question'); assert.equal(v.question.kind, 'final');
  for (const u of ids) await call(api, u, { action: 'submitAnswer', params: { text: 'كلمة' } });
  v = (await call(api, 'u1', { action: 'view' })).view;
  assert.equal((await approveAllCorrect(api)).ok, true);
  await call(api, 'u1', { action: 'advance' });
  v = (await call(api, 'u1', { action: 'view' })).view;
  assert.equal(v.phase, 'standings');
  const after = Object.fromEntries(sb.t.profiles.map((p) => [p.id, p.total_points]));
  for (const row of v.standings.rows) assert.equal(after[row.id], 100 + row.total, 'النقاط اتضافت مرة واحدة بالظبط');
  for (let i = 0; i < 3; i++) await call(api, 'u3', { action: 'view' });   // طلبات إضافية ما تمنحش تاني
  for (const row of v.standings.rows) assert.equal(sb.t.profiles.find((p) => p.id === row.id).total_points, 100 + row.total);
  assert.equal((await call(api, 'u2', { action: 'exit' })).ok, true);       // (الفاك بيسمح؛ التحقق الحقيقي في دالة SQL)
});

test('Edge: الغرفة لو لعبتها مختلفة بترفض أوامر أتوبيس كومبليت', async () => {
  const sb = fakeSupabase(); sb.t.rooms[0].active_game = 'who_am_i'; sb.t.rooms[0].status = 'playing';
  const api = createEdgeApi({ db: makeSupabaseDb(sb) });
  const r = await call(api, 'u1', { action: 'view' });
  assert.equal(r.ok, false);
});

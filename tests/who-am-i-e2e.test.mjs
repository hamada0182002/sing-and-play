// اختبار متكامل: 4 لاعبين، كل واحد بـSupabaseAdapter الحقيقي الخاص بالواجهة، والخادم الحقيقي (نفس كود الـEdge Function)،
// وقاعدة بيانات وهمية بتحاكي Supabase. بيجرّب: التحديث اللحظي، الأوامر، حماية الشخصية، النقاط.
// التشغيل:  node scripts/build-edge-function.mjs && node --test tests/who-am-i-e2e.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld } from '../supabase/functions/who-am-i/tests/memory-world.mjs';
import { SupabaseAdapter } from '../src/games/who-am-i/SupabaseAdapter.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fakeSupabase(world, userId) {
  return {
    functions: { invoke: async (_name, { body }) => ({ data: await world.handler.handle({ userId, body }), error: null }) },
    channel: () => {
      const ch = { on: (_t, _f, cb) => { world.w.signalListeners.push(cb); return ch; }, subscribe: () => ch };
      return ch;
    },
    removeChannel: () => undefined,
  };
}

test('4 أجهزة: تزامن لحظي، حماية الشخصية، وتخمين صح بنقاط مرة واحدة', async () => {
  const world = makeWorld({ n: 4 });
  const { w } = world;
  assert.equal((await world.call('u1', 'start')).ok, true);

  const ids = ['u1', 'u2', 'u3', 'u4'];
  const views = {};
  const adapters = {};
  for (const id of ids) {
    const a = new SupabaseAdapter('r1', fakeSupabase(world, id), { pollMs: 1e9, safetyTickMs: 1e9 });
    adapters[id] = a;
    const ctx = await a.init();
    assert.equal(ctx.currentUserId, id);
    assert.equal(ctx.players.length, 4);
    a.subscribe((v) => { views[id] = v; });
  }
  await sleep(30);
  for (const id of ids) assert.equal(views[id].phase, 'lobby');

  // المضيف يبدأ الجولة → كل الأجهزة تتحدّث لوحدها (الإشارة اللحظية)
  assert.deepEqual(await adapters.u1.startRound(), { ok: true });
  await sleep(30);
  for (const id of ids) assert.equal(views[id].phase, 'turn');
  const active = views.u1.turn.playerId;
  assert.ok(ids.includes(active));

  // الشخصية السرية: صاحب الدور مش بيستلمها أبداً، والباقيين بيشوفوها
  const secretId = w.row.state.secret.characterId;
  for (const id of ids) {
    if (id === active) {
      assert.equal(views[id].turn.character, undefined);
      assert.ok(!JSON.stringify(views[id]).includes(`"${secretId}"`));
    } else {
      assert.equal(views[id].turn.character.id, secretId);
    }
  }

  // سؤال ← إجابة، ويظهر عند الكل
  const target = ids.find((i) => i !== active);
  assert.deepEqual(await adapters[active].submitQuestion({ targetId: target, text: 'هل أنا مغنّي؟' }), { ok: true });
  await sleep(30);
  const q = views[target].turn.questions[0];
  assert.ok(q);
  assert.deepEqual(await adapters[target].submitAnswer({ questionId: q.id, answer: 'yes' }), { ok: true });
  await sleep(30);
  assert.equal(views[active].turn.questions[0].answer, 'yes');

  // لاعب غير مسموح له يجاوب
  const stranger = ids.find((i) => i !== active && i !== target);
  const bad = await adapters[stranger].submitAnswer({ questionId: q.id, answer: 'no' });
  assert.equal(bad.ok, false);

  // تخمين صح
  assert.deepEqual(await adapters[active].requestGuess(), { ok: true });
  await sleep(30);
  assert.equal(views[active].turn.guessOptions.length, 4);
  assert.deepEqual(await adapters[active].submitGuess({ choiceId: secretId }), { ok: true });
  await sleep(30);
  for (const id of ids) assert.equal(views[id].phase, 'reveal');
  assert.equal(w.ledger.size, 1);
  assert.equal(w.totals[active], 1100);

  // «الرمش»: نفس الحالة لو وصلت تاني (استعلام دوري / تيك / إشارة مكررة) ما تعيدش رسم الشاشة
  let repaints = 0;
  const unsub = adapters.u3.subscribe(() => { repaints++; });
  await sleep(30);
  const base = repaints;
  w.clock += 5000;                                   // الوقت بيعدّي وserverNow بيتغيّر، لكن الحالة لأ
  await adapters.u3._refresh(); await adapters.u3._refresh(); await adapters.u3.tick();
  assert.equal(repaints, base, 'الشاشة اتعاد رسمها من غير تغيير حقيقي');
  unsub();

  // رد قديم يوصل متأخر ما بيرجّعش الشاشة لورا
  const cur = views[active];
  adapters[active]._push({ ...cur, version: cur.version - 1, phase: 'lobby' });
  assert.equal(views[active].phase, 'reveal');

  // الأدمن يرجّع الغرفة: الأوامر بتتوقف بشكل نضيف
  w.row = null; w.room.status = 'waiting'; w.room.active_game = null;
  const after = await adapters.u2.tick();
  assert.equal(after.ok, false);
  assert.equal(after.error.code, 'NO_GAME');

  for (const id of ids) adapters[id].destroy();
});

test('لو الاتصال فشل: الأوامر بترجّع خطأ واضح بدل ما تكسر', async () => {
  const a = new SupabaseAdapter('r1', { functions: { invoke: async () => { throw new Error('offline'); } } }, { pollMs: 1e9, safetyTickMs: 1e9 });
  const r = await a.startRound();
  assert.equal(r.ok, false);
  assert.equal(r.error.code, 'NETWORK');
  await assert.rejects(() => a.init());
});

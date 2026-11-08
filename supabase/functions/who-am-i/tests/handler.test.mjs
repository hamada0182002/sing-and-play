// اختبارات الخادم: بتشغّل نفس الكود اللي هيتنشر (tests/.core.mjs) على قاعدة بيانات وهمية في الذاكرة
// التشغيل (من جذر المشروع):  node scripts/build-edge-function.mjs && node --test supabase/functions/who-am-i/tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld, GAME_ID } from './memory-world.mjs';

async function started(opts) {
  const x = makeWorld(opts);
  assert.equal((await x.call('u1', 'start')).ok, true);
  return x;
}
async function inTurn(opts) {
  const x = await started(opts);
  const r = await x.call('u1', 'startRound');
  assert.equal(r.ok, true, JSON.stringify(r));
  const activeId = x.w.row.state.turn.playerId;
  return { ...x, activeId };
}
const others = (x, id) => x.w.members.map((m) => m.user_id).filter((u) => u !== id);

test('الطلبات الغلط بتترفض بكود واضح', async () => {
  const { call } = makeWorld();
  assert.equal((await call(null, 'view')).error.code, 'NOT_AUTH');
  assert.equal((await call('u1', 'view')).error.code, 'NO_GAME');          // اللعبة لسه ما بدأتش
  assert.equal((await call('u1', 'nope')).error.code, 'BAD_ACTION');
  assert.equal((await call('u1', 'constructor')).error.code, 'BAD_ACTION');
  assert.equal((await call('u1', 'toString')).error.code, 'BAD_ACTION');
});

test('البدء: الأدمن فقط، واللعبة المختارة، و3 لاعبين على الأقل', async () => {
  let x = makeWorld();
  assert.equal((await x.call('u2', 'start')).error.code, 'not_admin');
  assert.equal(x.w.row, null);                                              // ما اتعملش أي حالة
  x = makeWorld({ selected: 'sing' });
  assert.equal((await x.call('u1', 'start')).error.code, 'wrong_game');
  x = makeWorld({ n: 2 });
  assert.equal((await x.call('u1', 'start')).error.code, 'too_few');
  assert.equal(x.w.row, null);                                              // اتنضّف
  assert.equal(x.w.room.status, 'waiting');
  x = makeWorld({ n: 11 });
  assert.equal((await x.call('u1', 'start')).error.code, 'too_many');
  x = makeWorld();
  assert.equal((await x.call('u1', 'start')).ok, true);
  assert.equal(x.w.room.status, 'playing');
  assert.equal(x.w.row.state.roomId, 'ABC123');                              // كود الغرفة القصير، مش الـUUID
  const sid = x.w.row.state.sessionId;
  assert.equal((await x.call('u1', 'start')).error.code, 'bad_phase');      // ضغطة تانية
  assert.equal(x.w.row.state.sessionId, sid);                               // اللعبة الشغالة ما اتلمستش
});

test('init: بيانات الغرفة للواجهة', async () => {
  const x = await started();
  const r = await x.call('u2', 'init');
  assert.equal(r.ok, true);
  assert.equal(r.data.currentUserId, 'u2');
  assert.equal(r.data.players.length, 4);
  assert.equal(r.data.players.find((p) => p.isHost).id, 'u1');
  assert.equal(r.data.existingScores.u3, 1000);
  assert.equal((await x.call('u99', 'init')).error.code, 'NOT_IN_ROOM');
});

test('حماية الشخصية السرية: صاحب الدور ما يستلمهاش في أي رد', async () => {
  const x = await inTurn();
  const secretId = x.w.row.state.secret.characterId;
  const spectator = others(x, x.activeId)[0];
  const spec = await x.call(spectator, 'view');
  const charName = spec.view.turn.character.name;
  assert.equal(spec.view.turn.character.id, secretId);                      // المتفرجين بيشوفوها
  const responses = [
    await x.call(x.activeId, 'view'),
    await x.call(x.activeId, 'init'),
    await x.call(x.activeId, 'tick'),
    await x.call(x.activeId, 'submitQuestion', { targetId: spectator, text: 'هل أنا مصري؟' }),
    await x.call(x.activeId, 'view'),
  ];
  for (const r of responses) {
    const json = JSON.stringify(r);
    assert.ok(!json.includes(`"${secretId}"`), 'id leaked: ' + json);
    assert.ok(!json.includes(charName), 'name leaked');
    assert.ok(!json.includes('secret') && !json.includes('sessionId') && !json.includes('pendingAwards'));
  }
  assert.equal(responses[4].view.turn.character, undefined);
  const specJson = JSON.stringify(spec);
  assert.ok(!specJson.includes('sessionId') && !specJson.includes('pendingAwards') && !specJson.includes('usedCharacterIds'));
});

test('الصلاحيات: المستهدف فقط يجاوب، والمضيف فقط يبدأ، وغير الأعضاء ممنوعين', async () => {
  const x = await started();
  assert.equal((await x.call('u2', 'startRound')).error.code, 'NOT_HOST');
  assert.equal((await x.call('u99', 'startRound')).error.code, 'NOT_IN_ROOM');
  assert.equal((await x.call('u1', 'startRound')).ok, true);
  const a = x.w.row.state.turn.playerId;
  const [t, other] = others(x, a);
  const q = await x.call(a, 'submitQuestion', { targetId: t, text: 'هل أنا لاعب كرة؟' });
  assert.equal(q.ok, true);
  const qid = x.w.row.state.turn.questions[0].id;
  assert.equal((await x.call(other, 'submitAnswer', { questionId: qid, answer: 'yes' })).error.code, 'NOT_TARGET');
  assert.equal((await x.call(a, 'submitAnswer', { questionId: qid, answer: 'yes' })).error.code, 'NOT_TARGET');
  // هوية المنفّذ من الحساب فقط: playerId جوه الطلب بيتجاهل
  assert.equal((await x.call(other, 'submitAnswer', { questionId: qid, answer: 'yes', playerId: t, userId: t })).error.code, 'NOT_TARGET');
  assert.equal((await x.call(t, 'submitAnswer', { questionId: qid, answer: 'bad' })).error.code, 'BAD_ANSWER');
  assert.equal((await x.call(t, 'submitAnswer', { questionId: qid, answer: 'yes' })).ok, true);
  assert.equal((await x.call(t, 'submitAnswer', { questionId: qid, answer: 'no' })).error.code, 'ALREADY_ANSWERED');
  assert.equal((await x.call(other, 'submitQuestion', { targetId: t, text: 'سؤال' })).error.code, 'NOT_YOUR_TURN');
});

async function guessCorrect(x, a) {
  assert.equal((await x.call(a, 'requestGuess')).ok, true);
  const r = await x.call(a, 'view');
  assert.equal(r.view.turn.guessOptions.length, 4);
  const correct = x.w.row.state.secret.characterId;
  return x.call(a, 'submitGuess', { choiceId: correct });
}

test('النقاط: بتتحسب مرة واحدة حتى لو الطلب اتكرر', async () => {
  const x = await inTurn();
  const a = x.activeId;
  const r = await guessCorrect(x, a);
  assert.equal(r.ok, true);
  assert.equal(r.view.turn.outcome, 'correct');
  assert.equal(r.view.turn.points, 100);
  assert.equal(x.w.ledger.size, 1);
  assert.equal(x.w.totals[a], 1100);
  const correct = x.w.row.state.turn.revealed;
  const again = await x.call(a, 'submitGuess', { choiceId: correct });       // إعادة نفس الطلب
  assert.equal(again.ok, false);
  assert.equal(x.w.ledger.size, 1);
  assert.equal(x.w.totals[a], 1100);
  assert.deepEqual(x.w.row.state.pendingAwards, []);                         // اتبعتت وانمسحت من الانتظار
});

test('لو تسجيل النقاط فشل: ما بتضيعش وبتتعاد، وما بتتكررش', async () => {
  const x = await inTurn();
  const a = x.activeId;
  x.w.failAwards = 1;
  const r = await guessCorrect(x, a);
  assert.equal(r.ok, true);                                                  // اللعب ما وقفش
  assert.equal(x.w.ledger.size, 0);
  assert.equal(x.w.row.state.pendingAwards.length, 1);                       // متسجلة في الحالة نفسها
  assert.equal((await x.call(a, 'tick')).ok, true);                          // أول أمر جاي بيعيد المحاولة
  assert.equal(x.w.ledger.size, 1);
  assert.equal(x.w.totals[a], 1100);
  assert.equal(x.w.row.state.pendingAwards.length, 0);
  await x.call(a, 'tick'); await x.call(a, 'tick');
  assert.equal(x.w.totals[a], 1100);
});

test('تعارض الكتابة: الأمر بيتعاد على الحالة الجديدة بدون ضياع', async () => {
  const x = await inTurn();
  const a = x.activeId;
  const [t] = others(x, a);
  x.w.conflictOnce = true;
  const r = await x.call(a, 'submitQuestion', { targetId: t, text: 'هل أنا ممثل؟' });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(x.w.row.state.turn.questions.length, 1);
});

test('جولة كاملة، جولة تانية، ثم لعبة جديدة في نفس الغرفة: النقاط بتتحسب لكل واحدة', async () => {
  const x = await inTurn();
  const n = x.w.members.length;
  let guard = 0;
  const finish = async () => {
    while (x.w.row.state.phase !== 'final' && guard++ < 100) {
      x.w.clock += 181_000;
      assert.equal((await x.call('u1', 'tick')).ok, true);
    }
    assert.equal(x.w.row.state.phase, 'final');
  };
  // الدور الأول: تخمين صح
  await guessCorrect(x, x.activeId);
  await finish();
  assert.equal(x.w.row.state.results.length, n);
  assert.equal(new Set(x.w.row.state.results.map((r) => r.playerId)).size, n);   // كل لاعب لعب مرة
  assert.equal(x.w.ledger.size, 1);

  // جولة 2
  assert.equal((await x.call('u1', 'startRound')).ok, true);
  assert.equal(x.w.row.state.roundNo, 2);
  await guessCorrect(x, x.w.row.state.turn.playerId);
  assert.equal(x.w.ledger.size, 2);

  // الأدمن يرجّع الغرفة (محاكاة return_to_room) ويبدأ لعبة جديدة
  x.w.row = null; x.w.room.status = 'waiting'; x.w.room.active_game = null;
  assert.equal((await x.call('u1', 'start')).ok, true);
  assert.equal(x.w.row.state.sessionId, 'session-2');
  assert.equal((await x.call('u1', 'startRound')).ok, true);
  await guessCorrect(x, x.w.row.state.turn.playerId);
  assert.equal(x.w.ledger.size, 3);                                          // نفس الدور ورقم الجولة، لكن جلسة مختلفة
});

test('خروج لاعب من الغرفة: بيتشال من اللوبي، وصاحب الدور الغايب دوره بيخلص فوراً', async () => {
  let x = await started();
  x.w.members = x.w.members.filter((m) => m.user_id !== 'u4');
  assert.equal((await x.call('u1', 'view')).view.players.length, 3);          // العرض متظبط فوراً
  assert.equal((await x.call('u1', 'tick')).ok, true);
  assert.equal(x.w.row.state.players.length, 3);                              // واتسجّل
  assert.equal((await x.call('u4', 'view')).error.code, 'NOT_IN_ROOM');

  x = await inTurn();
  const gone = x.activeId;
  const stay = others(x, gone)[0];
  x.w.members = x.w.members.filter((m) => m.user_id !== gone);
  if (x.w.room.admin_id === gone) x.w.room.admin_id = stay;
  const r = await x.call(stay, 'tick');                                       // من غير ما الوقت يعدّي
  assert.equal(r.ok, true);
  assert.equal(x.w.row.state.phase, 'reveal');
  assert.equal(x.w.row.state.turn.outcome, 'timeout');
});

test('طرد لاعب موجّه له سؤال معلّق: السؤال بيتسحب لوحده وصاحب الدور يكمّل', async () => {
  const x = await inTurn();
  const asker = x.activeId;
  const target = others(x, asker)[0];
  assert.equal((await x.call(asker, 'submitQuestion', { targetId: target, text: 'هل هو مصري؟' })).ok, true);
  x.w.members = x.w.members.filter((m) => m.user_id !== target);               // الأدمن طرده / قفل
  const stay = others(x, asker).find((u) => u !== target);
  if (x.w.room.admin_id === target) x.w.room.admin_id = stay;
  const r = await x.call(asker, 'view');
  const q = r.view.turn.questions[0];
  assert.equal(q.status, 'cancelled');                                         // مش مستني حد غايب
  assert.equal(r.view.turn.status, 'active');                                  // والدور كمل
});

test('لو الأدمن اتغيّر: المضيف الجديد هو اللي يبدأ الجولة', async () => {
  const x = await started();
  x.w.room.admin_id = 'u2';
  assert.equal((await x.call('u1', 'startRound')).error.code, 'NOT_HOST');
  assert.equal((await x.call('u2', 'startRound')).ok, true);
});

test('لو الأدمن رجّع الغرفة: الأوامر بتتوقف', async () => {
  const x = await inTurn();
  x.w.room.status = 'waiting'; x.w.room.active_game = null; x.w.row = null;
  assert.equal((await x.call(x.activeId, 'view')).error.code, 'NO_GAME');
  assert.equal((await x.call(x.activeId, 'tick')).error.code, 'NO_GAME');
});

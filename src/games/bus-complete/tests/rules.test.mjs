// اختبارات القواعد (الحالات 1–32 من المواصفات). شغّلها: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';
import * as E from '../game-engine/engine.js';
import { PHASE } from '../game-engine/constants.js';

const fixedRight = (state) => (id, q) => {
  // إجابة صحيحة مضمونة: نجرب قاموس الاختبار عبر تعديل الأدمن (نعتمد الأدمن) — هنا بنرجّع كلمة عشوائية ونحسمها بالأدمن
  return `كلمة${id}${q.no}`;
};

async function finishQuestion(w, { approveAs = 'correct' } = {}) {
  // يغلق السؤال بالوقت ثم يحسم كل المعلّق ويعتمد
  const st = await w.raw();
  if (st.phase === PHASE.QUESTION) { w.advanceTime(st.settings.questionSeconds * 1000 + 1000); await w.call('p1', 'tick'); }
  let st2 = await w.raw();
  if (st2.phase === PHASE.REVIEW) {
    await w.gradeAll(approveAs);
    await w.ok('p1', 'approveQuestion');
  }
}

// ───── 1–2: لاعبين ─────
test('01 لعبة بـ3 لاعبين تبدأ وتتمّ', async () => {
  const w = world(3);
  const v = await w.begin();
  assert.equal(v.phase, 'question');
  assert.equal(v.players.length, 3);
});
test('02 لعبة بـ10 لاعبين تبدأ، و11 مرفوضين، و2 مرفوضين', async () => {
  const w = world(10);
  const v = await w.begin();
  assert.equal(v.players.length, 10);
  const w2 = world(2); await w2.call('p1', 'view');
  const r = await w2.call('p1', 'startRound');
  assert.equal(r.error.code, 'TOO_FEW');
  const w3 = world(10);
  w3.db.rooms.get('room1').members.push({ id: 'p11', name: 'زائد' });
  await w3.call('p1', 'view');
  assert.equal((await w3.call('p1', 'startRound')).error.code, 'TOO_MANY');
});

// ───── 3–8: الأسئلة ─────
for (const n of [10, 15, 20]) {
  test(`0${n === 10 ? 3 : n === 15 ? 4 : 5} إعداد ${n} سؤال = ${n} أسئلة مستقلة + سؤال نهائي`, async () => {
    const w = world(4);
    await w.begin({ questionCount: n });
    const st = await w.raw();
    assert.equal(st.questions.length, n + 1);
    assert.equal(st.questions.filter((q) => q.kind === 'normal').length, n);
    assert.equal(st.questions.filter((q) => q.kind === 'final').length, 1);
    // مستقلة: أرقام متتالية، ولا تكرار (تصنيف+حرف)
    const combos = new Set(st.questions.map((q) => `${q.categoryId}|${q.letter}`));
    assert.equal(combos.size, n + 1);
  });
}
test('06 كل سؤال = تصنيف واحد + حرف واحد + إجابة واحدة لكل لاعب', async () => {
  const w = world(4);
  const v = await w.begin();
  const q = v.question;
  assert.equal(typeof q.category, 'string'); assert.equal(typeof q.letter, 'string');
  assert.equal([...q.letter].length, 1);
  assert.ok(!Array.isArray(q.category));
  await w.ok('p2', 'lockPoints', { points: 1 });
  await w.ok('p2', 'submitAnswer', { text: 'اختبار' });
  const r = await w.call('p2', 'submitAnswer', { text: 'تاني' });
  assert.equal(r.error.code, 'ALREADY_SUBMITTED');
});
test('07 مفيش عرض لكل التصنيفات في سؤال واحد (الإسقاط ما فيهوش قائمة تصنيفات للسؤال ولا أسئلة جاية)', async () => {
  const w = world(4);
  const v = await w.begin();
  const json = JSON.stringify({ ...v, settings: undefined, admin: undefined, nextQuestion: undefined });
  const st = await w.raw();
  // الأسئلة الجاية (حرف/تصنيف) ما بتوصلش للاعب العادي
  const v2 = await w.view('p2');
  assert.equal(v2.nextQuestion, undefined);
  assert.equal(v2.admin, undefined);
  assert.equal(Object.keys(v2.question).includes('categories'), false);
  assert.equal(typeof v2.question.category, 'string');
  for (const q of st.questions.slice(1)) {
    const s = JSON.stringify(v2.question);
    assert.ok(!s.includes(`"letter":"${q.letter}","startedAt":null`));
  }
});
test('08 لوحة النقاط بتتغيّر حسب عدد الأسئلة', async () => {
  for (const n of [10, 15, 20]) {
    const w = world(3);
    const v = await w.begin({ questionCount: n });
    assert.deepEqual(v.me.available, Array.from({ length: n }, (_, i) => i + 1));
    assert.equal(v.progress.normalTotal, n);
  }
});

// ───── 9–10: الأرقام ─────
test('09 كل لاعب يقدر يستخدم نفس الرقم اللي استخدمه لاعب تاني', async () => {
  const w = world(4);
  await w.begin();
  for (const id of w.ids) await w.ok(id, 'lockPoints', { points: 7 });
  const v = await w.view('p1');
  for (const id of w.ids) assert.ok(v.admin.roster.find((r) => r.id === id).used.includes(7));
});
test('10 اللاعب مينفعش يستخدم نفس الرقم مرتين (وبتتحرق حتى لو ما كتبش إجابة)', async () => {
  const w = world(3);
  await w.begin({});
  await w.ok('p2', 'lockPoints', { points: 5 });
  assert.equal((await w.call('p2', 'lockPoints', { points: 6 })).error.code, 'POINTS_LOCKED');
  // نقفل السؤال ونعدّي للتاني
  await w.ok('p2', 'submitAnswer', { text: 'xx' }).catch(() => {});
  await finishQuestion(w);
  w.advanceTime(13000); await w.call('p1', 'tick');
  const st = await w.raw();
  assert.equal(st.cursor, 1);
  const r = await w.call('p2', 'lockPoints', { points: 5 });
  assert.equal(r.error.code, 'NUMBER_USED');
  const v = await w.view('p2');
  assert.ok(!v.me.available.includes(5));
  assert.equal((await w.call('p2', 'lockPoints', { points: 99 })).error.code, 'BAD_POINTS');
});

// ───── 11–12, 25: النقاط ─────
test('11 الإجابة الصحيحة تضيف النقاط', async () => {
  const w = world(3);
  await w.begin();
  await w.answerAll((id, q) => `كلمة${id}`, { points: (i) => 10 - i });
  await w.gradeAll('correct');
  await w.ok('p1', 'approveQuestion');
  const v = await w.view('p2');
  assert.equal(v.scores.p1, 10); assert.equal(v.scores.p2, 9); assert.equal(v.scores.p3, 8);
});
test('12 + 25 الإجابة الخاطئة لا تضيف ولا تخصم، ولا تُخصم نقاط في الأسئلة العادية أبدًا', async () => {
  const w = world(3);
  await w.begin();
  await w.answerAll((id) => `كلمة${id}`, { points: () => 9 });
  await w.gradeAll('correct'); await w.ok('p1', 'approveQuestion');
  w.advanceTime(13000); await w.call('p1', 'tick');
  await w.answerAll((id) => `كلمة${id}`, { points: () => 8 });
  await w.gradeAll('wrong'); await w.ok('p1', 'approveQuestion');
  const v = await w.view('p1');
  assert.deepEqual(Object.values(v.scores), [9, 9, 9]);        // المثال: 50 → صح 70 / غلط 50 (هنا 9 يفضل 9)
  // سلبية مستحيلة: أي سؤال عادي delta >= 0
  const st = await w.raw();
  for (const q of st.questions.filter((x) => x.approved)) for (const id of w.ids) assert.ok(E.questionDelta(st, q, id) >= 0);
});

// ───── 13–16: الكارت ─────
test('13 الكارت يضاعف نقاط السؤال الصحيح فقط (النقاط القديمة ما تتضاعفش)', async () => {
  const w = world(3);
  await w.begin();
  await w.answerAll((id) => `كلمة${id}`, { points: () => 5 });
  await w.gradeAll('correct'); await w.ok('p1', 'approveQuestion');
  w.advanceTime(13000); await w.call('p1', 'tick');
  await w.ok('p2', 'lockPoints', { points: 10 });
  await w.ok('p2', 'activateDouble');
  await w.ok('p2', 'submitAnswer', { text: 'كلمهب' });
  for (const id of ['p1', 'p3']) { await w.ok(id, 'lockPoints', { points: 1 }); await w.ok(id, 'submitAnswer', { text: `س${id}` }); }
  await w.gradeAll('correct'); await w.ok('p1', 'approveQuestion');
  const v = await w.view('p2');
  assert.equal(v.scores.p2, 5 + 20);   // 5 القديمة ثابتة + 10×2
  assert.equal(v.scores.p1, 5 + 1);
});
test('14 الكارت ما يخصمش شيء عند الإجابة الخاطئة', async () => {
  const w = world(3);
  await w.begin();
  await w.answerAll((id) => `كلمة${id}`, { points: () => 4 });
  await w.gradeAll('correct'); await w.ok('p1', 'approveQuestion');
  w.advanceTime(13000); await w.call('p1', 'tick');
  await w.ok('p3', 'lockPoints', { points: 9 }); await w.ok('p3', 'activateDouble'); await w.ok('p3', 'submitAnswer', { text: 'ززز' });
  for (const id of ['p1', 'p2']) { await w.ok(id, 'lockPoints', { points: 1 }); await w.ok(id, 'submitAnswer', { text: `س${id}` }); }
  await w.gradeAll('wrong'); await w.ok('p1', 'approveQuestion');
  assert.equal((await w.view('p3')).scores.p3, 4);
});
test('15 الكارت مينفعش مرتين (حتى مع الضغط المتكرر أو إعادة إرسال الطلب)', async () => {
  const w = world(3);
  await w.begin();
  await w.ok('p2', 'lockPoints', { points: 3 });
  const first = await w.ok('p2', 'activateDouble', {}, { requestId: 'r-1' });
  assert.equal(first.me.card.state, 'used');
  await w.ok('p2', 'activateDouble', {}, { requestId: 'r-1' });      // نفس الطلب: بدون أثر
  await w.ok('p2', 'activateDouble', {});                            // ضغطة تانية على نفس السؤال: بدون أثر
  const st = await w.raw();
  assert.equal(st.cards.p2, 1);
  // سؤال تاني: مرفوض
  await w.ok('p2', 'submitAnswer', { text: 'ككك' });
  for (const id of ['p1', 'p3']) { await w.ok(id, 'lockPoints', { points: 1 }); await w.ok(id, 'submitAnswer', { text: `س${id}` }); }
  await w.gradeAll('correct'); await w.ok('p1', 'approveQuestion');
  w.advanceTime(13000); await w.call('p1', 'tick');
  await w.ok('p2', 'lockPoints', { points: 2 });
  assert.equal((await w.call('p2', 'activateDouble')).error.code, 'CARD_USED');
});
test('16 الكارت لا يعمل في السؤال النهائي ولا بعد إرسال الإجابة', async () => {
  const w = world(3);
  await w.begin({ questionCount: 10 });
  await w.ok('p2', 'lockPoints', { points: 3 }); await w.ok('p2', 'submitAnswer', { text: 'ككك' });
  assert.equal((await w.call('p2', 'activateDouble')).error.code, 'ALREADY_SUBMITTED');
  // نقفز للنهائي
  const st = await w.raw();
  assert.equal(st.questions[10].kind, 'final');
  for (let i = 0; i < 10; i++) {
    const s = await w.raw();
    if (s.phase === PHASE.QUESTION) { w.advanceTime(41000); await w.call('p1', 'tick'); }
    const s2 = await w.raw();
    if (s2.phase === PHASE.REVIEW) { await w.ok('p1', 'approveQuestion').catch(async () => { await w.gradeAll('wrong'); await w.ok('p1', 'approveQuestion'); }); }
    w.advanceTime(13000); await w.call('p1', 'tick');
  }
  assert.equal((await w.raw()).phase, PHASE.WAGER);
  for (const id of w.ids) await w.ok(id, 'lockWager', { amount: 10 });
  const fin = await w.raw();
  assert.equal(fin.phase, PHASE.QUESTION);
  assert.equal(fin.questions[fin.cursor].kind, 'final');
  assert.equal((await w.call('p2', 'activateDouble')).error.code, 'NO_CARD_IN_FINAL');
  assert.equal((await w.call('p2', 'lockPoints', { points: 3 })).error.code, 'BAD_PHASE');
});

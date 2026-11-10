// اختبارات القواعد (الحالات 17–32 + أمان + إدارة).
import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';
import { PHASE } from '../game-engine/constants.js';
import { validateAnswer } from '../validation/validator.js';
import * as E from '../game-engine/engine.js';

/** يعدّي كل الأسئلة العادية (الكل بيرسل كلمة، الأدمن يحسمها) لحد مرحلة المراهنة. */
async function runToWager(w, { grade = 'wrong' } = {}) {
  let st = await w.raw();
  while (st.phase !== PHASE.WAGER) {
    if (st.phase === PHASE.QUESTION) { w.advanceTime(61000); await w.call('p1', 'tick'); }
    st = await w.raw();
    if (st.phase === PHASE.REVIEW) {
      const q = st.questions[st.cursor];
      for (const id of w.ids) if (q.answers[id]) await w.ok('p1', 'gradeAnswer', { playerId: id, status: grade });
      await w.ok('p1', 'approveQuestion');
    }
    w.advanceTime(13000); await w.call('p1', 'tick');
    st = await w.raw();
  }
}
async function toFinalQuestion(w, wagers) {
  await runToWager(w);
  for (const [i, id] of w.ids.entries()) await w.ok(id, 'lockWager', { amount: wagers[i] });
}

// ───── 17 + 32: الوقت ─────
test('17 + 32 انتهاء الوقت يقفل السؤال تلقائيًا ويمنع أي إرسال أو تعديل بعده', async () => {
  const w = world(3);
  await w.begin({ questionSeconds: 15 });
  await w.ok('p2', 'lockPoints', { points: 2 });
  w.advanceTime(14_000);
  assert.equal((await w.view('p2')).phase, 'question');
  w.advanceTime(1_001);
  const v = await w.view('p3');          // أي طلب بيعمل tick
  assert.equal(v.phase, 'review');
  assert.equal((await w.call('p2', 'submitAnswer', { text: 'متأخر' })).error.code, 'BAD_PHASE');
  assert.equal((await w.call('p3', 'lockPoints', { points: 1 })).error.code, 'BAD_PHASE');
  const st = await w.raw();
  assert.equal(st.questions[0].closeReason, 'timeout');
  assert.equal(Object.keys(st.questions[0].answers).length, 0);
});
test('17b الوقت بيقفل بالساعة اللي في الخادم، وعلى مستوى الأمر (حتى قبل أي tick)', async () => {
  const w = world(3);
  await w.begin();
  await w.ok('p2', 'lockPoints', { points: 2 });
  const st = await w.raw(); const ends = st.questions[0].endsAt;
  // أمر مباشر على المحرك بعد انتهاء الوقت من غير tick
  const r = (() => { try { E.submitAnswer(st, 'p2', { text: 'x' }, { now: ends + 1 }); return null; } catch (e) { return e.code; } })();
  assert.equal(r, 'TIME_UP');
});
test('32b السؤال بيتقفل أول ما الكل يرسل (قبل انتهاء الوقت)', async () => {
  const w = world(3);
  await w.begin();
  await w.answerAll((id) => `ا${id}`);
  const st = await w.raw();
  assert.equal(st.phase, 'review'); assert.equal(st.questions[0].closeReason, 'all_submitted');
});

// ───── 18: الحروف العربية ─────
test('18 اختلافات كتابة الحروف العربية', () => {
  const ok = (text, letter, id) => validateAnswer({ text, letter, category: { id, builtin: true } });
  // أ إ آ ا
  for (const t of ['أحمد', 'احمد', 'إحمد']) assert.equal(ok(t, 'ا', 'boy').verdict, 'correct', t);
  assert.equal(ok('آدم', 'ا', 'boy').verdict, 'correct');
  assert.equal(ok('أسد', 'ا', 'animal').verdict, 'correct');
  // ة ه
  assert.equal(ok('قطة', 'ق', 'animal').verdict, 'correct');
  assert.equal(ok('قطه', 'ق', 'animal').verdict, 'correct');
  // ى ي
  assert.equal(ok('مصطفى', 'م', 'boy').verdict, 'correct');
  assert.equal(ok('مصطفي', 'م', 'boy').verdict, 'correct');
  // تشكيل
  assert.equal(ok('حَمَار', 'ح', 'animal').verdict, 'correct');
  // مسافات زائدة وداخل الاسم
  assert.equal(ok('   رامي   ', 'ر', 'boy').verdict, 'correct');
  assert.equal(ok('عبد الله', 'ع', 'boy').verdict, 'correct');
  assert.equal(ok('عبدالله', 'ع', 'boy').verdict, 'correct');
  // «ال» التعريف
  assert.equal(ok('الأسد', 'ا', 'animal').verdict, 'correct');
  assert.equal(ok('البطة', 'ب', 'animal').verdict, 'correct');
  // لا تعتمد على أول حرف فقط: كلمة مجهولة بالحرف الصحيح = مراجعة وليست صحيحة
  assert.equal(ok('رخرخرخ', 'ر', 'boy').verdict, 'review');
  // حرف خطأ = غلط، فاضية = غلط، لاتيني = غلط، حرف واحد = غلط
  assert.equal(ok('سامي', 'ر', 'boy').verdict, 'wrong');
  assert.equal(ok('', 'ر', 'boy').verdict, 'wrong');
  assert.equal(ok('ramy', 'ر', 'boy').verdict, 'wrong');
  assert.equal(ok('ر', 'ر', 'boy').verdict, 'wrong');
  // تصنيف مضاف يدويًا = دائمًا مراجعة (إلا بعد التعلّم)
  assert.equal(validateAnswer({ text: 'كراسة', letter: 'ك', category: { id: 'c1', builtin: false } }).verdict, 'review');
  assert.equal(validateAnswer({ text: 'كراسة', letter: 'ك', category: { id: 'c1', builtin: false }, learned: new Set(['كراسه']) }).verdict, 'correct');
  // تقارب كتابي = مراجعة مع اقتراح
  const near = ok('حصانن', 'ح', 'animal');
  assert.equal(near.verdict, 'review'); assert.equal(near.suggestion, 'حصان');
});

// ───── 19: التكرار ─────
test('19 منع الإجابات المكررة: لا تُحتسب صحيحة تلقائيًا ويراجعها الأدمن', async () => {
  const w = world(4);
  await w.begin();
  const st0 = await w.raw(); const q0 = st0.questions[0];
  const word = (id) => (id === 'p1' || id === 'p2') ? `${q0.letter}ببببب` : `${q0.letter}ننن${id}`;
  await w.answerAll(word, { points: () => 5 });
  let v = await w.view('p1');
  const rows = v.admin.reviews[1].rows;
  assert.equal(rows.find((r) => r.playerId === 'p1').status, 'duplicate');
  assert.equal(rows.find((r) => r.playerId === 'p2').status, 'duplicate');
  assert.equal(rows.find((r) => r.playerId === 'p1').dup.with[0], 'p2');
  assert.equal(v.admin.reviews[1].canApprove, false);
  assert.equal((await w.call('p1', 'approveQuestion')).error.code, 'UNRESOLVED');
  // الأدمن يقرّر: p1 صح و p2 غلط
  await w.ok('p1', 'gradeAnswer', { playerId: 'p1', status: 'correct' });
  await w.ok('p1', 'gradeAnswer', { playerId: 'p2', status: 'wrong' });
  await w.ok('p1', 'bulkGrade', { status: 'wrong' });
  await w.ok('p1', 'approveQuestion');
  v = await w.view('p3');
  assert.equal(v.scores.p1, 5); assert.equal(v.scores.p2, 0);
});
test('19b سياسة التكرار قابلة للضبط (void / first / share)', async () => {
  for (const [policy, expect] of [['void', [0, 0]], ['first', [5, 0]], ['share', [5, 5]]]) {
    const w = world(3);
    await w.call('p1', 'view');
    await w.ok('p1', 'updateSettings', { duplicatePolicy: policy });
    await w.begin();
    const q = (await w.raw()).questions[0];
    await w.ok('p1', 'lockPoints', { points: 5 }); await w.ok('p1', 'submitAnswer', { text: `${q.letter}مممم` });
    w.advanceTime(1000);
    await w.ok('p2', 'lockPoints', { points: 5 }); await w.ok('p2', 'submitAnswer', { text: `${q.letter}مممم` });
    await w.ok('p3', 'lockPoints', { points: 5 });
    w.advanceTime(60000); await w.call('p1', 'tick');
    const v = await w.view('p1');
    const rows = v.admin.reviews[1].rows;
    // الإجابة نفسها مجهولة (review)، فنحسمها بالأدمن للي لسه معلّق، ونتأكد من منطق التكرار
    for (const r of rows.filter((x) => x.unresolved && x.status === 'review')) await w.ok('p1', 'gradeAnswer', { playerId: r.playerId, status: 'correct' });
    const left = (await w.view('p1')).admin.reviews[1].rows.filter((x) => x.unresolved);
    assert.equal(left.length, 0, policy);
    await w.ok('p1', 'approveQuestion');
    const s = (await w.view('p1')).scores;
    assert.deepEqual([s.p1, s.p2], expect, policy);
  }
});
test('19c كلمتين متشابهتين في المعنى (مش نفس الكتابة) ما تعتبرش تكرار تلقائيًا', async () => {
  const w = world(3);
  await w.begin();
  const q = (await w.raw()).questions[0];
  await w.ok('p1', 'lockPoints', { points: 1 }); await w.ok('p1', 'submitAnswer', { text: `${q.letter}ببب` });
  await w.ok('p2', 'lockPoints', { points: 1 }); await w.ok('p2', 'submitAnswer', { text: `${q.letter}ببج` });
  await w.ok('p3', 'lockPoints', { points: 1 }); await w.ok('p3', 'submitAnswer', { text: `${q.letter}ككك` });
  const rows = (await w.view('p1')).admin.reviews[1].rows;
  assert.ok(rows.every((r) => !r.dup));
});

// ───── 20–21: تدخل الأدمن ─────
test('20 + 21 تدخل الأدمن في التصحيح ويعيد حساب النقاط (حتى بعد الاعتماد) مع سجل Audit', async () => {
  const w = world(3);
  await w.begin();
  await w.answerAll((id) => `كلمة${id}`, { points: (i) => 10 - i });
  await w.gradeAll('correct'); await w.ok('p1', 'approveQuestion');
  assert.equal((await w.view('p2')).scores.p2, 9);
  // تصحيح لاحق: p2 من صح لغلط
  await w.ok('p1', 'gradeAnswer', { questionNo: 1, playerId: 'p2', status: 'wrong' });
  assert.equal((await w.view('p2')).scores.p2, 0);
  // رجوع للتقييم التلقائي (review → مفروض يفتح معلّق من جديد)
  await w.ok('p1', 'gradeAnswer', { questionNo: 1, playerId: 'p2', status: 'correct' });
  assert.equal((await w.view('p2')).scores.p2, 9);
  // الأدمن ما يقدرش يعدّل نص الإجابة: الأمر مش موجود أصلًا (صح/غلط بس)
  const v = await w.view('p1');
  assert.equal((await w.call('p1', 'editAnswer', { questionNo: 1, playerId: 'p3', text: 'أي حاجة' })).ok, false);
  const row = v.admin.reviews[1].rows.find((r) => r.playerId === 'p3');
  assert.ok(row && !row.answer.endsWith('تجربة'));
  // Audit
  const types = v.admin.audit.map((a) => a.type);
  assert.ok(types.includes('grade') && types.includes('approve') && !types.includes('editAnswer'));
  // غير الأدمن ممنوع
  assert.equal((await w.call('p2', 'gradeAnswer', { questionNo: 1, playerId: 'p3', status: 'correct' })).error.code, 'NOT_ADMIN');
  assert.equal((await w.call('p2', 'approveQuestion')).error.code, 'NOT_ADMIN');
});

// ───── 22–24: النهائي ─────
test('22 + 23 + 24 الرهان النهائي 0 و10 و20: صح يضيف، غلط يخصم، صفر لا يغيّر', async () => {
  const w = world(4);
  await w.begin();
  await toFinalQuestion(w, [0, 10, 20, 10]);
  let st = await w.raw();
  assert.equal(st.phase, 'question'); const fq = st.questions[st.cursor]; assert.equal(fq.kind, 'final');
  for (const id of w.ids) await w.ok(id, 'submitAnswer', { text: `${fq.letter}ااا${id}` });
  assert.equal((await w.raw()).phase, 'review');
  // p1(0) صح، p2(10) صح، p3(20) غلط، p4(10) غلط
  await w.ok('p1', 'gradeAnswer', { playerId: 'p1', status: 'correct' });
  await w.ok('p1', 'gradeAnswer', { playerId: 'p2', status: 'correct' });
  await w.ok('p1', 'gradeAnswer', { playerId: 'p3', status: 'wrong' });
  await w.ok('p1', 'gradeAnswer', { playerId: 'p4', status: 'wrong' });
  await w.ok('p1', 'approveQuestion');
  const v = await w.view('p2');
  assert.deepEqual([v.scores.p1, v.scores.p2, v.scores.p3, v.scores.p4], [0, 10, -20, -10]);
  // الرهان 0 غلط: ما يتغيّرش
  w.advanceTime(13000); await w.call('p1', 'tick');
  const fin = (await w.view('p1')).standings;
  assert.equal(fin.rows[0].id, 'p2');
  assert.equal(fin.rows.find((r) => r.id === 'p1').finalDelta, 0);
});
test('22b رهان غير مسموح مرفوض، ولا تغيير بعد التأكيد، والرهانات مخفية عن الباقيين قبل الإغلاق', async () => {
  const w = world(3);
  await w.begin();
  await runToWager(w);
  assert.equal((await w.call('p2', 'lockWager', { amount: 15 })).error.code, 'BAD_WAGER');
  await w.ok('p2', 'lockWager', { amount: 20 });
  assert.equal((await w.call('p2', 'lockWager', { amount: 10 })).error.code, 'WAGER_LOCKED');
  const v3 = await w.view('p3');
  const flat = JSON.stringify(v3);
  assert.ok(v3.wager.players.find((p) => p.id === 'p2').confirmed);
  assert.equal(v3.wager.mine, null);
  assert.ok(!/"wager":20/.test(flat) && !/"wagers"/.test(flat.replace('"wagers":null', '')));
  // عدم الإرسال لحد انتهاء الوقت = صفر
  w.advanceTime(21_000);
  const v = await w.view('p3');
  assert.equal(v.phase, 'question');
  assert.deepEqual(Object.values(v.question.wagers).sort(), [0, 0, 20]);
});

// ───── 26: انقطاع الاتصال ─────
test('26 انقطاع لاعب وعودته: الحالة محفوظة ويكمل من حيث توقف', async () => {
  const w = world(4);
  await w.begin();
  await w.ok('p3', 'lockPoints', { points: 6 });
  await w.ok('p3', 'activateDouble');
  // p3 يخرج من الغرفة (انقطاع) ثم يرجع
  const members = w.db.rooms.get('room1').members;
  w.db.rooms.get('room1').members = members.filter((m) => m.id !== 'p3');
  const during = await w.view('p1');
  assert.equal(during.players.find((p) => p.id === 'p3').left, true);
  assert.equal((await w.call('p3', 'view')).error.code, 'NOT_IN_ROOM');
  w.db.rooms.get('room1').members = members;
  const back = await w.view('p3');
  assert.equal(back.me.card.state, 'used');
  assert.deepEqual(back.me.used, [6]);
  assert.equal(back.question.mine.points, 6);
  assert.equal(back.players.find((p) => p.id === 'p3').left, false);
  await w.ok('p3', 'submitAnswer', { text: 'رجعت' });
});
test('26b لاعب خرج ولم يرسل لا يعطّل السؤال (السؤال يقفل لما كل الموجودين يرسلوا)', async () => {
  const w = world(4);
  await w.begin();
  const members = w.db.rooms.get('room1').members;
  w.db.rooms.get('room1').members = members.filter((m) => m.id !== 'p4');
  await w.answerAll((id) => `ا${id}`, { only: ['p1', 'p2', 'p3'] });
  assert.equal((await w.raw()).phase, 'review');
});

// ───── 27: منع التكرار في الاحتساب ─────
test('27 عدم احتساب نفس الإجابة أو النقاط مرتين', async () => {
  const w = world(3);
  await w.begin();
  await w.answerAll((id) => `كلمة${id}`, { points: () => 4 });
  await w.gradeAll('correct');
  await w.ok('p1', 'approveQuestion');
  assert.equal((await w.call('p1', 'approveQuestion')).error.code, 'BAD_PHASE');   // اعتماد ثاني مرفوض
  await w.ok('p1', 'gradeAnswer', { questionNo: 1, playerId: 'p1', status: 'correct' });
  await w.ok('p1', 'gradeAnswer', { questionNo: 1, playerId: 'p1', status: 'correct' });
  assert.equal((await w.view('p1')).scores.p1, 4);
  // نفس طلب الإرسال بنفس requestId
  w.advanceTime(13000); await w.call('p1', 'tick');
  await w.ok('p2', 'lockPoints', { points: 2 }, { requestId: 'x1' });
  await w.ok('p2', 'lockPoints', { points: 2 }, { requestId: 'x1' });
  const st = await w.raw();
  assert.deepEqual(st.used.p2, [4, 2]);
  // منح نقاط المنصة مرة واحدة فقط لكل جولة
  const w2 = world(3);
  await w2.begin();
  await w2.answerAll((id) => `كلمة${id}`, { points: () => 6 });
  await w2.gradeAll('correct'); await w2.ok('p1', 'approveQuestion');
  w2.advanceTime(13000); await w2.call('p1', 'tick');
  await runToWager(w2, { grade: 'correct' });
  for (const id of w2.ids) await w2.ok(id, 'lockWager', { amount: 0 });
  const q = (await w2.raw()); const fq = q.questions[q.cursor];
  for (const id of w2.ids) await w2.ok(id, 'submitAnswer', { text: `${fq.letter}خخخ` });
  for (const id of w2.ids) await w2.ok('p1', 'gradeAnswer', { playerId: id, status: 'correct' });
  await w2.ok('p1', 'approveQuestion');
  w2.advanceTime(13000); await w2.call('p1', 'tick');
  assert.equal((await w2.raw()).phase, 'standings');
  const n = w2.db.awards.size;
  await w2.call('p1', 'tick'); await w2.call('p2', 'view');
  assert.equal(w2.db.awards.size, n);
  assert.ok(n >= 1);
});

// ───── 28–31: الخصوصية واللوبي ─────
test('28 + 30 اللاعب لا يرى إجابات غيره قبل إرساله، والإجابات غير المرسلة (المسودات) مخفية تمامًا', async () => {
  const w = world(4);
  await w.begin();
  await w.ok('p1', 'lockPoints', { points: 1 }); await w.ok('p1', 'submitAnswer', { text: 'سرّ-أحمد' });
  await w.ok('p2', 'lockPoints', { points: 1 });
  const v2 = await w.view('p2');                       // p2 ما أرسلش
  assert.equal(v2.question.answersVisible, false);
  assert.deepEqual(v2.question.answers, []);
  assert.ok(!JSON.stringify(v2).includes('سرّ-أحمد'));
  const v3 = await w.view('p3');
  assert.ok(!JSON.stringify(v3).includes('سرّ-أحمد'));
  // أي رسالة/حدث/نسخة خادم ما فيهاش مسودات: الخادم ما استلمش حاجة غير المرسل
  const st = await w.raw();
  assert.equal(Object.keys(st.questions[0].answers).length, 1);
  // الأدمن نفسه (لو ما أرسلش) ما يشوفش
  const w2 = world(3); await w2.begin();
  await w2.ok('p2', 'lockPoints', { points: 1 }); await w2.ok('p2', 'submitAnswer', { text: 'إجابة-سرية' });
  const va = await w2.view('p1');
  assert.equal(va.question.answersVisible, false);
  assert.ok(!JSON.stringify(va).includes('إجابة-سرية'));
  // لكن مؤشّر «أرسل» ظاهر للكل
  assert.equal(va.question.players.find((p) => p.id === 'p2').submitted, true);
});
test('29 + 31 بعد الإرسال اللاعب يشوف إجابات اللي أرسلوا قبله وبعده فورًا (اللوبي)', async () => {
  const w = world(4);
  await w.begin();
  await w.ok('p1', 'lockPoints', { points: 1 }); await w.ok('p1', 'submitAnswer', { text: 'رامي' });
  await w.ok('p2', 'lockPoints', { points: 1 }); await w.ok('p2', 'submitAnswer', { text: 'رائد' });
  let v = await w.view('p2');
  assert.equal(v.question.answersVisible, true);
  assert.deepEqual(v.question.answers.map((a) => a.text).sort(), ['رائد', 'رامي'].sort());
  // p3 يرسل بعدهم: ظاهر فورًا لـp1 و p2 (من غير تحديث صفحة، أول استعلام)
  await w.ok('p3', 'lockPoints', { points: 1 }); await w.ok('p3', 'submitAnswer', { text: 'ريان' });
  v = await w.view('p1');
  assert.equal(v.question.answers.length, 3);
  assert.deepEqual(v.question.players.map((p) => [p.name, p.submitted]).filter(([, s]) => !s).map(([n]) => n), ['علي']);
  // مرتّبة حسب أسماء اللاعبين
  const names = v.question.answers.map((a) => a.name);
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b, 'ar')));
});

// ───── إعدادات وإدارة ─────
test('إعدادات: قيم مسموحة فقط، الأدمن فقط، وفي اللوبي فقط', async () => {
  const w = world(3);
  await w.call('p1', 'view');
  assert.equal((await w.call('p2', 'updateSettings', { questionCount: 15 })).error.code, 'NOT_ADMIN');
  assert.equal((await w.call('p1', 'updateSettings', { questionCount: 12 })).error.code, 'BAD_SETTINGS');
  assert.equal((await w.call('p1', 'updateSettings', { questionSeconds: 25 })).error.code, 'BAD_SETTINGS');
  for (const n of [10, 15, 20]) for (const s of [15, 20, 30, 40]) await w.ok('p1', 'updateSettings', { questionCount: n, questionSeconds: s });
  const v = await w.view('p2');            // اللاعبون بيشوفوا الإعدادات قبل البداية
  assert.equal(v.settings.questionCount, 20); assert.equal(v.settings.questionSeconds, 40);
  await w.ok('p1', 'startRound');
  assert.equal((await w.call('p1', 'updateSettings', { questionCount: 10 })).error.code, 'BAD_PHASE');
});
test('تصنيفات: إضافة وتعديل وحذف، والحروف المتاحة، والأدمن يحدد الحرف يدويًا', async () => {
  const w = world(3);
  await w.call('p1', 'view');
  let v = await w.ok('p1', 'addCategory', { name: 'ماركة سيارات' });
  const cat = v.settings.categories.at(-1);
  assert.equal(cat.builtin, false);
  assert.equal((await w.call('p1', 'addCategory', { name: 'ماركة  سيارات' })).error.code, 'BAD_CATEGORY');   // مكرر
  v = await w.ok('p1', 'updateCategory', { id: cat.id, name: 'ماركات' });
  assert.equal(v.settings.categories.at(-1).name, 'ماركات');
  await w.ok('p1', 'removeCategory', { id: 'girl' });
  for (const c of v.settings.categories.filter((c) => c.id !== cat.id && c.id !== 'girl')) await w.ok('p1', 'updateCategory', { id: c.id, enabled: false });
  assert.equal((await w.call('p1', 'updateCategory', { id: cat.id, enabled: false })).error.code, 'NO_CATEGORIES');
  await w.ok('p1', 'updateSettings', { letters: ['ك', 'م', 'س', 'ر', 'ب', 'ن', 'ل'] });
  assert.equal((await w.call('p1', 'updateSettings', { letters: ['ك'] })).error.code, 'BAD_SETTINGS');
  await w.ok('p1', 'startRound');
  const st = await w.raw();
  assert.ok(st.questions.every((q) => q.categoryId === cat.id && 'كمسربنل'.includes(q.letter)));
  // تعديل السؤال الجاي (حرف يدوي) — أدمن فقط ومرئي له فقط
  const vAdmin = await w.view('p1'); const vP = await w.view('p2');
  assert.equal(vAdmin.nextQuestion.no, 1); assert.equal(vP.nextQuestion, undefined);
  await w.ok('p1', 'adjustNext', { letter: 'خ' });
  assert.equal((await w.raw()).questions[0].letter, 'خ');
  assert.equal((await w.call('p2', 'adjustNext', { letter: 'م' })).error.code, 'NOT_ADMIN');
  assert.equal((await w.call('p1', 'adjustNext', { letter: 'a' })).error.code, 'BAD_LETTER');
});
test('التعلّم: كلمة اعتمدها الأدمن تتصحح تلقائيًا بعد كده في نفس التصنيف', async () => {
  const w = world(3);
  await w.call('p1', 'view');
  await w.ok('p1', 'updateSettings', { letters: ['ك', 'م', 'س', 'ر', 'ب', 'ن'], questionCount: 10 });
  for (const c of (await w.view('p1')).settings.categories) if (c.id !== 'object') await w.ok('p1', 'updateCategory', { id: c.id, enabled: false });
  await w.begin();
  const q = (await w.raw()).questions[0];
  const word = `${q.letter}ككككك`;
  await w.answerAll((id) => (id === 'p2' ? word : `${q.letter}ز${id}ز`), { points: () => 1 });
  await w.ok('p1', 'gradeAnswer', { playerId: 'p2', status: 'correct' });
  await w.gradeAll('wrong').catch(() => {});
  await w.ok('p1', 'gradeAnswer', { playerId: 'p2', status: 'correct' });
  await w.ok('p1', 'approveQuestion');
  assert.deepEqual((await w.raw()).learned.object, [word.slice(0)].map((x) => x.replace(/[ًٌٍَُِّْ]/g, '')).map((x) => x));
});
test('إنهاء الجولة، وجولة جديدة تعيد ضبط الأرقام والكارت والنقاط', async () => {
  const w = world(3);
  await w.begin();
  await w.ok('p2', 'lockPoints', { points: 3 }); await w.ok('p2', 'activateDouble');
  await w.ok('p1', 'endRound');
  const v = await w.view('p2');
  assert.equal(v.phase, 'standings'); assert.equal(v.standings.early, true);
  assert.equal((await w.call('p2', 'newRound')).error.code, 'NOT_ADMIN');
  await w.ok('p1', 'newRound');
  const v2 = await w.view('p2');
  assert.equal(v2.phase, 'lobby'); assert.deepEqual(v2.me.used, []); assert.equal(v2.me.card.state, 'available'); assert.equal(v2.me.score, 0);
  assert.equal(v2.existingScores.p2, 100);          // نقاط المنصة محفوظة ومنفصلة
  await w.ok('p1', 'startRound');
  assert.equal((await w.raw()).roundNo, 2);
});
test('الترتيب: التعادل في نفس المركز', async () => {
  const { rank } = await import('../scoring/scoring.js');
  const r = rank([{ id: 'a', name: 'أ', score: 30 }, { id: 'b', name: 'ب', score: 50 }, { id: 'c', name: 'ج', score: 30 }, { id: 'd', name: 'د', score: 10 }]);
  assert.deepEqual(r.map((x) => [x.id, x.rank]), [['b', 1], ['a', 2], ['c', 2], ['d', 4]]);
});
test('تزامن: تعارض الكتابة (CAS) يُعاد تلقائيًا من غير ضياع أي إرسال', async () => {
  const w = world(6);
  await w.begin();
  await Promise.all(w.ids.map((id) => w.call(id, 'lockPoints', { points: 3 })));
  const st = await w.raw();
  assert.equal(Object.keys(st.questions[0].picks).length, 6);
  await Promise.all(w.ids.map((id) => w.call(id, 'submitAnswer', { text: `ر${id}` })));
  const st2 = await w.raw();
  assert.equal(Object.keys(st2.questions[0].answers).length, 6);
});

// ───── الإرسال السريع: النقاط + الإجابة (+ كارت ×٢) في أمر واحد ─────
test('إرسال واحد بالنقاط والإجابة: الرقم بيتحرق والإجابة بتتثبّت من غير lockPoints', async () => {
  const w = world(4);
  await w.begin();
  const v = await w.ok('p2', 'submitAnswer', { text: 'اختبار', points: 4 });
  assert.equal(v.question.mine.submitted, true);
  assert.equal(v.question.mine.points, 4);
  assert.ok(!v.me.available.includes(4));
  assert.equal((await w.call('p2', 'submitAnswer', { text: 'تاني', points: 5 })).error.code, 'ALREADY_SUBMITTED');
});
test('إرسال بدون رقم نقاط في سؤال عادي مرفوض ومفيش حاجة بتتغيّر', async () => {
  const w = await world(4);
  await w.begin();
  const r = await w.call('p2', 'submitAnswer', { text: 'اختبار' });
  assert.equal(r.error.code, 'POINTS_FIRST');
  const v = await w.view('p2');
  assert.equal(v.question.mine.submitted, false);
  assert.equal(v.question.mine.points, null);
  assert.equal((await w.call('p2', 'submitAnswer', { text: 'اختبار', points: 99 })).error.code, 'BAD_POINTS');
  assert.equal((await w.call('p2', 'submitAnswer', { text: '   ', points: 3 })).error.code, 'EMPTY_ANSWER');
  assert.deepEqual((await w.view('p2')).me.used, []);     // الرقم ما اتحرقش بإرسال فاشل
});
test('إرسال برقم مستخدم قبل كده مرفوض، وكارت ×٢ في نفس الإرسال بيتفعّل مرة واحدة', async () => {
  const w = world(4, { settings: { questionSeconds: 30 } });
  await w.begin();
  await w.ok('p2', 'submitAnswer', { text: 'أول', points: 3, double: true });
  let v = await w.view('p2');
  assert.equal(v.question.mine.doubled, true);
  assert.equal(v.me.card.state, 'used');
  // نخلّي السؤال يخلص ونروح للسؤال التاني
  for (const id of ['p1', 'p3', 'p4']) await w.ok(id, 'submitAnswer', { text: `س${id}`, points: 1 });
  await w.gradeAll('correct'); await w.ok('p1', 'approveQuestion'); await w.ok('p1', 'advance');
  v = await w.view('p2');
  assert.equal(v.question.no, 2);
  assert.equal((await w.call('p2', 'submitAnswer', { text: 'تاني', points: 3 })).error.code, 'NUMBER_USED');
  assert.equal((await w.call('p2', 'submitAnswer', { text: 'تاني', points: 5, double: true })).error.code, 'CARD_USED');
  v = await w.view('p2');
  assert.equal(v.question.mine.submitted, false);        // الفشل ما سابش أثر
  assert.ok(v.me.available.includes(5));
});

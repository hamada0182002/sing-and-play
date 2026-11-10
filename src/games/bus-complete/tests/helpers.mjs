import { handle } from '../server/handler.js';
import { createMemoryDb } from '../server/memory-db.js';
import { seededRng } from '../game-engine/rng.js';

const NAMES = ['أحمد', 'محمد', 'حمادة', 'علي', 'سارة', 'منى', 'يوسف', 'ليلى', 'كريم', 'نور'];

/** عالم اختبار: غرفة + ساعة تحت السيطرة + دالة call لكل لاعب. */
export function world(n = 4, { seed = 7, settings } = {}) {
  const members = Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: NAMES[i] }));
  const db = createMemoryDb();
  db.setRoom('room1', { adminId: 'p1', members, existingScores: Object.fromEntries(members.map((m) => [m.id, 100])) });
  const w = {
    db, members, now: 1_000_000, rng: seededRng(seed), seq: 0, ids: members.map((m) => m.id),
    async call(user, action, params = {}, extra = {}) {
      return handle(db, { roomId: 'room1', userId: user, action, params, now: w.now, rng: w.rng, ...extra });
    },
    async ok(user, action, params, extra) {
      const r = await w.call(user, action, params, extra);
      if (!r.ok) throw new Error(`${user}.${action} فشل: ${r.error.code} ${r.error.message}`);
      return r.view;
    },
    view: (user = 'p1') => w.call(user, 'view').then((r) => r.view),
    advanceTime(ms) { w.now += ms; },
    async raw() { return (await db.loadGame('room1')).state; },
    /** الأدمن يحسم كل إجابات السؤال الحالي (كل من أرسل) بنفس الحالة. */
    async gradeAll(status) {
      const st = await w.raw();
      const q = st.questions[st.cursor];
      for (const id of w.ids) if (q.answers[id]) await w.ok('p1', 'gradeAnswer', { playerId: id, status });
    },
    /** يبدأ الجولة ويفتح السؤال الأول. */
    async begin(patch = {}) {
      await w.call('p1', 'view');
      if (Object.keys(patch).length) await w.ok('p1', 'updateSettings', patch);
      if (settings) await w.ok('p1', 'updateSettings', settings);
      await w.ok('p1', 'startRound');
      w.advanceTime(7000);
      return w.call('p1', 'tick').then((r) => r.view);
    },
    /** كل اللاعبين يثبّتوا نقاطهم ويرسلوا إجاباتهم (answers: دالة (pid,q)→نص أو مصفوفة). */
    async answerAll(answer, { points = (i) => 1, only } = {}) {
      const st = await w.raw();
      const q = st.questions[st.cursor];
      for (const [i, id] of w.ids.entries()) {
        if (only && !only.includes(id)) continue;
        if (q.kind === 'normal') await w.ok(id, 'lockPoints', { points: points(i, q) });
        const text = typeof answer === 'function' ? answer(id, q, i) : answer;
        if (text != null) await w.ok(id, 'submitAnswer', { text });
      }
    },
  };
  return w;
}

/** إجابات صحيحة جاهزة في القاموس لكل (تصنيف، حرف) — للاختبارات التي تحتاج إجابات صحيحة مؤكدة. */
export const GOOD = {
  boy: { م: 'محمد', ا: 'أحمد', ع: 'علي', ح: 'حسن', ر: 'رامي', ك: 'كريم', س: 'سامي', ف: 'فادي', ن: 'نبيل', و: 'وليد', ب: 'باسم', ت: 'تامر', ج: 'جمال', خ: 'خالد', د: 'داود', ش: 'شريف', ص: 'صلاح', ط: 'طارق', ق: 'قاسم', ل: 'ليث', ه: 'هاني', ي: 'يوسف' },
};

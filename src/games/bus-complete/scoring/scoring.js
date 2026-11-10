// حساب النقاط — دوال نقية. النقاط دائمًا «مشتقة» من حالة الأسئلة المعتمدة (لا نضيف ولا نخصم بالتراكم)،
// فمستحيل تتحسب نفس الإجابة مرتين، وأي تعديل من الأدمن بيعيد الحساب صح بمجرد استدعاء computeScores من جديد.

export const ANSWER_STATUS = { PENDING: 'pending', CORRECT: 'correct', WRONG: 'wrong', DUPLICATE: 'duplicate', REVIEW: 'review' };

/**
 * نقاط إجابة واحدة.
 *  - سؤال عادي: صح → قيمة النقاط المختارة (×٢ لو الكارت متفعّل). غلط/مكرر/مراجعة → صفر دائمًا (ممنوع الخصم).
 *  - السؤال النهائي: صح → +الرهان. أي حالة غير صح → −الرهان (والرهان صفر = صفر).
 */
export function pointsForAnswer({ kind, status, points = 0, doubled = false, wager = 0 }) {
  if (kind === 'final') {
    if (status === ANSWER_STATUS.CORRECT) return wager;
    return -wager;
  }
  if (status !== ANSWER_STATUS.CORRECT) return 0;
  return (points | 0) * (doubled ? 2 : 1);
}

/** تفاصيل نقاط لاعب في سؤال (للعرض). */
export function breakdown({ kind, status, points = 0, doubled = false, wager = 0 }) {
  const delta = pointsForAnswer({ kind, status, points, doubled, wager });
  return { delta, base: kind === 'final' ? wager : points, doubled: kind === 'final' ? false : !!doubled, status };
}

/**
 * ترتيب المتسابقين: الأعلى أولًا، والتعادل = نفس المركز (١،١،٣).
 * @param {{id:string, score:number}[]} rows
 */
export function rank(rows) {
  const sorted = rows.slice().sort((a, b) => b.score - a.score || String(a.name || a.id).localeCompare(String(b.name || b.id), 'ar'));
  let prevScore = null;
  let prevRank = 0;
  return sorted.map((r, i) => {
    const rk = r.score === prevScore ? prevRank : i + 1;
    prevScore = r.score; prevRank = rk;
    return { ...r, rank: rk, tied: sorted.filter((x) => x.score === r.score).length > 1 };
  });
}

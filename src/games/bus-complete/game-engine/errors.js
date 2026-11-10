// أخطاء اللعبة: كود ثابت + رسالة عربية جاهزة للعرض.
export const MESSAGES = {
  NOT_ADMIN: 'الأدمن فقط يقدر يعمل ده',
  NOT_IN_ROOM: 'انت مش موجود في الغرفة دي',
  BAD_PHASE: 'مش وقت ده دلوقتي',
  TOO_FEW: 'لازم 3 لاعبين على الأقل',
  TOO_MANY: 'الحد الأقصى 10 لاعبين',
  BAD_SETTINGS: 'إعدادات الجولة غير صحيحة',
  BAD_CATEGORY: 'التصنيف غير صحيح',
  NO_CATEGORIES: 'لازم تصنيف واحد على الأقل شغّال',
  TIME_UP: 'الوقت خلص',
  POINTS_FIRST: 'اختار قيمة النقاط الأول',
  BAD_POINTS: 'قيمة النقاط غير صحيحة',
  NUMBER_USED: 'الرقم ده استخدمته قبل كده',
  POINTS_LOCKED: 'النقاط اتثبّتت ومينفعش تتغيّر',
  CARD_USED: 'كارت المضاعفة اتستخدم قبل كده',
  NO_CARD_IN_FINAL: 'كارت المضاعفة مش شغّال في السؤال النهائي',
  ALREADY_SUBMITTED: 'إجابتك اتبعتت قبل كده',
  EMPTY_ANSWER: 'اكتب إجابتك الأول',
  ANSWER_TOO_LONG: 'الإجابة طويلة جدًا',
  BAD_WAGER: 'قيمة الرهان غير صحيحة',
  WAGER_LOCKED: 'الرهان اتأكّد ومينفعش يتغيّر',
  UNRESOLVED: 'لسه فيه إجابات محتاجة مراجعة',
  NO_SUCH_ANSWER: 'مفيش إجابة للاعب ده في السؤال ده',
  NO_SUCH_QUESTION: 'السؤال مش موجود',
  BAD_LETTER: 'الحرف غير صحيح',
  LEFT_ROOM: 'انت خرجت من الجولة دي',
  NO_NEXT: 'مفيش سؤال جاي نعدّله دلوقتي',
};

export class GameError extends Error {
  constructor(code, message) { super(message || MESSAGES[code] || code); this.code = code; }
}

export function need(cond, code, msg) { if (!cond) throw new GameError(code, msg); }

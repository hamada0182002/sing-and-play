// نصوص الواجهة المشتركة (عامية مصرية مختصرة، بنفس نبرة SING & PLAY).
export const BRAND = 'SING & PLAY';
export const GAME_NAME = 'أتوبيس كومبليت';
export const GAME_NAME_EN = 'BUS COMPLETE';

export const STATUS_LABEL = {
  correct: 'صح', wrong: 'غلط', duplicate: 'مكرر', review: 'محتاج مراجعة', pending: 'قيد التصحيح',
};
export const STATUS_TONE = { correct: 'olive', wrong: 'brick', duplicate: 'flame', review: 'butter', pending: 'ivory' };

export const POLICY_LABEL = {
  review: 'الأدمن يراجع كل مكرر',
  void: 'المكرر ما يتحسبش لحد',
  first: 'أول من أرسل يتحسب له',
  share: 'المكرر يتحسب للكل',
};

export const RULES = [
  { t: 'كل سؤال له **تصنيف واحد** و**حرف واحد**: اكتب إجابة واحدة بس تبدأ بالحرف ده.' },
  { t: 'قبل ما تكتب، **اختار قيمة نقاط** من لوحتك. كل رقم تستخدمه **مرة واحدة** طول الجولة.' },
  { t: 'إجابة صح = تاخد النقاط اللي اخترتها. إجابة غلط = **ما بتخسرش حاجة**.' },
  { t: 'معاك كارت **×٢** واحد: يضاعف نقاط سؤال واحد بس، ومينفعش تتراجع بعد التفعيل.' },
  { t: 'في الآخر **سؤال نهائي**: راهن بـ٠ أو ١٠ أو ٢٠ نقطة. صح = تكسبهم، غلط = **تخسرهم**.' },
];

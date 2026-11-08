// قواعد اللعبة كما وردت في ملف التصميم. مصدر واحد للقيم في كل الكود.
export const RULES = {
  minPlayers: 2,
  maxPlayers: 15,
  turnSeconds: 40, // وقت الدور كله (تسجيل / إيقاف / إعادة)
  voteSeconds: 40, // وقت التصويت
  starsMin: 0,
  starsMax: 5,
  penaltyPoints: 10,
} as const;

export const CARD_TYPES = ['second_chance', 'skip_turn', 'deduct_points', 'force_player'] as const;
export type CardType = (typeof CARD_TYPES)[number];

export const CARD_LABELS: Record<CardType, string> = {
  second_chance: 'فرصة ثانية',
  skip_turn: 'تخطي الدور',
  deduct_points: 'خصم النقاط',
  force_player: 'إجبار لاعب',
};

export const ARABIC_LETTERS = [
  'ا','ب','ت','ث','ج','ح','خ','د','ذ','ر','ز','س','ش','ص','ض','ط','ظ','ع','غ','ف','ق','ك','ل','م','ن','ه','و','ي',
] as const;

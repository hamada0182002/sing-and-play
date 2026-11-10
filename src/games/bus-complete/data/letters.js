// الحروف العربية. آمنة للعميل (لا تحتوي أي إجابات).
// الحرف الداخلي «ا» بيتعرض «أ» في الواجهة، ويقبل في التصحيح أ إ آ ا.

export const ARABIC_LETTERS = [
  'ا', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'د', 'ذ', 'ر', 'ز', 'س', 'ش', 'ص',
  'ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ك', 'ل', 'م', 'ن', 'ه', 'و', 'ي',
];

/** الحروف الصعبة/غير المناسبة (مستبعدة افتراضيًا، والأدمن يقدر يرجّعها). */
export const HARD_LETTERS = ['ث', 'ذ', 'ز', 'ض', 'ظ', 'غ'];

export const DEFAULT_LETTERS = ARABIC_LETTERS.filter((l) => !HARD_LETTERS.includes(l));

/** شكل الحرف في العرض. */
export function letterLabel(l) { return l === 'ا' ? 'أ' : l; }

export function isValidLetter(l) { return ARABIC_LETTERS.includes(l); }

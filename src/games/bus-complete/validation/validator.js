// نظام التحقق من الإجابات العربية — دوال نقية، بدون AI API وبدون شبكة.
//
// المخرجات: verdict ∈ { correct | wrong | review } + reason + مفتاح مقارنة (key) + اقتراح اختياري.
//   correct : النظام متأكد أن الإجابة صحيحة (موجودة في القاموس أو اعتمدها الأدمن قبل كده في نفس الجولة).
//   wrong   : النظام متأكد أنها غلط (فاضية، حروف غير عربية، قصيرة جدًا، لا تبدأ بالحرف المطلوب).
//   review  : النظام مش قادر يحسم (كلمة مش في القاموس، تصنيف مضاف يدويًا، تشابه كتابي) → تظهر للأدمن.
//
// ما فيش اعتماد على قائمة صغيرة كمرجع وحيد: القاموس بيتوسّع بالتعلّم من اعتمادات الأدمن (learned) ويقبل مزوّد قاموس خارجي.
import { cleanText, normalize, answerKey, startsWithLetter, hasForeignChars, editDistance } from '../utils/arabic.js';
import { LEXICON, LEXICON_BY_LETTER, LEXICON_DISPLAY } from '../data/lexicon/index.js';

export const VERDICT = { CORRECT: 'correct', WRONG: 'wrong', REVIEW: 'review' };

export const REASON = {
  EMPTY: 'empty',
  BAD_CHARS: 'bad_chars',
  TOO_SHORT: 'too_short',
  TOO_LONG: 'too_long',
  LETTER_MISMATCH: 'letter_mismatch',
  IN_LEXICON: 'in_lexicon',
  LEARNED: 'learned',
  NEAR_MATCH: 'near_match',
  OTHER_CATEGORY: 'other_category',
  UNKNOWN_WORD: 'unknown_word',
  CUSTOM_CATEGORY: 'custom_category',
  NO_ANSWER: 'no_answer',
};

/** رسائل عربية جاهزة للأدمن/اللاعب. */
export const REASON_TEXT = {
  empty: 'إجابة فاضية',
  no_answer: 'ما أرسلش إجابة',
  bad_chars: 'فيها حروف أو أرقام غير عربية',
  too_short: 'قصيرة جدًا',
  too_long: 'طويلة جدًا',
  letter_mismatch: 'ما بتبدأش بالحرف المطلوب',
  in_lexicon: 'موجودة في القاموس',
  learned: 'اعتمدها الأدمن قبل كده',
  near_match: 'قريبة من كلمة معروفة',
  other_category: 'كلمة معروفة لكن من تصنيف تاني',
  unknown_word: 'كلمة مش في القاموس',
  custom_category: 'تصنيف مضاف يدويًا',
};

export const DEFAULT_VALIDATION = { maxLength: 40, minLetters: 2, fuzzyMinLength: 4 };

const ALLOWED_PUNCT = /[.,،!؟?:;"'«»()\-_؟،؛]/g;

const defaultLexicon = { sets: LEXICON, byLetter: LEXICON_BY_LETTER, display: LEXICON_DISPLAY };

// أسماء الأولاد والبنات: مفيش تحويل مذكر/مؤنث (كريم ≠ كريمة) عشان ما نقبلش اسم ولد في تصنيف بنت
const NAME_CATEGORIES = new Set(['boy', 'girl']);

function variants(key, categoryId) {
  const out = [key];
  if (NAME_CATEGORIES.has(categoryId)) return out;
  if (key.endsWith('ه') && key.length > 2) out.push(key.slice(0, -1));   // معلمه ← معلم
  else out.push(`${key}ه`);                                             // قط ← قطه
  return out;
}

/**
 * @param {{text:string, letter:string, category:{id:string,name?:string,builtin?:boolean},
 *          learned?:Set<string>, lexicon?:object, options?:object}} input
 * @returns {{verdict:string, reason:string, key:string, suggestion?:string}}
 */
export function validateAnswer({ text, letter, category, learned, lexicon = defaultLexicon, options = {} }) {
  const opt = { ...DEFAULT_VALIDATION, ...options };
  const cleaned = cleanText(text);
  if (!cleaned) return { verdict: VERDICT.WRONG, reason: REASON.EMPTY, key: '' };

  // 1) الشكل: حروف عربية فقط (الرموز البسيطة تتجاهل)
  if (hasForeignChars(cleaned.replace(ALLOWED_PUNCT, ''))) return { verdict: VERDICT.WRONG, reason: REASON.BAD_CHARS, key: '' };
  const n = normalize(cleaned);
  const key = answerKey(cleaned);
  if (n.length < opt.minLetters) return { verdict: VERDICT.WRONG, reason: REASON.TOO_SHORT, key };
  if (cleaned.length > opt.maxLength) return { verdict: VERDICT.WRONG, reason: REASON.TOO_LONG, key };

  // 2) الحرف الأول (مع قبول «ال» التعريف)
  if (!startsWithLetter(cleaned, letter)) return { verdict: VERDICT.WRONG, reason: REASON.LETTER_MISMATCH, key };

  // 3) اعتمادات الأدمن السابقة في نفس الجولة لنفس التصنيف
  if (learned) for (const v of variants(key, category.id)) if (learned.has(v)) return { verdict: VERDICT.CORRECT, reason: REASON.LEARNED, key };

  // 4) القاموس المدمج للتصنيفات الأصلية
  const set = category.builtin ? lexicon.sets[category.id] : null;
  if (set) {
    for (const v of variants(key, category.id)) if (set.has(v)) return { verdict: VERDICT.CORRECT, reason: REASON.IN_LEXICON, key };

    // 5) تشابه كتابي بسيط (حرف واحد زيادة/ناقص/مختلف) في نفس الحرف الأول → مراجعة مع اقتراح
    if (key.length >= opt.fuzzyMinLength) {
      const pool = (lexicon.byLetter[category.id] || {})[key[0]] || [];
      let best = null;
      for (const cand of pool) {
        if (editDistance(key, cand, 1) <= 1) { best = cand; break; }
      }
      if (best) return { verdict: VERDICT.REVIEW, reason: REASON.NEAR_MATCH, key, suggestion: (lexicon.display[category.id] || new Map()).get(best) || best };
    }

    // 6) كلمة معروفة في تصنيف تاني؟ (ممكن تنفع للتصنيفين) → مراجعة
    for (const [id, other] of Object.entries(lexicon.sets)) {
      if (id === category.id) continue;
      if (variants(key, id).some((v) => other.has(v))) return { verdict: VERDICT.REVIEW, reason: REASON.OTHER_CATEGORY, key };
    }
    return { verdict: VERDICT.REVIEW, reason: REASON.UNKNOWN_WORD, key };
  }
  return { verdict: VERDICT.REVIEW, reason: REASON.CUSTOM_CATEGORY, key };
}

/** مفتاح مقارنة للتكرار (نفس المستخدم في learned). */
export { answerKey };

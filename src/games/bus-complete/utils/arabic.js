// أدوات اللغة العربية — دوال نقية بلا DOM وبلا شبكة (آمنة للاستخدام على الخادم وفي الاختبارات).
//
// مستويات التطبيع:
//   cleanText()   تنظيف خفيف للعرض: يشيل التشكيل والتطويل والرموز الخفية ويضبط المسافات، من غير ما يغيّر الحروف.
//   normalize()   تطبيع للمقارنة: يوحّد الهمزات (أ إ آ ا) والياء (ى ي) والتاء المربوطة (ة ه) ويشيل المسافات.
//   stripArticle() يشيل «ال» التعريف من أول الكلمة (الأسد → أسد).

const TASHKEEL = /[ً-ٰٟۖ-ۭ]/g;       // تشكيل + علامات قرآنية صغيرة
const TATWEEL = /ـ/g;
const INVISIBLE = /[​-‏‪-‮⁦-⁩﻿­]/g;
const NOT_ARABIC_LETTER = /[^ء-يٱٮٯکڪی\s]/g; // أي حاجة غير الحروف العربية والمسافة

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const EASTERN = '۰۱۲۳۴۵۶۷۸۹';

/** تنظيف خفيف: بدون تغيير الحروف. */
export function cleanText(input) {
  return String(input ?? '')
    .normalize('NFC')
    .replace(INVISIBLE, '')
    .replace(TASHKEEL, '')
    .replace(TATWEEL, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** توحيد شكل الحرف الواحد (للمقارنة بين حرف السؤال وأول حرف في الإجابة). */
export function foldLetter(ch) {
  switch (ch) {
    case 'أ': case 'إ': case 'آ': case 'ٱ': return 'ا';
    case 'ى': case 'ئ': return 'ي';
    case 'ؤ': return 'و';
    case 'ة': return 'ه';
    case 'ک': return 'ك';
    case 'ی': return 'ي';
    default: return ch;
  }
}

/** تطبيع للمقارنة: يحتفظ بالمسافات (الاستخدام الداخلي)، ويشيل كل ما هو غير حرف عربي. */
export function normalizeSpaced(input) {
  let s = cleanText(input).replace(NOT_ARABIC_LETTER, ' ').replace(/\s+/g, ' ').trim();
  return [...s].map(foldLetter).join('');
}

/** تطبيع للمقارنة بدون مسافات: «عبد الله» = «عبدالله». */
export function normalize(input) {
  return normalizeSpaced(input).replace(/\s+/g, '');
}

/** يشيل «ال» التعريف من أول الإجابة (على النص المُطبَّع). لا يشيلها لو الباقي أقل من حرفين. */
export function stripArticle(normalized) {
  if (normalized.startsWith('ال') && normalized.length - 2 >= 2) return normalized.slice(2);
  return normalized;
}

/** مفتاح مقارنة الإجابات (للتكرار والقاموس): مطبَّع + بدون «ال» + بدون مسافات. */
export function answerKey(input) {
  return stripArticle(normalize(input));
}

/** أول حرف مطبَّع في الإجابة، أو '' لو مفيش. */
export function firstLetter(input) {
  const n = normalizeSpaced(input).replace(/\s+/g, '');
  return n ? n[0] : '';
}

/**
 * هل الإجابة تبدأ بالحرف المطلوب؟
 * بتقبل: أول حرف مباشرة، أو أول حرف بعد «ال» التعريف (البطة ← ب). ما بتعتمدش على أول حرف فقط في التصحيح كله.
 */
export function startsWithLetter(input, letter) {
  const target = foldLetter(letter);
  const n = normalize(input);
  if (!n) return false;
  if (n[0] === target) return true;
  const s = stripArticle(n);
  return s !== n && s[0] === target;
}

/** عدد الحروف العربية الفعلية في الإجابة (بدون مسافات). */
export function letterCount(input) {
  return normalize(input).length;
}

/** هل في الإجابة حروف غير عربية (لاتينية/أرقام/رموز)؟ */
export function hasForeignChars(input) {
  const t = cleanText(input).replace(/\s+/g, '');
  const stripped = t.replace(/[ء-يٱٮٯکڪی]/g, '');
  return stripped.length > 0;
}

/** مسافة التعديل (Levenshtein) بسقف: بترجّع max+1 لو الفرق أكبر من السقف (أسرع). */
export function editDistance(a, b, max = 2) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** أرقام عربية-هندية للعرض (٢٤). */
export function toArabicDigits(n) {
  return String(n).replace(/\d/g, (d) => ARABIC_INDIC[d]);
}

/** أرقام عربية/فارسية → لاتينية (لو اللاعب كتب أرقام في حقل رقمي). */
export function fromArabicDigits(s) {
  return String(s ?? '').replace(/[٠-٩]/g, (d) => String(ARABIC_INDIC.indexOf(d))).replace(/[۰-۹]/g, (d) => String(EASTERN.indexOf(d)));
}

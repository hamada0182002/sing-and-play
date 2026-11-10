// إعدادات الجولة: القيم الافتراضية + التحقق من تعديلات الأدمن.
import { DEFAULT_CATEGORIES, MAX_CATEGORIES, MAX_CATEGORY_NAME } from '../data/categories.js';
import { DEFAULT_LETTERS, isValidLetter } from '../data/letters.js';
import { cleanText, normalize } from '../utils/arabic.js';
import { GameError, need } from './errors.js';

/** القيم المسموحة (مصدر واحد للواجهة والخادم). */
export const OPTIONS = {
  questionCount: [10, 15, 20],
  questionSeconds: [15, 20, 30, 40],
  finalSeconds: [20, 30, 45, 60],
  wagerSeconds: [10, 20, 30],
  resultsSeconds: [0, 8, 12, 20],
  duplicatePolicy: ['review', 'void', 'first', 'share'],
  wagerOptions: [0, 10, 20],
};

export const DUPLICATE_POLICY_TEXT = {
  review: 'الأدمن يراجع كل مكرر',
  void: 'المكرر ما يتحسبش لأي لاعب',
  first: 'أول من أرسل فقط يتحسب له',
  share: 'المكرر يتحسب للجميع',
};

export const DEFAULT_SETTINGS = {
  questionCount: 10,
  questionSeconds: 30,
  finalSeconds: 30,
  wagerSeconds: 20,
  resultsSeconds: 8,        // 0 = يدوي (الأدمن يضغط «السؤال التالي»)
  confirmSeconds: 6,
  duplicatePolicy: 'review',
  autoApprove: false,       // لو مفيش أي إجابة محتاجة مراجعة يعتمد السؤال تلقائيًا
  wagerOptions: OPTIONS.wagerOptions,
  minPlayers: 3,
  maxPlayers: 10,
  maxAnswerLength: 40,
  letters: DEFAULT_LETTERS,
  categories: DEFAULT_CATEGORIES,
};

export function defaultSettings(overrides = {}) {
  const s = structuredClone({ ...DEFAULT_SETTINGS, ...overrides });
  return s;
}

const SCALAR_KEYS = ['questionCount', 'questionSeconds', 'finalSeconds', 'wagerSeconds', 'resultsSeconds', 'duplicatePolicy', 'autoApprove'];

/** يطبّق تعديل الأدمن على الإعدادات (بعد التحقق من كل قيمة). بيرجّع نسخة جديدة. */
export function applySettingsPatch(settings, patch) {
  const next = structuredClone(settings);
  need(patch && typeof patch === 'object', 'BAD_SETTINGS');
  for (const [k, v] of Object.entries(patch)) {
    if (k === 'autoApprove') { need(typeof v === 'boolean', 'BAD_SETTINGS'); next.autoApprove = v; continue; }
    if (k === 'letters') {
      need(Array.isArray(v) && v.every(isValidLetter), 'BAD_LETTER');
      const uniq = [...new Set(v)];
      need(uniq.length >= 6, 'BAD_SETTINGS', 'اختار 6 حروف على الأقل');
      next.letters = uniq;
      continue;
    }
    need(SCALAR_KEYS.includes(k), 'BAD_SETTINGS', `إعداد غير معروف: ${k}`);
    need(OPTIONS[k].includes(v), 'BAD_SETTINGS', `قيمة غير مسموحة لـ ${k}`);
    next[k] = v;
  }
  return next;
}

// ───────── التصنيفات ─────────
export function enabledCategories(settings) { return settings.categories.filter((c) => c.enabled); }

function cleanName(name) {
  const n = cleanText(name);
  need(n.length >= 2 && n.length <= MAX_CATEGORY_NAME, 'BAD_CATEGORY', `اسم التصنيف من 2 لـ ${MAX_CATEGORY_NAME} حرف`);
  need(!/[<>]/.test(n), 'BAD_CATEGORY');
  return n;
}

function assertUniqueName(categories, name, exceptId) {
  const key = normalize(name);
  need(!categories.some((c) => c.id !== exceptId && normalize(c.name) === key), 'BAD_CATEGORY', 'التصنيف ده موجود بالفعل');
}

export function addCategory(settings, seq, { name }) {
  const next = structuredClone(settings);
  need(next.categories.length < MAX_CATEGORIES, 'BAD_CATEGORY', 'وصلت للحد الأقصى من التصنيفات');
  const clean = cleanName(name);
  assertUniqueName(next.categories, clean);
  next.categories.push({ id: `c${seq}`, name: clean, enabled: true, builtin: false });
  return next;
}

export function updateCategory(settings, { id, name, enabled }) {
  const next = structuredClone(settings);
  const c = next.categories.find((x) => x.id === id);
  need(c, 'BAD_CATEGORY');
  if (name !== undefined) { const clean = cleanName(name); assertUniqueName(next.categories, clean, id); c.name = clean; }
  if (enabled !== undefined) { need(typeof enabled === 'boolean', 'BAD_CATEGORY'); c.enabled = enabled; }
  need(enabledCategories(next).length >= 1, 'NO_CATEGORIES');
  return next;
}

export function removeCategory(settings, { id }) {
  const next = structuredClone(settings);
  need(next.categories.some((x) => x.id === id), 'BAD_CATEGORY');
  next.categories = next.categories.filter((x) => x.id !== id);
  need(enabledCategories(next).length >= 1, 'NO_CATEGORIES');
  return next;
}

export function resetCategories(settings) {
  const next = structuredClone(settings);
  next.categories = structuredClone(DEFAULT_CATEGORIES);
  return next;
}

export { GameError };

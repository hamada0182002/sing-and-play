// إنشاء الأسئلة المستقلة: كل سؤال = تصنيف واحد + حرف واحد. بدون تكرار نفس (تصنيف + حرف) في الجولة إذا أمكن.
import { shuffle, pickOne } from './rng.js';
import { enabledCategories } from './settings.js';
import { GameError } from './errors.js';

function emptyQuestion(no, kind, cat, letter) {
  return {
    no, kind, categoryId: cat.id, category: cat.name, letter,
    startedAt: null, endsAt: null, closedAt: null, closeReason: null,
    picks: {}, doubled: {}, answers: {}, grades: {},
    approved: false, approvedAt: null,
  };
}

/** يبني (عدد الأسئلة العادية + السؤال النهائي). التصنيفات بتتوزّع بالتناوب عشان التنوّع، والحرف عشوائي من الحروف المتاحة. */
export function generateQuestions(settings, rng) {
  const cats = enabledCategories(settings);
  if (!cats.length) throw new GameError('NO_CATEGORIES');
  const letters = settings.letters;
  const total = settings.questionCount + 1;   // + السؤال النهائي
  const used = new Set();                      // "catId|letter"
  const out = [];
  let order = [];
  let prevLetter = null;
  for (let i = 0; i < total; i++) {
    if (!order.length) {
      order = shuffle(cats, rng);
      // ما نبدأش دورة جديدة بنفس تصنيف آخر سؤال
      if (out.length && order.length > 1 && order[0].id === out[out.length - 1].categoryId) order.push(order.shift());
    }
    const cat = order.shift();
    let pool = letters.filter((l) => !used.has(`${cat.id}|${l}`));
    if (!pool.length) { // خلصت التركيبات لهذا التصنيف: نسمح بالتكرار كحل أخير
      pool = letters.slice();
    }
    const noRepeatLetter = pool.filter((l) => l !== prevLetter);
    const letter = pickOne(noRepeatLetter.length ? noRepeatLetter : pool, rng);
    used.add(`${cat.id}|${letter}`);
    prevLetter = letter;
    const kind = i === total - 1 ? 'final' : 'normal';
    out.push(emptyQuestion(i + 1, kind, cat, letter));
  }
  return out;
}

/** حرف بديل لسؤال لسه ما بدأش (إعادة سحب عشوائي): مختلف عن الحالي ومش مستخدم مع نفس التصنيف قدر الإمكان. */
export function rerollLetter(settings, questions, index, rng) {
  const q = questions[index];
  const usedHere = new Set(questions.filter((x, i) => i !== index && x.categoryId === q.categoryId).map((x) => x.letter));
  let pool = settings.letters.filter((l) => l !== q.letter && !usedHere.has(l));
  if (!pool.length) pool = settings.letters.filter((l) => l !== q.letter);
  if (!pool.length) return q.letter;
  return pickOne(pool, rng);
}

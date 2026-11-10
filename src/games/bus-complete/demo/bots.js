// بوتات للتجربة فقط: بتلعب مكان لاعبين تانيين (تختار نقاط، تكتب إجابة، تراهن، وتوافق على الأدمن لو حبيت).
import { LEXICON_DISPLAY } from '../data/lexicon/index.js';

const pick = (a) => a[Math.floor(Math.random() * a.length)];

function wordFor(categoryId, letter, wrongChance) {
  if (Math.random() < wrongChance) return pick(['قمقم', 'سبسب', 'بتبت', 'جزجز']);
  const map = LEXICON_DISPLAY[categoryId];
  const L = letter === 'ا' ? ['ا', 'أ'] : [letter];
  if (!map) return 'كلمة';
  const words = [...map.values()].filter((w) => L.includes(w[0]) || (w[0] === 'أ' && letter === 'ا'));
  return words.length ? pick(words) : 'كلمة';
}

export function runBot(adapter, { wrongChance = 0.15 } = {}) {
  const v = adapter.getView();
  if (!v || !v.me) return;
  if (v.phase === 'question' && v.question && v.question.mine && !v.question.mine.submitted) {
    const q = v.question;
    if (q.kind === 'normal') {
      const useCard = v.me.card.state === 'available' && Math.random() < 0.08;
      adapter.submitAnswer(wordFor(q.categoryId, q.letter, wrongChance), { points: q.mine.points ?? pick(v.me.available), double: useCard });
      return;
    }
    adapter.submitAnswer(wordFor(q.categoryId, q.letter, wrongChance));
  } else if (v.phase === 'wager' && v.wager && v.wager.mine == null) {
    adapter.lockWager(pick(v.wager.options));
  }
}

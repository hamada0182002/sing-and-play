// فهرس القواميس: يبني Map لكل تصنيف أصلي → مجموعة مفاتيح مُطبَّعة (للخادم/المحرك فقط).
import { BOY, GIRL } from './people.js';
import { ANIMAL, PLANT } from './nature.js';
import { OBJECT, COUNTRY } from './things.js';
import { FOOD, JOB } from './food-jobs.js';
import { answerKey } from '../../utils/arabic.js';

const RAW = { boy: BOY, girl: GIRL, animal: ANIMAL, plant: PLANT, object: OBJECT, country: COUNTRY, food: FOOD, job: JOB };

function build(raw) {
  const words = new Map(); // مفتاح مُطبَّع → الشكل الأصلي للعرض (للاقتراحات)
  for (const w of raw.split(/\s+/)) {
    if (!w) continue;
    const display = w.replace(/_/g, ' ');
    const k = answerKey(display);
    if (k.length >= 2 && !words.has(k)) words.set(k, display);
  }
  return words;
}

const DISPLAY = Object.fromEntries(Object.entries(RAW).map(([id, raw]) => [id, build(raw)]));

/** { [categoryId]: Set<مفتاح مُطبَّع> } */
export const LEXICON = Object.fromEntries(Object.entries(DISPLAY).map(([id, m]) => [id, new Set(m.keys())]));

/** { [categoryId]: Map<مفتاح مُطبَّع, شكل العرض> } */
export const LEXICON_DISPLAY = DISPLAY;

/** { [categoryId]: { [حرف]: string[] } } للبحث التقريبي (نفس الحرف الأول فقط → أسرع وأدق). */
export const LEXICON_BY_LETTER = Object.fromEntries(Object.entries(LEXICON).map(([id, set]) => {
  const byLetter = {};
  for (const w of set) (byLetter[w[0]] ||= []).push(w);
  return [id, byLetter];
}));

export function lexiconStats() {
  return Object.fromEntries(Object.entries(LEXICON).map(([id, s]) => [id, s.size]));
}

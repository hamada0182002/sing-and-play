// قاعدة الشخصيات (بيانات تجريبية).
// ⚠️ في الدمج الحقيقي: هذا الملف يبقى على الخادم فقط (جدول/Edge Function) ولا يُرسل للعميل.
// difficulty: 1 سهل · 2 متوسط · 3 صعب
import { CATEGORIES } from './categories.js';
export { CATEGORIES };

const c = (id, name, category, difficulty) => ({ id, name, category, difficulty });

export const CHARACTERS = [
  c('f1', 'محمد صلاح', 'football', 1), c('f2', 'ليونيل ميسي', 'football', 1),
  c('f3', 'كريستيانو رونالدو', 'football', 1), c('f4', 'محمد أبو تريكة', 'football', 2),
  c('f5', 'نيمار', 'football', 1), c('f6', 'زين الدين زيدان', 'football', 2),
  c('f7', 'مارادونا', 'football', 2), c('f8', 'بيليه', 'football', 2),
  c('f9', 'كيليان مبابي', 'football', 1), c('f10', 'أحمد حسن (كوكا)', 'football', 3),

  c('m1', 'عمرو دياب', 'music', 1), c('m2', 'أم كلثوم', 'music', 1),
  c('m3', 'عبد الحليم حافظ', 'music', 2), c('m4', 'فيروز', 'music', 2),
  c('m5', 'محمد منير', 'music', 2), c('m6', 'شيرين عبد الوهاب', 'music', 1),
  c('m7', 'تامر حسني', 'music', 1), c('m8', 'محمد عبده', 'music', 2),
  c('m9', 'كاظم الساهر', 'music', 2), c('m10', 'مايكل جاكسون', 'music', 1),

  c('s1', 'عادل إمام', 'screen', 1), c('s2', 'أحمد زكي', 'screen', 2),
  c('s3', 'محمد هنيدي', 'screen', 1), c('s4', 'فاتن حمامة', 'screen', 2),
  c('s5', 'أحمد حلمي', 'screen', 1), c('s6', 'نور الشريف', 'screen', 3),
  c('s7', 'ياسمين عبد العزيز', 'screen', 1), c('s8', 'يحيى الفخراني', 'screen', 3),
  c('s9', 'توم هانكس', 'screen', 2), c('s10', 'شارلي شابلن', 'screen', 2),

  c('c1', 'سبونج بوب', 'cartoon', 1), c('c2', 'توم', 'cartoon', 1),
  c('c3', 'جيري', 'cartoon', 1), c('c4', 'بطوط', 'cartoon', 1),
  c('c5', 'ميكي ماوس', 'cartoon', 1), c('c6', 'ناروتو', 'cartoon', 2),
  c('c7', 'سالي', 'cartoon', 2), c('c8', 'عدنان ولينا', 'cartoon', 3),
  c('c9', 'بوكيمون: بيكاتشو', 'cartoon', 1), c('c10', 'شنكول', 'cartoon', 3),

  c('h1', 'نابليون بونابرت', 'history', 2), c('h2', 'كليوباترا', 'history', 1),
  c('h3', 'أينشتاين', 'history', 1), c('h4', 'صلاح الدين الأيوبي', 'history', 2),
  c('h5', 'توت عنخ آمون', 'history', 1), c('h6', 'نيلسون مانديلا', 'history', 2),
  c('h7', 'ليوناردو دا فينشي', 'history', 2), c('h8', 'جمال عبد الناصر', 'history', 2),
  c('h9', 'مصطفى كامل', 'history', 3), c('h10', 'نيوتن', 'history', 2),

  c('x1', 'سوبرمان', 'fiction', 1), c('x2', 'باتمان', 'fiction', 1),
  c('x3', 'سبايدرمان', 'fiction', 1), c('x4', 'هاري بوتر', 'fiction', 1),
  c('x5', 'شرلوك هولمز', 'fiction', 2), c('x6', 'علاء الدين', 'fiction', 2),
  c('x7', 'السندباد', 'fiction', 2), c('x8', 'الكونت دي مونت كريستو', 'fiction', 3),
  c('x9', 'جاك سبارو', 'fiction', 2), c('x10', 'شهريار', 'fiction', 3),
];

export const CHARACTER_BY_ID = Object.fromEntries(CHARACTERS.map((x) => [x.id, x]));

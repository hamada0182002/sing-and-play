// @ts-nocheck
// ⚠️ ملف مولَّد تلقائيًا — لا تعدّله يدويًا. المصدر: server/ و game-engine/ و data/ ...  البناء: node scripts/build-edge-function.mjs

// server/deno-entry.js
import { createClient } from "npm:@supabase/supabase-js@2";

// server/supabase-db.js
var GAME_ID = "bus_complete";
function makeSupabaseDb(sb2) {
  const must = ({ data, error }) => {
    if (error) throw error;
    return data;
  };
  const stamp = () => (/* @__PURE__ */ new Date()).toISOString();
  return {
    GAME_ID,
    /** الغرفة + أعضاؤها + نقاط المنصة الحالية. */
    async getRoom(roomId) {
      const room = must(await sb2.from("rooms").select("id, code, admin_id, status, active_game, selected_game").eq("id", roomId).maybeSingle());
      if (!room) return null;
      const rows = must(await sb2.from("room_players").select("user_id, joined_at, profiles(display_name)").eq("room_id", roomId).order("joined_at"));
      const members = rows.map((r) => {
        const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
        return { id: r.user_id, name: p && p.display_name || "لاعب" };
      });
      let existingScores = {};
      if (members.length) {
        const t = must(await sb2.from("profiles").select("id, total_points").in("id", members.map((m) => m.id)));
        existingScores = Object.fromEntries(t.map((x) => [x.id, x.total_points || 0]));
      }
      return { id: room.id, code: room.code, adminId: room.admin_id, status: room.status, activeGame: room.active_game, selectedGame: room.selected_game, members, existingScores };
    },
    async loadGame(roomId) {
      const r = must(await sb2.from("bus_complete_games").select("state, version").eq("room_id", roomId).maybeSingle());
      return r ? { state: r.state, version: r.version } : null;
    },
    /** كتابة بشرط النسخة (compare-and-swap). expected=null يعني «لسه مفيش لعبة». */
    async saveGame(roomId, state, expected) {
      if (expected === null || expected === void 0) {
        const { error } = await sb2.from("bus_complete_games").insert({ room_id: roomId, state, version: 1, updated_at: stamp() });
        if (error) {
          if (error.code === "23505") return { ok: false, version: null };
          throw error;
        }
        await this.setSignal(roomId, 1);
        return { ok: true, version: 1 };
      }
      const rows = must(await sb2.from("bus_complete_games").update({ state, version: expected + 1, updated_at: stamp() }).eq("room_id", roomId).eq("version", expected).select("version"));
      if (!rows || !rows.length) return { ok: false, version: null };
      await this.setSignal(roomId, rows[0].version);
      return { ok: true, version: rows[0].version };
    },
    /** إشارة بس (رقم نسخة من غير أي إجابات): لما تتغيّر كل لاعب يطلب نسخته الآمنة من الخادم. */
    async setSignal(roomId, version) {
      must(await sb2.from("bus_complete_signal").upsert({ room_id: roomId, version, updated_at: stamp() }, { onConflict: "room_id" }));
    },
    /** منح نقاط المنصة مرة واحدة (السجل العام game_point_awards بيمنع التكرار). key = bus-complete:<room>:<round> */
    async award(playerId, key, points) {
      const roomId = key.split(":")[1] || null;
      must(await sb2.rpc("award_game_points", { p_game: GAME_ID, p_key: key, p_room: roomId, p_user: playerId, p_points: points }));
    },
    async activate(roomId, userId) {
      const { error } = await sb2.rpc("bc_activate", { p_room: roomId, p_user: userId });
      if (error) throw new Error(error.message);
    },
    async returnToRoom(roomId, userId) {
      const { error } = await sb2.rpc("bc_return_to_room", { p_room: roomId, p_user: userId });
      if (error) throw new Error(error.message);
    }
  };
}

// game-engine/errors.js
var MESSAGES = {
  NOT_ADMIN: "الأدمن فقط يقدر يعمل ده",
  NOT_IN_ROOM: "انت مش موجود في الغرفة دي",
  BAD_PHASE: "مش وقت ده دلوقتي",
  TOO_FEW: "لازم 3 لاعبين على الأقل",
  TOO_MANY: "الحد الأقصى 10 لاعبين",
  BAD_SETTINGS: "إعدادات الجولة غير صحيحة",
  BAD_CATEGORY: "التصنيف غير صحيح",
  NO_CATEGORIES: "لازم تصنيف واحد على الأقل شغّال",
  TIME_UP: "الوقت خلص",
  POINTS_FIRST: "اختار قيمة النقاط الأول",
  BAD_POINTS: "قيمة النقاط غير صحيحة",
  NUMBER_USED: "الرقم ده استخدمته قبل كده",
  POINTS_LOCKED: "النقاط اتثبّتت ومينفعش تتغيّر",
  CARD_USED: "كارت المضاعفة اتستخدم قبل كده",
  NO_CARD_IN_FINAL: "كارت المضاعفة مش شغّال في السؤال النهائي",
  ALREADY_SUBMITTED: "إجابتك اتبعتت قبل كده",
  EMPTY_ANSWER: "اكتب إجابتك الأول",
  ANSWER_TOO_LONG: "الإجابة طويلة جدًا",
  BAD_WAGER: "قيمة الرهان غير صحيحة",
  WAGER_LOCKED: "الرهان اتأكّد ومينفعش يتغيّر",
  UNRESOLVED: "لسه فيه إجابات محتاجة مراجعة",
  NO_SUCH_ANSWER: "مفيش إجابة للاعب ده في السؤال ده",
  NO_SUCH_QUESTION: "السؤال مش موجود",
  BAD_LETTER: "الحرف غير صحيح",
  LEFT_ROOM: "انت خرجت من الجولة دي",
  NO_NEXT: "مفيش سؤال جاي نعدّله دلوقتي"
};
var GameError = class extends Error {
  constructor(code, message) {
    super(message || MESSAGES[code] || code);
    this.code = code;
  }
};
function need(cond, code, msg) {
  if (!cond) throw new GameError(code, msg);
}

// game-engine/rng.js
function pickOne(list, rng) {
  return list[Math.floor(rng() * list.length)];
}
function shuffle(list, rng) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// data/categories.js
var DEFAULT_CATEGORIES = [
  { id: "boy", name: "ولد", enabled: true, builtin: true },
  { id: "girl", name: "بنت", enabled: true, builtin: true },
  { id: "animal", name: "حيوان", enabled: true, builtin: true },
  { id: "plant", name: "نبات", enabled: true, builtin: true },
  { id: "object", name: "جماد", enabled: true, builtin: true },
  { id: "country", name: "بلاد", enabled: true, builtin: true },
  { id: "food", name: "أكلة", enabled: true, builtin: true },
  { id: "job", name: "مهنة", enabled: true, builtin: true }
];
var MAX_CATEGORIES = 30;
var MAX_CATEGORY_NAME = 24;

// data/letters.js
var ARABIC_LETTERS = [
  "ا",
  "ب",
  "ت",
  "ث",
  "ج",
  "ح",
  "خ",
  "د",
  "ذ",
  "ر",
  "ز",
  "س",
  "ش",
  "ص",
  "ض",
  "ط",
  "ظ",
  "ع",
  "غ",
  "ف",
  "ق",
  "ك",
  "ل",
  "م",
  "ن",
  "ه",
  "و",
  "ي"
];
var HARD_LETTERS = ["ث", "ذ", "ز", "ض", "ظ", "غ"];
var DEFAULT_LETTERS = ARABIC_LETTERS.filter((l) => !HARD_LETTERS.includes(l));
function isValidLetter(l) {
  return ARABIC_LETTERS.includes(l);
}

// utils/arabic.js
var TASHKEEL = /[ً-ٰٟۖ-ۭ]/g;
var TATWEEL = /ـ/g;
var INVISIBLE = /[​-‏‪-‮⁦-⁩﻿­]/g;
var NOT_ARABIC_LETTER = /[^ء-يٱٮٯکڪی\s]/g;
function cleanText(input) {
  return String(input ?? "").normalize("NFC").replace(INVISIBLE, "").replace(TASHKEEL, "").replace(TATWEEL, "").replace(/\s+/g, " ").trim();
}
function foldLetter(ch) {
  switch (ch) {
    case "أ":
    case "إ":
    case "آ":
    case "ٱ":
      return "ا";
    case "ى":
    case "ئ":
      return "ي";
    case "ؤ":
      return "و";
    case "ة":
      return "ه";
    case "ک":
      return "ك";
    case "ی":
      return "ي";
    default:
      return ch;
  }
}
function normalizeSpaced(input) {
  let s = cleanText(input).replace(NOT_ARABIC_LETTER, " ").replace(/\s+/g, " ").trim();
  return [...s].map(foldLetter).join("");
}
function normalize(input) {
  return normalizeSpaced(input).replace(/\s+/g, "");
}
function stripArticle(normalized) {
  if (normalized.startsWith("ال") && normalized.length - 2 >= 2) return normalized.slice(2);
  return normalized;
}
function answerKey(input) {
  return stripArticle(normalize(input));
}
function startsWithLetter(input, letter) {
  const target = foldLetter(letter);
  const n = normalize(input);
  if (!n) return false;
  if (n[0] === target) return true;
  const s = stripArticle(n);
  return s !== n && s[0] === target;
}
function hasForeignChars(input) {
  const t = cleanText(input).replace(/\s+/g, "");
  const stripped = t.replace(/[ء-يٱٮٯکڪی]/g, "");
  return stripped.length > 0;
}
function editDistance(a, b, max = 2) {
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

// game-engine/settings.js
var OPTIONS = {
  questionCount: [10, 15, 20],
  questionSeconds: [15, 20, 30, 40],
  finalSeconds: [20, 30, 45, 60],
  wagerSeconds: [10, 20, 30],
  resultsSeconds: [0, 8, 12, 20],
  duplicatePolicy: ["review", "void", "first", "share"],
  wagerOptions: [0, 10, 20]
};
var DEFAULT_SETTINGS = {
  questionCount: 10,
  questionSeconds: 30,
  finalSeconds: 30,
  wagerSeconds: 20,
  resultsSeconds: 8,
  // 0 = يدوي (الأدمن يضغط «السؤال التالي»)
  confirmSeconds: 6,
  duplicatePolicy: "review",
  autoApprove: false,
  // لو مفيش أي إجابة محتاجة مراجعة يعتمد السؤال تلقائيًا
  wagerOptions: OPTIONS.wagerOptions,
  minPlayers: 3,
  maxPlayers: 10,
  maxAnswerLength: 40,
  letters: DEFAULT_LETTERS,
  categories: DEFAULT_CATEGORIES
};
function defaultSettings(overrides = {}) {
  const s = structuredClone({ ...DEFAULT_SETTINGS, ...overrides });
  return s;
}
var SCALAR_KEYS = ["questionCount", "questionSeconds", "finalSeconds", "wagerSeconds", "resultsSeconds", "duplicatePolicy", "autoApprove"];
function applySettingsPatch(settings, patch) {
  const next = structuredClone(settings);
  need(patch && typeof patch === "object", "BAD_SETTINGS");
  for (const [k, v] of Object.entries(patch)) {
    if (k === "autoApprove") {
      need(typeof v === "boolean", "BAD_SETTINGS");
      next.autoApprove = v;
      continue;
    }
    if (k === "letters") {
      need(Array.isArray(v) && v.every(isValidLetter), "BAD_LETTER");
      const uniq = [...new Set(v)];
      need(uniq.length >= 6, "BAD_SETTINGS", "اختار 6 حروف على الأقل");
      next.letters = uniq;
      continue;
    }
    need(SCALAR_KEYS.includes(k), "BAD_SETTINGS", `إعداد غير معروف: ${k}`);
    need(OPTIONS[k].includes(v), "BAD_SETTINGS", `قيمة غير مسموحة لـ ${k}`);
    next[k] = v;
  }
  return next;
}
function enabledCategories(settings) {
  return settings.categories.filter((c) => c.enabled);
}
function cleanName(name) {
  const n = cleanText(name);
  need(n.length >= 2 && n.length <= MAX_CATEGORY_NAME, "BAD_CATEGORY", `اسم التصنيف من 2 لـ ${MAX_CATEGORY_NAME} حرف`);
  need(!/[<>]/.test(n), "BAD_CATEGORY");
  return n;
}
function assertUniqueName(categories, name, exceptId) {
  const key = normalize(name);
  need(!categories.some((c) => c.id !== exceptId && normalize(c.name) === key), "BAD_CATEGORY", "التصنيف ده موجود بالفعل");
}
function addCategory(settings, seq, { name }) {
  const next = structuredClone(settings);
  need(next.categories.length < MAX_CATEGORIES, "BAD_CATEGORY", "وصلت للحد الأقصى من التصنيفات");
  const clean = cleanName(name);
  assertUniqueName(next.categories, clean);
  next.categories.push({ id: `c${seq}`, name: clean, enabled: true, builtin: false });
  return next;
}
function updateCategory(settings, { id, name, enabled }) {
  const next = structuredClone(settings);
  const c = next.categories.find((x) => x.id === id);
  need(c, "BAD_CATEGORY");
  if (name !== void 0) {
    const clean = cleanName(name);
    assertUniqueName(next.categories, clean, id);
    c.name = clean;
  }
  if (enabled !== void 0) {
    need(typeof enabled === "boolean", "BAD_CATEGORY");
    c.enabled = enabled;
  }
  need(enabledCategories(next).length >= 1, "NO_CATEGORIES");
  return next;
}
function removeCategory(settings, { id }) {
  const next = structuredClone(settings);
  need(next.categories.some((x) => x.id === id), "BAD_CATEGORY");
  next.categories = next.categories.filter((x) => x.id !== id);
  need(enabledCategories(next).length >= 1, "NO_CATEGORIES");
  return next;
}
function resetCategories(settings) {
  const next = structuredClone(settings);
  next.categories = structuredClone(DEFAULT_CATEGORIES);
  return next;
}

// game-engine/questions.js
function emptyQuestion(no, kind, cat, letter) {
  return {
    no,
    kind,
    categoryId: cat.id,
    category: cat.name,
    letter,
    startedAt: null,
    endsAt: null,
    closedAt: null,
    closeReason: null,
    picks: {},
    doubled: {},
    answers: {},
    grades: {},
    approved: false,
    approvedAt: null
  };
}
function generateQuestions(settings, rng) {
  const cats = enabledCategories(settings);
  if (!cats.length) throw new GameError("NO_CATEGORIES");
  const letters = settings.letters;
  const total = settings.questionCount + 1;
  const used = /* @__PURE__ */ new Set();
  const out = [];
  let order = [];
  let prevLetter = null;
  for (let i = 0; i < total; i++) {
    if (!order.length) {
      order = shuffle(cats, rng);
      if (out.length && order.length > 1 && order[0].id === out[out.length - 1].categoryId) order.push(order.shift());
    }
    const cat = order.shift();
    let pool = letters.filter((l) => !used.has(`${cat.id}|${l}`));
    if (!pool.length) {
      pool = letters.slice();
    }
    const noRepeatLetter = pool.filter((l) => l !== prevLetter);
    const letter = pickOne(noRepeatLetter.length ? noRepeatLetter : pool, rng);
    used.add(`${cat.id}|${letter}`);
    prevLetter = letter;
    const kind = i === total - 1 ? "final" : "normal";
    out.push(emptyQuestion(i + 1, kind, cat, letter));
  }
  return out;
}
function rerollLetter(settings, questions, index, rng) {
  const q = questions[index];
  const usedHere = new Set(questions.filter((x, i) => i !== index && x.categoryId === q.categoryId).map((x) => x.letter));
  let pool = settings.letters.filter((l) => l !== q.letter && !usedHere.has(l));
  if (!pool.length) pool = settings.letters.filter((l) => l !== q.letter);
  if (!pool.length) return q.letter;
  return pickOne(pool, rng);
}

// data/lexicon/people.js
var BOY = `
أحمد أمير أسامة أيمن أنس أدهم أشرف أكرم أيهم إبراهيم إسماعيل إسلام إياد أسعد أمين آدم أنور أيوب أبانوب إدريس أحمد_علي أمجد أسد أدم أيسر أبو_بكر
باسم بشير بلال بدر برهان بسام بكر باسل بهاء بيشوي بهجت بيتر باهر بسيوني بدوي
تامر تيم توفيق تميم تقي توني تركي تاج
ثامر ثابت ثروت
جمال جميل جابر جاسم جلال جهاد جورج جاد جواد جمعة جلال جيمي جاسر
حسن حسين حمزة حمادة حازم حسام حامد حاتم حبيب حيدر حمدي حذيفة حنا حسني حسان حماده حسنين حنفي
خالد خليل خضر خميس خليفة خيري خطاب
داود دياب درويش دانيال دلير دانى
ذياب ذكي ذو_الفقار
رامي رائد رضا رمضان رياض ربيع رأفت رشاد راشد رفيق رشدي رؤوف رزق رامز رحيم ريان رايق راغب رفعت رجب
زياد زين زكريا زكي زيدان زاهر زهير زيد زين_العابدين
سامي سعيد سلمان سليمان سيف سمير سالم سعد سلطان سراج سامح سيد سلامة سعيد سفيان سهيل
شريف شادي شهاب شعبان شاكر شوقي شاهين شكري شريف شاذلي
صلاح صالح صابر صبري صفوان صدقي صقر
ضياء ضرغام ضاحي
طارق طلال طه طلعت طاهر طلعت
ظافر ظاهر
علي عمر عمرو عثمان عادل عماد عصام عبدالله عبدالرحمن عبدالعزيز عبدالكريم عزت عاطف عامر عدنان عيسى عوض عمار عطية عصمت عنتر عبدالرحيم عبدالحميد عبدالفتاح عبدالرازق عبده عبد_الله عبد_الرحمن عاصم عيد عباس عوني
غسان غانم غالب غازي
فادي فارس فهد فيصل فريد فؤاد فتحي فاروق فراس فاضل فكري فوزي فيكتور فرج
قاسم قيس قصي قدري قطب
كريم كمال كامل كارم كرم كيرلس كمال كيفن كنان
لؤي ليث لبيب لطفي لقمان لاشين
محمد محمود مصطفى مجدي ماجد مروان معاذ مازن مالك منير منصور موسى مراد ممدوح مختار مهند ميخائيل مينا مؤمن ماهر مجاهد مدحت مرتضى مسعود مصعب معتز مهدي مبارك محسن متولي مؤنس ماركو
نبيل ناصر نادر نور نايف نعمان نبيه نجيب نجم نزار ناجي نصر نشأت نعيم نادي نوح نسيم
هاني هشام هيثم هادي هلال هارون هيكل همام هاشم هيمن هداية
وليد وائل وسام وسيم وحيد وجدي وهبي وجيه ورد ولاء_الدين
يوسف يحيى ياسر ياسين يزيد يعقوب يونس يمان يامن يعرب يوحنا يحي يسري
`;
var GIRL = `
أمل آية أسماء إيمان إسراء أميرة أروى ألاء أماني أمينة إيناس انتصار أسيل إلهام أنوار أحلام آلاء أريج أفنان أبرار أسيل أجفان
بسمة بسنت بتول بشرى بدور بيان بهية بارعة بثينة بسيمة بوسي بيسان بلقيس
تغريد تهاني تسنيم تقى تحية ترف تالا تمارا تيماء
ثريا ثناء ثروة
جميلة جنى جيهان جودي جهاد جوري جنة جمانة جيلان جنا جميله جيسيكا جاسمين
حنان حبيبة حياة حنين حلا حسناء حليمة حور حسنية حصة حميدة
خديجة خلود خولة خيرية خزامى
دعاء دنيا داليا دينا دلال ديما دانة دارين دلع
ذكرى
رنا رانيا ريم ريما رحمة رحاب رزان رغد ربى رشا رقية رهف رباب رضوى ريهام روان رنيم رولا رحمه ريماس رودينا ريتاج
زينب زهرة زينة زكية زهور زبيدة زهرا
سارة سلمى سمر سعاد سناء سميرة سلوى سهى سحر سماح سهير سمية ساجدة سيلين سالي سلسبيل سندس سجى
شيماء شهد شيرين شروق شذى شهرزاد شادية شهيرة شريفة
صفاء صباح صفية صابرين صوفيا
ضحى ضياء
طيبة طرب
عائشة عبير علا عالية عزة عفاف عهد عبلة عايدة عبير علياء عفراء
غادة غدير غيداء غالية
فاطمة فرح فدوى فيروز فاتن فريدة فجر فيفي فوزية
قمر قمرة
كريمة كوثر كاميليا كارمن كاريمان كوكب
ليلى لمى لينا لبنى لجين ليان لولوة لمياء ليلى لارا لانا
مريم منى مها ميار مروة منال ميرنا مي ملك ميادة مديحة مرام ميرفت ماجدة مشيرة ماريا مارتينا
نور نادية نجلاء نهى نوال نسمة نعمة نرمين نيرة ندى نجوى نورا نهلة نوران نانسي نسرين
هدى هالة هبة هناء هند هاجر هيفاء هيام هديل هنادي
وفاء ورد وردة وعد ولاء وسام وجدان وئام وداد وسن
ياسمين يسرا يارا يمنى ياسمينة
`;

// data/lexicon/nature.js
var ANIMAL = `
أسد أرنب أفعى أخطبوط أيل أبقار أبو_الحناء أسماك أرنب_بري ألباكا أناكوندا أبو_منجل أبو_بريص
بقرة بطة بطريق ببغاء بومة بجعة بعير بغل بلبل بط بيسون بعوضة برغوث بق بجع بقر بيغاء  
تمساح تيس تنين تفاح_البحر ترسة تونة تمساح_نيل
ثعلب ثعبان ثور ثعالب
جمل جاموس جدي جراد جرذ جندب جرادة جمبري جوال جحش
حمار حصان حوت حمامة حية حلزون حرباء حشرة حمل حدأة حمار_وحشي حبار حجل حنش حوت_أزرق
خروف خنزير خفاش خنفساء خرتيت خيل خروف خلد
دجاجة دب ديك دلفين دودة دبور دجاج دب_قطبي دعسوقة دراج دب_باندا
ذئب ذبابة ذباب
رخ رنة رنة_الغزال
زرافة زرزور زنبور زاحف
سمكة سلحفاة سنجاب سرطان سلطعون سحلية سنونو سلمون سمك سمندر   سعدان
شمبانزي شاهين
صقر صرصار صرصور صدفة
ضفدع ضبع ضب  
طاووس طائر طير طيطوي
عصفور عقرب عنكبوت عجل عقاب عنزة عندليب عجلة عث عظاءة
غزال غراب غوريلا غرير غنم
فيل فأر فرس فهد فراشة فقمة فرخ فار فراشة
قطة قرد قنفذ قرش قنديل قط قملة قرد_الغوريلا قنفد
كلب كنغر كركدن كناري كوبرا كوالا كركند كلب_البحر
لبؤة ليث لقلق
ماعز ماموث ماموث مها
نمر نمل نحلة نسر نعامة نورس نمس نمرة
هرة هدهد هامستر هر هيدرا
وزة وحش ورل وعل وشق وبر
يمامة يعسوب يربوع
`;
var PLANT = `
أرز أناناس أفوكادو أذن_الفأر   أقحوان   أمارانتس أرقطيون أناناس
برتقال بطيخ بصل بطاطس بامية بازلاء بنجر بنفسج برقوق بقدونس بابونج بن بطاطا بروكلي باذنجان بلوط بامبو برسيم بلح بندق
تفاح تين توت تمر ترمس توت_أرضي تبغ ترنج
ثوم    
جزر جوافة جرجير جوز جميز جاردينيا جلاديولس
حمص حنطة حبق حلبة حبهان حنظل حور حشيش حميض
خيار خس خوخ خروب خبيزة خزامى خردل خرشوف
دراق دخن دفلة دوار_الشمس درة
ذرة
ريحان رمان رز روزماري رجلة رشاد
زيتون زنبق زعتر زهرة زنجبيل زعفران زيزفون
سبانخ سمسم سنديان سرو سدر سمر سوسن سرخس سلق
شمام شعير شمر شاي شوك شيح  
صبار صنوبر صفصاف صمغ
طماطم طحلب طرفاء طلح
عنب عدس عوسج عليق عرعر عشب عباد_الشمس
فول فراولة فجل فلفل فستق فلفل_أخضر فاصوليا فريز
قمح قرنفل قرع قصب قرنبيط قطن قراص
كمثرى كرز كرفس كوسة كرنب كستناء كزبرة كركم كاكاو كيوي كاكتس
ليمون لوز لفت لبلاب لوتس لافندر
موز مشمش ملوخية ميرمية مانجو مندلينا مريمية مرجان
نخيل نعناع نرجس نبق نيلة
هليون هندباء هيل
ورد وردة ورق_عنب
ياسمين يقطين يانسون يوسفي
`;

// data/lexicon/things.js
var OBJECT = `
أريكة أرض إبريق إطار أنبوب أسطوانة أرجوحة آلة_حاسبة أقلام أوراق أكياس أدوات أسلاك إسفنجة أجهزة
باب بيت بنطلون بطانية برج بحيرة بطارية بالون بوصلة بلاطة بكرة بروجكتر بيانو بنك براد بابور بدلة بوابة
تلفاز تليفون تليفزيون تاج ترابيزة تلسكوب تابلت تذكرة تمثال تفاحة_ورق تخت ترمومتر تيشيرت
ثلاجة ثوب ثريا  
جرس جدار جريدة جاكيت جورب جبل جسر جهاز جوال جيتار جرة جدول جزمة
حقيبة حذاء حائط حاسوب حبل حديد حجر حاسب حمام حوض حلقة حزام حبر حلة
خزانة خاتم خيمة خشب خرزة خريطة خيط خلاط خنجر
دولاب دفتر دراجة دبوس دلو دش دباسة دفاية درج دمية دوحة دينار
ذهب ذراع
راديو رف رمل ريشة رمح ركيزة رصاصة رخام
زجاجة زر زجاج زهرية زورق زلاجة زيت
سيارة ساعة سرير سكين سجادة سماعة سلة سقف سلم ستارة سبورة سيف سور سفينة سلك سكة سماعات
شباك شمعة شنطة شاشة شوكة شمسية شاحن شفرة شريط شارع شبشب شال
صحن صندوق صابون صورة صنبور صاروخ صفارة صخرة صينية
ضوء ضفيرة
طاولة طبق طائرة طوب طابعة طبل طرد طفاية طقم طوق
عجلة علبة عمود عصا عطر عدسة عملة علم عقد عربية عود عمارة
غسالة غطاء غرفة غواصة غلاية غراء
فنجان فرشاة فستان فرن فانوس فأس فلاش فيديو فلوس فاكس فرامل فراش
قلم قميص قفل قبعة قدر قارب قطار قنبلة قمر قفاز قلادة قاموس قاعة قصر قنينة
كرسي كتاب كوب كمبيوتر كاميرا كيس كاس كرة كبري كابل كيبورد كمان كنبة كشاف كوبري كراسة
لمبة لوح لوحة لعبة لحاف لابتوب لاصق ليف
مفتاح مكتب مروحة مرآة مقص مسطرة مظلة مطرقة مصباح ملعقة مسمار مكنسة موبايل ماوس مايك مجرفة مغناطيس ميزان مدفأة ملف مدفع منشار مقعد مزمار مسجل مخدة
نافذة نظارة نجمة ناي نقود نول نظارات ناقوس
هاتف هرم هدية هاون
وسادة ورقة وعاء وشاح وتد
يخت يد_الباب يافطة
`;
var COUNTRY = `
أمريكا ألمانيا أسبانيا إسبانيا إيطاليا إيران إندونيسيا أستراليا الأردن الإمارات أفغانستان الأرجنتين الإسكندرية أسوان أبوظبي أنقرة أثينا أمستردام الأقصر إسطنبول أوكرانيا أذربيجان أرمينيا إثيوبيا إريتريا إيرلندا أنجولا أوغندا ألبانيا أسيوط أيسلندا أوزبكستان إدفو أوتاوا أبها         أريزونا أوهايو أوساكا
بريطانيا البرازيل بلجيكا بولندا البحرين بيروت بغداد برلين باريس بكين بنغلاديش بلغاريا بنما بيرو بوليفيا بورسعيد بنها بنغازي بوركينا_فاسو بروكسل برشلونة بوتان بروناي بنين بوتسوانا بودابست بورتو بغداد   بيت_لحم بورسودان بنجلاديش بنغالور باكستان بيلاروسيا بلغراد بوخارست بيلاروس
تونس تركيا تايلاند تنزانيا تشاد تبوك تعز تشيلي تل_أبيب توجو تايوان تركمانستان تونجا طنطا تورنتو تكساس تبريز تمبكتو
جزائر الجزائر جيبوتي جدة جنيف جورجيا جامايكا جنوب_أفريقيا جزر_القمر جاكرتا جنوب_السودان جزر_المالديف جرش جيزان جوهانسبرغ
حلب حمص حيفا الحسكة حلوان حماة حائل حضرموت حيدر_آباد هانوي حلب
خرطوم الخرطوم خان_يونس الخليل خميس_مشيط الخبر
دمشق دبي الدوحة دمياط الدنمارك دبلن دلهي دمنهور دكا دوما دير_الزور دالاس درعا
رومانيا روسيا رواندا الرياض رام_الله روما رأس_الخيمة ريو رأس_غارب رشيد رفح رودس ريجا رانغون
زامبيا زيمبابوي زحلة الزقازيق زيورخ زنجبار
السعودية سوريا السودان السنغال سويسرا السويد سنغافورة سلطنة_عمان سيول سوهاج سلوفاكيا سيناء سوسة سيدني سان_فرانسيسكو سلوفينيا سريلانكا سيراليون سوازيلاند سانت_لوسيا سلا سطيف سمرقند سيئول ستوكهولم سيواس السويس سخا سمنود سان_دييغو سياتل
شرم_الشيخ الشارقة شنغهاي شيكاغو شبرا شبين_الكوم شيراز شنغن  
الصين الصومال صنعاء صفاقس صيدا صور صلالة صوفيا صعيد  
طرابلس طهران طوكيو طنطا طرطوس طبرق طشقند طرابزون   طابا طولكرم طوخ
العراق عمان عدن عسير العين العريش عنابة عجمان عكا عمان العقبة عنيزة عطبرة العلمين عطارة
غزة غانا غينيا غواتيمالا غرناطة غرداية غوانتانامو غوا
فرنسا فلسطين فنلندا فيتنام الفلبين فنزويلا فيينا فاس فلورنسا فيجي فرانكفورت فلوريدا فانكوفر فيلادلفيا الفيوم فيلادلفيا
قطر قبرص القاهرة قنا القدس القصيم قازان قرطاج القيروان قسنطينة قلقيلية القامشلي القنيطرة قيصري
كندا كوريا الكويت كولومبيا كوبا كينيا كرواتيا كمبوديا كابول كراتشي كازاخستان كييف كوبنهاجن كاليفورنيا كوالالمبور كاتماندو كراكاس كيب_تاون كربلاء كركوك كفر_الشيخ كفر_الدوار كيوتو كنساس كانبرا كازابلانكا
لبنان ليبيا لندن لوكسمبورغ لاس_فيغاس لاهور لشبونة ليتوانيا لاتفيا لوس_أنجلوس ليون ليفربول لاذقية اللاذقية لاغوس لاباز ليما لاوس ليبيريا  
مصر المغرب المكسيك ماليزيا موريتانيا المالديف مالي مدريد موسكو مكة المدينة مسقط ميامي ميلانو مراكش المنصورة مومباسا ميانمار منغوليا مدغشقر مالطا مولدوفا موناكو مقدونيا مونتريال ميونخ مانشستر مصراتة مطروح مأرب مكناس مدريد منيا_القمح
نيجيريا النرويج النمسا نيوزيلندا نيبال نيويورك نيودلهي نابولي نواكشوط نيس نيجر نيكاراغوا نابلس نجران ناميبيا النجف نيو_جيرسي نيوكاسل
هولندا الهند هنغاريا هونغ_كونغ هافانا هلسنكي هاواي هامبورغ هرات هوليود هيوستن هونج_كونج
واشنطن وارسو ووهان وهران وادي_حلفا ورقلة ويلز وجدة   وهران
اليمن اليابان اليونان يافا ينبع يريفان ياوندي
`;

// data/lexicon/food-jobs.js
var FOOD = `
أرز أرز_بلبن أم_علي أيس_كريم أومليت آيس_كريم أرز_معمر أصابع_زينب أرز_بالخلطة أسماك أرانب أفوكادو
بيتزا برجر بسبوسة بيض بطاطس بامية باذنجان بقلاوة بطارخ بسكويت بيتي_فور بابا_غنوج برياني بصل بلح بطاطا بيض_مسلوق بيف_ستروجانوف   بصارة   برغل بقدونس بنجر بفتيك
تبولة تمر تشيز_كيك تورتة ترمس تونة تفاح توست تاكو تيراميسو توابل تقلية تمرية
ثوم ثريد
جبنة جلاش جمبري جوافة جبن جيلي جلاب جزر جمبري_مشوي جريش
حمص حلوى حواوشي حلاوة حساء حمام_محشي حلبة حمام حلويات حلاوة_طحينية حمص_بالطحينة حبوب
خبز خيار خس خروف خبيز خلطة خضار خليط خشاف خوخ
دجاج دونات دولمة دقة دجاج_مشوي دبس دقيق دوم
ذرة ذرة_مشوية
رز رقاق رغيف رافيولي ريش روبيان رز_معمر رز_بالشعرية رمان رنجة رقائق
سمك سلطة سجق سوشي سبانخ سندوتش سمبوسة سلطعون ستيك سباجيتي سلطة_خضراء سلطة_فواكه سوفلاكي سجق_بلدي سمن سكر سكري سنيورة سميد
شاورما شوربة شكشوكة شاي شيش_طاووق شعيرية شوكولاتة شاي_بالنعناع شوربة_عدس شيبسي شاورما_دجاج شمام
صينية صلصة صوص صدور صدر_دجاج صيادية صفيحة صوجق
طعمية طماطم طاجن طحينة طبق طبيخ طواجن طحين طعمية_محشية
عدس عيش عصيدة عجة عيش_بلدي عصير عسل عجوة عنب عرانيس عصيدة_بالتمر
غزل_البنات غريبة غراتان غلاية
فول فلافل فطير فراخ فتة فشار فاصوليا فاكهة فطيرة فول_مدمس فراخ_مشوية فتوش فلفل_محشي فستق فراولة فيليه
قهوة قشطة قطايف قرنبيط قلقاس قرص قراقيش قمر_الدين قرفة
كشري كباب كفتة كنافة كعك كبدة كرواسون كيك كوارع كبسة كباب_حلة كفتة_مشوية كبدة_اسكندراني كوسة_محشي كرات_البطاطس كريم_كراميل كاري كرنب_محشي كوكيز كراميل كتشب
لحمة لبن لازانيا ليمون لقيمات لحم لحمة_مفرومة لوبيا لبنة لوز لبن_رايب لحم_مشوي لقمة
مكرونة محشي ملوخية مسقعة مهلبية موز مندي مشروم مخلل مسخن مجبوس مقلوبة ممبار مكرونة_بشاميل مشاوي مسخن مربى معمول مولوخية مهلبيه مكسرات   ميني_بيتزا
نودلز نقانق نشا نسكافيه نعناع  
هامبورجر هريسة هوت_دوج هلام
وافل ورق_عنب ورق_دوالي  
يخنة يقطين يوسفي يخنة_بامية يانسون
`;
var JOB = `
أستاذ أمين_مكتبة إعلامي أخصائي أرشيفي أديب أمين_صندوق أخصائي_اجتماعي أستاذ_جامعي أمن أطفائي أسطى أخصائي_تغذية أخصائي_نفسي آثاري أمين_شرطة أرصاد_جوي
بائع بواب بنّاء بيطري بقال برمجي بحار بنكير بستاني بروفيسور بياع بنك بيطرية براح باحث بائع_متجول بدوي
تاجر ترزي تمريض تربوي ترجمان تقني تقني_مختبر تقني_أشعة تاجر_ذهب
جزار جراح جندي جيولوجي جواهرجي جنايني جرسون جلاد جندي_مرور جراح_تجميل
حداد حلاق حارس حكم حلواني حرفي حفار   حارس_أمن حاسب حمّال حكيم حرّاث حلاق_رجالي
خباز خياط خبير خطاط خادم خراط خبير_تجميل   خزاف
دكتور دهان دليل داعية دركي دبلوماسي دكتور_أسنان داية دلال دباغ دبلوماسية
رسام رياضي رجل_أعمال رائد_فضاء ربان راقص رقيب راعي رئيس رسام_كاريكاتير رجل_إطفاء راهب رحالة راوي
سائق سباك سفير سكرتير سياسي ساعاتي سمكري سمان   سجان سباح ساحر سينمائي سيناريست سكرتيرة
شرطي شيف شاعر شيخ شحات     شرطية  
صحفي صيدلي صياد صراف صانع صائغ صبّاغ صحافي صيدلانية صراف_بنك
ضابط ضابط_شرطة ضابط_جيش  
طبيب طيار طباخ طالب طبيب_أسنان طبيب_بيطري طبيب_نفسي طبّال طحان طباع طواف
عامل عالم عسكري عطار عمدة عازف عراف عارض_أزياء عامل_نظافة عامل_بناء عالم_فيزياء عالم_ذرة عميد عقيد  
غواص غسال غنّاي
فلاح فنان فيزيائي فني فنان_تشكيلي فران فقيه فراش فارس فلكي فاحص
قاضي قصاب قبطان قهوجي قارئ قاص قائد قائد_طائرة قناص قسيس قيّم
كاتب كهربائي كيميائي كوافير كاتب_عدل كبير_الطهاة كمساري كاهن كاتبة كاريكاتير كاميرامان كابتن كولونيل
لاعب لحام لاعب_كرة لاعب_تنس لواء لغوي    
مهندس معلم محامي مدرس ممرض مزارع مذيع مصور ميكانيكي مبرمج موظف مترجم محاسب مخرج ممثل مدير مضيفة مضيف_طيران ممرضة معلمة مدربة مدرب مطرب مغني موسيقي مطور مصمم مستشار مفتش مأذون مؤذن موزع منجم منسق مراسل مقاول مهندس_معماري مهندس_مدني مهندس_كهرباء مسعف مصفف مجند ملاح مخبر محقق محافظ مختار معماري مرشد_سياحي مصحح مدرب_رياضي مربي
نجار نحات ناشر نادل ناقد نقاش نائب نسّاج نوتي نجار_مسلح
 
وزير واعظ وكيل وكيل_نيابة وراق وصي
يوتيوبر
`;

// data/lexicon/index.js
var RAW = { boy: BOY, girl: GIRL, animal: ANIMAL, plant: PLANT, object: OBJECT, country: COUNTRY, food: FOOD, job: JOB };
function build(raw) {
  const words = /* @__PURE__ */ new Map();
  for (const w of raw.split(/\s+/)) {
    if (!w) continue;
    const display = w.replace(/_/g, " ");
    const k = answerKey(display);
    if (k.length >= 2 && !words.has(k)) words.set(k, display);
  }
  return words;
}
var DISPLAY = Object.fromEntries(Object.entries(RAW).map(([id, raw]) => [id, build(raw)]));
var LEXICON = Object.fromEntries(Object.entries(DISPLAY).map(([id, m]) => [id, new Set(m.keys())]));
var LEXICON_DISPLAY = DISPLAY;
var LEXICON_BY_LETTER = Object.fromEntries(Object.entries(LEXICON).map(([id, set]) => {
  const byLetter = {};
  for (const w of set) (byLetter[w[0]] ||= []).push(w);
  return [id, byLetter];
}));

// validation/validator.js
var VERDICT = { CORRECT: "correct", WRONG: "wrong", REVIEW: "review" };
var REASON = {
  EMPTY: "empty",
  BAD_CHARS: "bad_chars",
  TOO_SHORT: "too_short",
  TOO_LONG: "too_long",
  LETTER_MISMATCH: "letter_mismatch",
  IN_LEXICON: "in_lexicon",
  LEARNED: "learned",
  NEAR_MATCH: "near_match",
  OTHER_CATEGORY: "other_category",
  UNKNOWN_WORD: "unknown_word",
  CUSTOM_CATEGORY: "custom_category",
  NO_ANSWER: "no_answer"
};
var REASON_TEXT = {
  empty: "إجابة فاضية",
  no_answer: "ما أرسلش إجابة",
  bad_chars: "فيها حروف أو أرقام غير عربية",
  too_short: "قصيرة جدًا",
  too_long: "طويلة جدًا",
  letter_mismatch: "ما بتبدأش بالحرف المطلوب",
  in_lexicon: "موجودة في القاموس",
  learned: "اعتمدها الأدمن قبل كده",
  near_match: "قريبة من كلمة معروفة",
  other_category: "كلمة معروفة لكن من تصنيف تاني",
  unknown_word: "كلمة مش في القاموس",
  custom_category: "تصنيف مضاف يدويًا"
};
var DEFAULT_VALIDATION = { maxLength: 40, minLetters: 2, fuzzyMinLength: 4 };
var ALLOWED_PUNCT = /[.,،!؟?:;"'«»()\-_؟،؛]/g;
var defaultLexicon = { sets: LEXICON, byLetter: LEXICON_BY_LETTER, display: LEXICON_DISPLAY };
var NAME_CATEGORIES = /* @__PURE__ */ new Set(["boy", "girl"]);
function variants(key, categoryId) {
  const out = [key];
  if (NAME_CATEGORIES.has(categoryId)) return out;
  if (key.endsWith("ه") && key.length > 2) out.push(key.slice(0, -1));
  else out.push(`${key}ه`);
  return out;
}
function validateAnswer({ text, letter, category, learned, lexicon = defaultLexicon, options = {} }) {
  const opt = { ...DEFAULT_VALIDATION, ...options };
  const cleaned = cleanText(text);
  if (!cleaned) return { verdict: VERDICT.WRONG, reason: REASON.EMPTY, key: "" };
  if (hasForeignChars(cleaned.replace(ALLOWED_PUNCT, ""))) return { verdict: VERDICT.WRONG, reason: REASON.BAD_CHARS, key: "" };
  const n = normalize(cleaned);
  const key = answerKey(cleaned);
  if (n.length < opt.minLetters) return { verdict: VERDICT.WRONG, reason: REASON.TOO_SHORT, key };
  if (cleaned.length > opt.maxLength) return { verdict: VERDICT.WRONG, reason: REASON.TOO_LONG, key };
  if (!startsWithLetter(cleaned, letter)) return { verdict: VERDICT.WRONG, reason: REASON.LETTER_MISMATCH, key };
  if (learned) {
    for (const v of variants(key, category.id)) if (learned.has(v)) return { verdict: VERDICT.CORRECT, reason: REASON.LEARNED, key };
  }
  const set = category.builtin ? lexicon.sets[category.id] : null;
  if (set) {
    for (const v of variants(key, category.id)) if (set.has(v)) return { verdict: VERDICT.CORRECT, reason: REASON.IN_LEXICON, key };
    if (key.length >= opt.fuzzyMinLength) {
      const pool = (lexicon.byLetter[category.id] || {})[key[0]] || [];
      let best = null;
      for (const cand of pool) {
        if (editDistance(key, cand, 1) <= 1) {
          best = cand;
          break;
        }
      }
      if (best) return { verdict: VERDICT.REVIEW, reason: REASON.NEAR_MATCH, key, suggestion: (lexicon.display[category.id] || /* @__PURE__ */ new Map()).get(best) || best };
    }
    for (const [id, other] of Object.entries(lexicon.sets)) {
      if (id === category.id) continue;
      if (variants(key, id).some((v) => other.has(v))) return { verdict: VERDICT.REVIEW, reason: REASON.OTHER_CATEGORY, key };
    }
    return { verdict: VERDICT.REVIEW, reason: REASON.UNKNOWN_WORD, key };
  }
  return { verdict: VERDICT.REVIEW, reason: REASON.CUSTOM_CATEGORY, key };
}

// scoring/scoring.js
var ANSWER_STATUS = { PENDING: "pending", CORRECT: "correct", WRONG: "wrong", DUPLICATE: "duplicate", REVIEW: "review" };
function pointsForAnswer({ kind, status, points = 0, doubled = false, wager = 0 }) {
  if (kind === "final") {
    if (status === ANSWER_STATUS.CORRECT) return wager;
    return -wager;
  }
  if (status !== ANSWER_STATUS.CORRECT) return 0;
  return (points | 0) * (doubled ? 2 : 1);
}
function rank(rows) {
  const sorted = rows.slice().sort((a, b) => b.score - a.score || String(a.name || a.id).localeCompare(String(b.name || b.id), "ar"));
  let prevScore = null;
  let prevRank = 0;
  return sorted.map((r, i) => {
    const rk = r.score === prevScore ? prevRank : i + 1;
    prevScore = r.score;
    prevRank = rk;
    return { ...r, rank: rk, tied: sorted.filter((x) => x.score === r.score).length > 1 };
  });
}

// game-engine/grading.js
function categoryOf(state, q) {
  const c = state.settings.categories.find((x) => x.id === q.categoryId);
  return { id: q.categoryId, name: q.category, builtin: !!(c && c.builtin) };
}
function learnedSet(state, categoryId) {
  return new Set(state.learned && state.learned[categoryId] || []);
}
function autoGradeOne(state, q, pid, { reset = false } = {}) {
  const a = q.answers[pid];
  const prev = q.grades[pid];
  const auto = a ? validateAnswer({
    text: a.text,
    letter: q.letter,
    category: categoryOf(state, q),
    learned: learnedSet(state, q.categoryId),
    options: { maxLength: state.settings.maxAnswerLength }
  }) : { verdict: VERDICT.WRONG, reason: REASON.NO_ANSWER, key: "" };
  q.grades[pid] = { auto, override: reset ? null : prev ? prev.override : null };
}
function autoGradeAll(state, q) {
  for (const p of state.players) autoGradeOne(state, q, p.id);
}
var mapVerdict = (v) => v === VERDICT.CORRECT ? ANSWER_STATUS.CORRECT : v === VERDICT.WRONG ? ANSWER_STATUS.WRONG : ANSWER_STATUS.REVIEW;
function duplicateGroups(state, q) {
  const groups = /* @__PURE__ */ new Map();
  for (const p of state.players) {
    const a = q.answers[p.id];
    const g = q.grades[p.id];
    if (!a || !g || !g.auto.key) continue;
    if (g.auto.verdict === VERDICT.WRONG || g.override === "wrong") continue;
    if (!groups.has(g.auto.key)) groups.set(g.auto.key, []);
    groups.get(g.auto.key).push(p.id);
  }
  for (const [k, ids] of groups) if (ids.length < 2) groups.delete(k);
  return groups;
}
function derive(state, q) {
  const policy = state.settings.duplicatePolicy;
  const groups = duplicateGroups(state, q);
  const groupOf = /* @__PURE__ */ new Map();
  for (const [k, ids] of groups) for (const id of ids) groupOf.set(id, { key: k, ids });
  const order = new Map(state.players.map((p, i) => [p.id, i]));
  const out = {};
  for (const p of state.players) {
    const a = q.answers[p.id];
    const g = q.grades[p.id];
    if (!a || !g) {
      out[p.id] = { status: ANSWER_STATUS.WRONG, reason: REASON.NO_ANSWER, reasonText: REASON_TEXT.no_answer, unresolved: false, dup: null, source: "auto", edited: false };
      continue;
    }
    const dupGroup = groupOf.get(p.id);
    const dup = dupGroup ? { size: dupGroup.ids.length, with: dupGroup.ids.filter((x) => x !== p.id) } : null;
    const base = mapVerdict(g.auto.verdict);
    const row = {
      reason: g.auto.reason,
      reasonText: REASON_TEXT[g.auto.reason] || "",
      suggestion: g.auto.suggestion,
      dup,
      source: g.override ? "admin" : "auto",
      edited: !!a.edited
    };
    if (g.override) {
      out[p.id] = { ...row, status: g.override, unresolved: false };
    } else if (dup) {
      if (policy === "review") out[p.id] = { ...row, status: ANSWER_STATUS.DUPLICATE, unresolved: true };
      else if (policy === "void") out[p.id] = { ...row, status: ANSWER_STATUS.DUPLICATE, unresolved: false };
      else if (policy === "first") {
        const first = dupGroup.ids.slice().sort((x, y) => q.answers[x].at - q.answers[y].at || order.get(x) - order.get(y))[0];
        out[p.id] = first === p.id ? { ...row, status: base, unresolved: base === ANSWER_STATUS.REVIEW } : { ...row, status: ANSWER_STATUS.DUPLICATE, unresolved: false };
      } else {
        out[p.id] = { ...row, status: base, unresolved: base === ANSWER_STATUS.REVIEW };
      }
    } else {
      out[p.id] = { ...row, status: base, unresolved: base === ANSWER_STATUS.REVIEW };
    }
  }
  return out;
}
function unresolvedPlayers(state, q) {
  const d = derive(state, q);
  return state.players.filter((p) => d[p.id].unresolved).map((p) => p.id);
}
var LEARNABLE = /* @__PURE__ */ new Set([REASON.UNKNOWN_WORD, REASON.CUSTOM_CATEGORY, REASON.OTHER_CATEGORY, REASON.NEAR_MATCH]);
function learnFrom(state, q) {
  const d = derive(state, q);
  state.learned ||= {};
  const set = new Set(state.learned[q.categoryId] || []);
  for (const p of state.players) {
    const g = q.grades[p.id];
    if (!g || d[p.id].status !== ANSWER_STATUS.CORRECT || !LEARNABLE.has(g.auto.reason) || !g.auto.key) continue;
    set.add(g.auto.key);
  }
  state.learned[q.categoryId] = [...set].slice(-400);
}

// game-engine/constants.js
var PHASE = { LOBBY: "lobby", CONFIRM: "confirm", QUESTION: "question", REVIEW: "review", RESULTS: "results", WAGER: "wager", STANDINGS: "standings" };

// game-engine/selectors.js
function hostId(state) {
  return (state.players.find((p) => p.isHost) || state.players[0]).id;
}
function isAdmin(state, userId) {
  return hostId(state) === userId;
}
function presentPlayers(state) {
  return state.players.filter((p) => !p.left);
}
function currentQuestion(state) {
  return state.cursor >= 0 ? state.questions[state.cursor] : null;
}
function findQuestion(state, no) {
  return state.questions.find((q) => q.no === no) || null;
}
function normalCount(state) {
  return state.settings.questionCount;
}
function finalIndex(state) {
  return normalCount(state);
}
function nextIndex(state) {
  if (state.phase === PHASE.CONFIRM) return 0;
  if (state.phase === PHASE.WAGER) return finalIndex(state);
  if (state.phase === PHASE.RESULTS) {
    const q = currentQuestion(state);
    if (!q || q.kind === "final") return null;
    return state.cursor + 1 <= finalIndex(state) ? state.cursor + 1 : null;
  }
  return null;
}
function questionDelta(state, q, pid, derived = derive(state, q)) {
  const d = derived[pid];
  if (!d) return 0;
  return pointsForAnswer({
    kind: q.kind,
    status: d.status,
    points: q.picks[pid] && q.picks[pid].points || 0,
    doubled: !!q.doubled[pid],
    wager: state.wagers[pid] || 0
  });
}
function computeScores(state) {
  const out = {};
  for (const p of state.players) out[p.id] = { total: 0, normal: 0, finalDelta: 0, wager: state.wagers[p.id] || 0, finalStatus: null, correct: 0, wrong: 0, cardQuestion: state.cards[p.id] ?? null };
  for (const q of state.questions) {
    if (!q.approved) continue;
    const d = derive(state, q);
    for (const p of state.players) {
      const delta = questionDelta(state, q, p.id, d);
      const row = out[p.id];
      if (q.kind === "final") {
        row.finalDelta = delta;
        row.finalStatus = d[p.id].status;
        row.total += delta;
      } else {
        row.normal += delta;
        row.total += delta;
        if (d[p.id].status === ANSWER_STATUS.CORRECT) row.correct += 1;
        else row.wrong += 1;
      }
    }
  }
  return out;
}
function standings(state) {
  const sc = computeScores(state);
  return rank(state.players.map((p) => ({ id: p.id, name: p.name, score: sc[p.id].total, ...sc[p.id] })));
}

// game-engine/projection.js
var byName = (a, b) => String(a.name).localeCompare(String(b.name), "ar");
function publicSettings(s) {
  const x = s.settings;
  return {
    questionCount: x.questionCount,
    questionSeconds: x.questionSeconds,
    finalSeconds: x.finalSeconds,
    wagerSeconds: x.wagerSeconds,
    resultsSeconds: x.resultsSeconds,
    confirmSeconds: x.confirmSeconds,
    duplicatePolicy: x.duplicatePolicy,
    autoApprove: x.autoApprove,
    wagerOptions: x.wagerOptions,
    minPlayers: x.minPlayers,
    maxPlayers: x.maxPlayers,
    maxAnswerLength: x.maxAnswerLength,
    letters: x.letters.slice(),
    categories: x.categories.map((c) => ({ id: c.id, name: c.name, enabled: c.enabled, builtin: !!c.builtin }))
  };
}
function nameOf(state, id) {
  const p = state.players.find((x) => x.id === id);
  return p ? p.name : "لاعب";
}
function rowsFor(state, q) {
  const d = derive(state, q);
  return state.players.map((p) => {
    const a = q.answers[p.id];
    const g = d[p.id];
    return {
      playerId: p.id,
      name: p.name,
      left: !!p.left,
      answer: a ? a.text : null,
      edited: !!(a && a.edited),
      originalAnswer: a && a.edited ? a.original : null,
      submittedAt: a ? a.at : null,
      points: q.picks[p.id] && q.picks[p.id].points || 0,
      doubled: !!q.doubled[p.id],
      wager: q.kind === "final" ? state.wagers[p.id] || 0 : null,
      status: g.status,
      reason: g.reason,
      reasonText: g.reasonText,
      unresolved: g.unresolved,
      dup: g.dup,
      suggestion: g.suggestion || null,
      source: g.source,
      delta: questionDelta(state, q, p.id, d)
    };
  });
}
function reviewFor(state, q) {
  const rows = rowsFor(state, q);
  const unresolved = rows.filter((r) => r.unresolved).length;
  return { questionNo: q.no, kind: q.kind, category: q.category, letter: q.letter, approved: q.approved, rows, unresolvedCount: unresolved, canApprove: state.phase === PHASE.REVIEW && currentQuestion(state) === q && unresolved === 0 };
}
function projectFor(state, viewerId, now) {
  const admin = hostId(state) === viewerId;
  const me = state.players.find((p) => p.id === viewerId) || null;
  const scores = computeScores(state);
  const N = normalCount(state);
  const q = state.phase === PHASE.QUESTION || state.phase === PHASE.REVIEW || state.phase === PHASE.RESULTS ? currentQuestion(state) : null;
  const view = {
    viewerId,
    isAdmin: admin,
    serverNow: now,
    roomId: state.roomId,
    roundNo: state.roundNo,
    phase: state.phase,
    phaseEndsAt: state.phaseEndsAt,
    settings: publicSettings(state),
    players: state.players.map((p) => ({ id: p.id, name: p.name, isHost: p.id === hostId(state), left: !!p.left, score: scores[p.id].total })),
    scores: Object.fromEntries(state.players.map((p) => [p.id, scores[p.id].total])),
    existingScores: state.existingScores,
    progress: {
      no: q ? q.no : state.phase === PHASE.WAGER ? N + 1 : 0,
      total: N + 1,
      normalTotal: N,
      final: !!(q && q.kind === "final") || state.phase === PHASE.WAGER
    },
    me: null,
    question: null,
    wager: null,
    standings: null
  };
  if (me) {
    const used = (state.used[me.id] || []).slice().sort((a, b) => a - b);
    const available = state.questions.length ? Array.from({ length: N }, (_, i) => i + 1).filter((n) => !used.includes(n)) : [];
    view.me = {
      id: me.id,
      name: me.name,
      isHost: admin,
      score: scores[me.id].total,
      used,
      available,
      card: { state: state.cards[me.id] == null ? "available" : "used", questionNo: state.cards[me.id] ?? null },
      wager: state.wagers[me.id] ?? null,
      history: state.questions.filter((x) => x.approved).map((x) => {
        const d = derive(state, x);
        return { no: x.no, kind: x.kind, category: x.category, letter: x.letter, points: x.picks[me.id] && x.picks[me.id].points || 0, doubled: !!x.doubled[me.id], status: d[me.id].status, delta: questionDelta(state, x, me.id, d) };
      })
    };
  }
  if (state.phase === PHASE.WAGER) {
    view.wager = {
      endsAt: state.phaseEndsAt,
      options: state.settings.wagerOptions.slice(),
      mine: me ? state.wagers[me.id] ?? null : null,
      players: presentPlayers(state).map((p) => ({ id: p.id, name: p.name, confirmed: state.wagers[p.id] !== void 0 }))
    };
  }
  if (q) {
    const closed = q.closedAt != null;
    const mineSubmitted = !!(me && q.answers[me.id]);
    const answersVisible = closed || mineSubmitted;
    const answers = answersVisible ? state.players.filter((p) => q.answers[p.id]).map((p) => ({ playerId: p.id, name: p.name, text: q.answers[p.id].text, at: q.answers[p.id].at, edited: !!q.answers[p.id].edited })).sort(byName) : [];
    const showWagers = q.kind === "final";
    view.question = {
      no: q.no,
      kind: q.kind,
      categoryId: q.categoryId,
      category: q.category,
      letter: q.letter,
      startedAt: q.startedAt,
      endsAt: q.endsAt,
      closedAt: q.closedAt,
      closeReason: q.closeReason,
      status: closed ? "closed" : "open",
      players: state.players.map((p) => ({ id: p.id, name: p.name, left: !!p.left, picked: !!q.picks[p.id], submitted: !!q.answers[p.id] })).sort(byName),
      submittedCount: presentPlayers(state).filter((p) => q.answers[p.id]).length,
      totalPresent: presentPlayers(state).length,
      mine: me ? {
        points: q.picks[me.id] ? q.picks[me.id].points : null,
        doubled: !!q.doubled[me.id],
        submitted: mineSubmitted,
        answer: mineSubmitted ? q.answers[me.id].text : null,
        wager: q.kind === "final" ? state.wagers[me.id] ?? 0 : null,
        canDouble: q.kind === "normal" && !closed && state.cards[me.id] == null && !!q.picks[me.id] && !mineSubmitted
      } : null,
      answersVisible,
      answers,
      reveal: closed ? {
        picks: Object.fromEntries(state.players.filter((p) => q.picks[p.id]).map((p) => [p.id, { points: q.picks[p.id].points, doubled: !!q.doubled[p.id] }]))
      } : null,
      wagers: showWagers ? Object.fromEntries(state.players.map((p) => [p.id, state.wagers[p.id] || 0])) : null,
      approved: q.approved,
      results: q.approved ? rowsFor(state, q).map((r) => ({
        playerId: r.playerId,
        name: r.name,
        answer: r.answer,
        status: r.status,
        reasonText: r.status === "correct" ? "" : r.reasonText,
        points: r.points,
        doubled: r.doubled,
        wager: r.wager,
        delta: r.delta,
        total: scores[r.playerId].total,
        dup: !!r.dup
      })) : null
    };
  }
  if (state.phase === PHASE.STANDINGS) {
    const rows = standings(state).map((r) => ({
      rank: r.rank,
      tied: r.tied,
      id: r.id,
      name: r.name,
      total: r.score,
      normal: r.normal,
      finalDelta: r.finalDelta,
      wager: r.wager,
      finalStatus: r.finalStatus,
      correct: r.correct,
      wrong: r.wrong,
      cardUsed: r.cardQuestion != null,
      cardQuestion: r.cardQuestion
    }));
    view.standings = { rows, winners: rows.filter((r) => r.rank === 1).map((r) => r.id), early: !!state.endedEarly, normalTotal: N };
  }
  if (admin) {
    const idx = nextIndex(state);
    const nq = idx != null ? state.questions[idx] : null;
    view.nextQuestion = nq ? { no: nq.no, kind: nq.kind, categoryId: nq.categoryId, category: nq.category, letter: nq.letter } : null;
    const reviews = {};
    for (const x of state.questions) if (x.closedAt != null) reviews[x.no] = reviewFor(state, x);
    view.admin = {
      roster: state.players.map((p) => {
        const cq = q;
        return {
          id: p.id,
          name: p.name,
          left: !!p.left,
          score: scores[p.id].total,
          used: (state.used[p.id] || []).slice().sort((a, b) => a - b),
          cardUsed: state.cards[p.id] != null,
          cardQuestion: state.cards[p.id] ?? null,
          wager: state.wagers[p.id] ?? null,
          picked: !!(cq && cq.picks[p.id]),
          submitted: !!(cq && cq.answers[p.id])
        };
      }),
      reviews,
      currentReviewNo: q && q.closedAt != null ? q.no : null,
      audit: state.audit.slice(-80).reverse().map((a) => ({ ...a, byName: nameOf(state, a.by), playerName: a.playerId ? nameOf(state, a.playerId) : null })),
      learnedCount: Object.values(state.learned || {}).reduce((n, arr) => n + arr.length, 0)
    };
  }
  return view;
}

// game-engine/engine.js
var AUDIT_LIMIT = 300;
var ev = (state, type, payload = {}) => ({ type, payload: { roomId: state.roomId, roundNo: state.roundNo, ...payload } });
function createGame({ roomId, players, existingScores = {}, settings = {} }) {
  return {
    roomId,
    settings: defaultSettings(settings),
    players: players.map((p) => ({ id: p.id, name: p.name, isHost: !!p.isHost, left: false })),
    existingScores: { ...existingScores },
    phase: PHASE.LOBBY,
    roundNo: 0,
    questions: [],
    cursor: -1,
    phaseEndsAt: null,
    used: {},
    // { [pid]: number[] } الأرقام المستخدمة (بتتحرق لحظة التثبيت)
    cards: {},
    // { [pid]: questionNo|null } كارت المضاعفة: مين استخدمه وفي أنهي سؤال
    wagers: {},
    // { [pid]: 0|10|20 } رهان السؤال النهائي
    learned: {},
    // { [categoryId]: string[] } إجابات اعتمدها الأدمن (توسّع التصحيح التلقائي)
    catSeq: 1,
    audit: [],
    endedEarly: false,
    seen: {}
    // { [pid]: requestId[] } لمنع تنفيذ نفس الطلب مرتين (يستخدمها الخادم)
  };
}
function mustAdmin(state, userId) {
  need(isAdmin(state, userId), "NOT_ADMIN");
}
function mustPlayer(state, userId) {
  const p = state.players.find((x) => x.id === userId);
  need(p, "NOT_IN_ROOM");
  need(!p.left, "LEFT_ROOM");
  return p;
}
function mustPhase(state, ...phases) {
  need(phases.includes(state.phase), "BAD_PHASE");
}
function audit(s, now, by, type, data = {}) {
  s.audit.push({ at: now, by, type, ...data });
  if (s.audit.length > AUDIT_LIMIT) s.audit.splice(0, s.audit.length - AUDIT_LIMIT);
}
function updateSettings(state, userId, patch) {
  mustAdmin(state, userId);
  mustPhase(state, PHASE.LOBBY);
  const s = structuredClone(state);
  s.settings = applySettingsPatch(s.settings, patch);
  return { state: s, events: [ev(s, "settingsUpdated", { patch })] };
}
function addCategory2(state, userId, { name }) {
  mustAdmin(state, userId);
  mustPhase(state, PHASE.LOBBY);
  const s = structuredClone(state);
  s.settings = addCategory(s.settings, s.catSeq, { name });
  s.catSeq += 1;
  return { state: s, events: [ev(s, "settingsUpdated", { categories: true })] };
}
function updateCategory2(state, userId, params) {
  mustAdmin(state, userId);
  mustPhase(state, PHASE.LOBBY);
  const s = structuredClone(state);
  s.settings = updateCategory(s.settings, params);
  return { state: s, events: [ev(s, "settingsUpdated", { categories: true })] };
}
function removeCategory2(state, userId, params) {
  mustAdmin(state, userId);
  mustPhase(state, PHASE.LOBBY);
  const s = structuredClone(state);
  s.settings = removeCategory(s.settings, params);
  return { state: s, events: [ev(s, "settingsUpdated", { categories: true })] };
}
function resetCategories2(state, userId) {
  mustAdmin(state, userId);
  mustPhase(state, PHASE.LOBBY);
  const s = structuredClone(state);
  s.settings = resetCategories(s.settings);
  return { state: s, events: [ev(s, "settingsUpdated", { categories: true })] };
}
function startRound(state, userId, ctx) {
  mustAdmin(state, userId);
  mustPhase(state, PHASE.LOBBY);
  const n = presentPlayers(state).length;
  need(n >= state.settings.minPlayers, "TOO_FEW");
  need(n <= state.settings.maxPlayers, "TOO_MANY");
  need(enabledCategories(state.settings).length >= 1, "NO_CATEGORIES");
  const s = structuredClone(state);
  s.players = s.players.filter((p) => !p.left);
  s.roundNo += 1;
  s.questions = generateQuestions(s.settings, ctx.rng);
  s.cursor = -1;
  s.used = Object.fromEntries(s.players.map((p) => [p.id, []]));
  s.cards = Object.fromEntries(s.players.map((p) => [p.id, null]));
  s.wagers = {};
  s.endedEarly = false;
  s.phase = PHASE.CONFIRM;
  s.phaseEndsAt = ctx.now + s.settings.confirmSeconds * 1e3;
  audit(s, ctx.now, userId, "startRound", { questions: s.questions.length });
  return { state: s, events: [ev(s, "gameStarted", { questionCount: s.settings.questionCount, playerIds: s.players.map((p) => p.id), settings: { questionCount: s.settings.questionCount, questionSeconds: s.settings.questionSeconds } })] };
}
function openQuestion(s, index, now, events) {
  const q = s.questions[index];
  s.cursor = index;
  q.startedAt = now;
  q.endsAt = now + (q.kind === "final" ? s.settings.finalSeconds : s.settings.questionSeconds) * 1e3;
  s.phase = PHASE.QUESTION;
  s.phaseEndsAt = null;
  events.push(ev(s, "questionStarted", { questionNo: q.no, kind: q.kind, category: q.category, letter: q.letter, endsAt: q.endsAt }));
}
function approveInternal(s, q, now, by, events) {
  autoGradeAllKeep(s, q);
  learnFrom(s, q);
  q.approved = true;
  q.approvedAt = now;
  const d = derive(s, q);
  const deltas = {};
  for (const p of s.players) deltas[p.id] = questionDelta(s, q, p.id, d);
  const totals = computeScores(s);
  events.push(ev(s, "questionApproved", { questionNo: q.no, kind: q.kind, deltas }));
  for (const p of s.players) {
    if (deltas[p.id] !== 0) events.push(ev(s, "scoreUpdated", { playerId: p.id, questionNo: q.no, delta: deltas[p.id], total: totals[p.id].total }));
  }
  s.phase = PHASE.RESULTS;
  s.phaseEndsAt = s.settings.resultsSeconds > 0 ? now + s.settings.resultsSeconds * 1e3 : null;
  if (by) audit(s, now, by, "approve", { questionNo: q.no });
}
function autoGradeAllKeep(s, q) {
  for (const p of s.players) if (!(q.grades[p.id] && q.answers[p.id] && q.grades[p.id].override)) autoGradeOne(s, q, p.id);
}
function closeInternal(s, now, reason, events) {
  const q = currentQuestion(s);
  q.closedAt = now;
  q.closeReason = reason;
  autoGradeAll(s, q);
  s.phase = PHASE.REVIEW;
  s.phaseEndsAt = null;
  events.push(ev(s, "questionClosed", { questionNo: q.no, reason }));
  if (s.settings.autoApprove && unresolvedPlayers(s, q).length === 0) approveInternal(s, q, now, null, events);
}
function startWager(s, now) {
  s.phase = PHASE.WAGER;
  s.wagers = {};
  s.phaseEndsAt = now + s.settings.wagerSeconds * 1e3;
}
function closeWagerInternal(s, now, events) {
  for (const p of s.players) if (s.wagers[p.id] === void 0) s.wagers[p.id] = 0;
  events.push(ev(s, "wagerClosed", {}));
  openQuestion(s, finalIndex(s), now, events);
}
function toStandings(s, now, early, events) {
  s.phase = PHASE.STANDINGS;
  s.phaseEndsAt = null;
  s.endedEarly = !!early;
  s.finishedAt = now;
  const ranking = standings(s).map((r) => ({ id: r.id, total: r.score, rank: r.rank }));
  events.push(ev(s, "roundCompleted", { ranking, early: !!early }));
}
function advanceFromResults(s, now, events) {
  const q = currentQuestion(s);
  if (q.kind === "final") return toStandings(s, now, false, events);
  if (s.cursor + 1 < normalCount(s)) return openQuestion(s, s.cursor + 1, now, events);
  return startWager(s, now);
}
function advance(state, userId, ctx) {
  mustAdmin(state, userId);
  const s = structuredClone(state);
  const events = [];
  switch (s.phase) {
    case PHASE.CONFIRM:
      openQuestion(s, 0, ctx.now, events);
      break;
    case PHASE.QUESTION:
      closeInternal(s, ctx.now, "admin", events);
      break;
    case PHASE.RESULTS:
      advanceFromResults(s, ctx.now, events);
      break;
    case PHASE.WAGER:
      closeWagerInternal(s, ctx.now, events);
      break;
    default:
      throw new GameError("BAD_PHASE");
  }
  audit(s, ctx.now, userId, "advance", { from: state.phase });
  return { state: s, events };
}
function closeQuestion(state, userId, ctx) {
  mustAdmin(state, userId);
  mustPhase(state, PHASE.QUESTION);
  return advance(state, userId, ctx);
}
function tick(state, ctx) {
  const now = ctx.now;
  const events = [];
  let s = null;
  const clone = () => s ||= structuredClone(state);
  switch (state.phase) {
    case PHASE.CONFIRM:
      if (state.phaseEndsAt != null && now >= state.phaseEndsAt) openQuestion(clone(), 0, now, events);
      break;
    case PHASE.QUESTION: {
      const q = currentQuestion(state);
      const everyone = presentPlayers(state).every((p) => q.answers[p.id]);
      if (now >= q.endsAt) closeInternal(clone(), now, "timeout", events);
      else if (everyone) closeInternal(clone(), now, "all_submitted", events);
      break;
    }
    case PHASE.RESULTS:
      if (state.phaseEndsAt != null && now >= state.phaseEndsAt) advanceFromResults(clone(), now, events);
      break;
    case PHASE.WAGER: {
      const everyone = presentPlayers(state).every((p) => state.wagers[p.id] !== void 0);
      if (now >= state.phaseEndsAt || everyone) closeWagerInternal(clone(), now, events);
      break;
    }
    default:
      break;
  }
  return s ? { state: s, events } : { state, events: [] };
}
function openQuestionFor(state, now) {
  mustPhase(state, PHASE.QUESTION);
  const q = currentQuestion(state);
  need(now < q.endsAt, "TIME_UP");
  return q;
}
function lockPoints(state, userId, { points }, ctx) {
  mustPlayer(state, userId);
  const q = openQuestionFor(state, ctx.now);
  need(q.kind === "normal", "BAD_PHASE");
  const p = Number(points);
  need(Number.isInteger(p) && p >= 1 && p <= normalCount(state), "BAD_POINTS");
  const existing = q.picks[userId];
  if (existing) {
    if (existing.points === p) return { state, events: [] };
    throw new GameError("POINTS_LOCKED");
  }
  need(!(state.used[userId] || []).includes(p), "NUMBER_USED");
  const s = structuredClone(state);
  s.questions[s.cursor].picks[userId] = { points: p, at: ctx.now };
  (s.used[userId] ||= []).push(p);
  return { state: s, events: [ev(s, "pointsLocked", { playerId: userId, questionNo: q.no })] };
}
function activateDouble(state, userId, ctx) {
  mustPlayer(state, userId);
  const q = openQuestionFor(state, ctx.now);
  need(q.kind === "normal", "NO_CARD_IN_FINAL");
  if (state.cards[userId] === q.no) return { state, events: [] };
  need(state.cards[userId] == null, "CARD_USED");
  need(q.picks[userId], "POINTS_FIRST");
  need(!q.answers[userId], "ALREADY_SUBMITTED");
  const s = structuredClone(state);
  s.cards[userId] = q.no;
  s.questions[s.cursor].doubled[userId] = true;
  return { state: s, events: [ev(s, "cardUsed", { playerId: userId, questionNo: q.no })] };
}
function submitAnswer(state, userId, { text, points, double } = {}, ctx) {
  mustPlayer(state, userId);
  const q = openQuestionFor(state, ctx.now);
  need(!q.answers[userId], "ALREADY_SUBMITTED");
  const clean = cleanText(typeof text === "string" ? text : "");
  need(clean.length > 0, "EMPTY_ANSWER");
  need(clean.length <= Math.max(state.settings.maxAnswerLength * 2, 60), "ANSWER_TOO_LONG");
  const events = [];
  let pick = q.picks[userId] || null;
  let newPoints = null;
  let useCard = false;
  if (q.kind === "normal") {
    if (pick) {
      if (points != null) need(Number(points) === pick.points, "POINTS_LOCKED");
    } else {
      need(points != null, "POINTS_FIRST");
      const p = Number(points);
      need(Number.isInteger(p) && p >= 1 && p <= normalCount(state), "BAD_POINTS");
      need(!(state.used[userId] || []).includes(p), "NUMBER_USED");
      newPoints = p;
    }
    if (double) {
      if (state.cards[userId] !== q.no) {
        need(state.cards[userId] == null, "CARD_USED");
        useCard = true;
      }
    }
  }
  const s = structuredClone(state);
  const sq = s.questions[s.cursor];
  if (newPoints != null) {
    sq.picks[userId] = { points: newPoints, at: ctx.now };
    (s.used[userId] ||= []).push(newPoints);
    events.push(ev(s, "pointsLocked", { playerId: userId, questionNo: q.no }));
  }
  if (useCard) {
    s.cards[userId] = q.no;
    sq.doubled[userId] = true;
    events.push(ev(s, "cardUsed", { playerId: userId, questionNo: q.no }));
  }
  sq.answers[userId] = { text: clean, at: ctx.now };
  events.push(ev(s, "answerSubmitted", { playerId: userId, questionNo: q.no }));
  if (presentPlayers(s).every((p) => sq.answers[p.id])) closeInternal(s, ctx.now, "all_submitted", events);
  return { state: s, events };
}
function lockWager(state, userId, { amount }, ctx) {
  mustPlayer(state, userId);
  mustPhase(state, PHASE.WAGER);
  need(ctx.now < state.phaseEndsAt, "TIME_UP");
  const a = Number(amount);
  need(state.settings.wagerOptions.includes(a), "BAD_WAGER");
  if (state.wagers[userId] !== void 0) {
    if (state.wagers[userId] === a) return { state, events: [] };
    throw new GameError("WAGER_LOCKED");
  }
  const s = structuredClone(state);
  s.wagers[userId] = a;
  const events = [ev(s, "wagerLocked", { playerId: userId })];
  if (presentPlayers(s).every((p) => s.wagers[p.id] !== void 0)) closeWagerInternal(s, ctx.now, events);
  return { state: s, events };
}
function gradableQuestion(state, questionNo) {
  need(state.phase !== PHASE.STANDINGS && state.phase !== PHASE.LOBBY, "BAD_PHASE");
  const q = questionNo ? findQuestion(state, questionNo) : currentQuestion(state);
  need(q, "NO_SUCH_QUESTION");
  need(q.closedAt != null, "BAD_PHASE");
  return q;
}
function gradeAnswer(state, userId, { questionNo, playerId, status }, ctx) {
  mustAdmin(state, userId);
  const q0 = gradableQuestion(state, questionNo);
  need(["correct", "wrong", "auto"].includes(status), "BAD_SETTINGS");
  need(q0.answers[playerId], "NO_SUCH_ANSWER");
  const before = derive(state, q0)[playerId].status;
  const s = structuredClone(state);
  const q = findQuestion(s, q0.no);
  q.grades[playerId].override = status === "auto" ? null : status;
  const after = derive(s, q)[playerId].status;
  audit(s, ctx.now, userId, "grade", { questionNo: q.no, playerId, before, after });
  return { state: s, events: [ev(s, "answerGraded", { questionNo: q.no, playerId, status: after })] };
}
function bulkGrade(state, userId, { questionNo, status }, ctx) {
  mustAdmin(state, userId);
  const q0 = gradableQuestion(state, questionNo);
  need(["correct", "wrong"].includes(status), "BAD_SETTINGS");
  const pending = unresolvedPlayers(state, q0);
  if (!pending.length) return { state, events: [] };
  const s = structuredClone(state);
  const q = findQuestion(s, q0.no);
  for (const pid of pending) q.grades[pid].override = status;
  audit(s, ctx.now, userId, "bulkGrade", { questionNo: q.no, status, count: pending.length });
  return { state: s, events: [ev(s, "answerGraded", { questionNo: q.no, bulk: true, status })] };
}
function approveQuestion(state, userId, ctx) {
  mustAdmin(state, userId);
  mustPhase(state, PHASE.REVIEW);
  const q0 = currentQuestion(state);
  need(unresolvedPlayers(state, q0).length === 0, "UNRESOLVED");
  const s = structuredClone(state);
  const events = [];
  approveInternal(s, currentQuestion(s), ctx.now, userId, events);
  return { state: s, events };
}
function adjustNext(state, userId, { categoryId, letter, reroll }, ctx) {
  mustAdmin(state, userId);
  const idx = nextIndex(state);
  need(idx !== null && idx !== void 0, "NO_NEXT");
  const s = structuredClone(state);
  const q = s.questions[idx];
  if (categoryId !== void 0) {
    const cat = s.settings.categories.find((c) => c.id === categoryId);
    need(cat, "BAD_CATEGORY");
    q.categoryId = cat.id;
    q.category = cat.name;
  }
  if (letter !== void 0) {
    need(isValidLetter(letter), "BAD_LETTER");
    q.letter = letter;
  }
  if (reroll) q.letter = rerollLetter(s.settings, s.questions, idx, ctx.rng);
  if (s.phase === PHASE.RESULTS && s.settings.resultsSeconds > 0) s.phaseEndsAt = ctx.now + s.settings.resultsSeconds * 1e3;
  audit(s, ctx.now, userId, "adjustNext", { questionNo: q.no, categoryId: q.categoryId, letter: q.letter });
  return { state: s, events: [] };
}
function endRound(state, userId, ctx) {
  mustAdmin(state, userId);
  need(state.phase !== PHASE.LOBBY && state.phase !== PHASE.STANDINGS, "BAD_PHASE");
  const s = structuredClone(state);
  const events = [];
  audit(s, ctx.now, userId, "endRound", { at: state.phase });
  toStandings(s, ctx.now, true, events);
  return { state: s, events };
}
function newRound(state, userId, ctx) {
  mustAdmin(state, userId);
  need(state.phase === PHASE.STANDINGS || state.phase === PHASE.LOBBY, "BAD_PHASE");
  if (state.phase === PHASE.LOBBY) return { state, events: [] };
  const s = structuredClone(state);
  s.players = s.players.filter((p) => !p.left);
  s.phase = PHASE.LOBBY;
  s.questions = [];
  s.cursor = -1;
  s.phaseEndsAt = null;
  s.used = {};
  s.cards = {};
  s.wagers = {};
  s.endedEarly = false;
  delete s.finishedAt;
  audit(s, ctx.now, userId, "newRound", {});
  return { state: s, events: [] };
}

// server/handler.js
var COMMANDS = {
  updateSettings: (s, u, p) => updateSettings(s, u, p),
  addCategory: (s, u, p) => addCategory2(s, u, p),
  updateCategory: (s, u, p) => updateCategory2(s, u, p),
  removeCategory: (s, u, p) => removeCategory2(s, u, p),
  resetCategories: (s, u) => resetCategories2(s, u),
  startRound: (s, u, p, c) => startRound(s, u, c),
  advance: (s, u, p, c) => advance(s, u, c),
  closeQuestion: (s, u, p, c) => closeQuestion(s, u, c),
  lockPoints: (s, u, p, c) => lockPoints(s, u, p, c),
  activateDouble: (s, u, p, c) => activateDouble(s, u, c),
  submitAnswer: (s, u, p, c) => submitAnswer(s, u, p, c),
  lockWager: (s, u, p, c) => lockWager(s, u, p, c),
  gradeAnswer: (s, u, p, c) => gradeAnswer(s, u, p, c),
  bulkGrade: (s, u, p, c) => bulkGrade(s, u, p, c),
  approveQuestion: (s, u, p, c) => approveQuestion(s, u, c),
  adjustNext: (s, u, p, c) => adjustNext(s, u, p, c),
  endRound: (s, u, p, c) => endRound(s, u, c),
  newRound: (s, u, p, c) => newRound(s, u, c),
  tick: (s) => ({ state: s, events: [] }),
  // الـtick بيتنفّذ دايمًا قبل أي أمر
  view: (s) => ({ state: s, events: [] })
};
var MAX_RETRIES = 12;
var SEEN_LIMIT = 24;
function syncRoster(state, room) {
  const members = room.members;
  const ids = new Set(members.map((m) => m.id));
  const s = structuredClone(state);
  let changed = false;
  const open = s.phase === "lobby" || s.phase === "standings";
  for (const p of s.players) {
    const isHost = p.id === room.adminId;
    if (p.isHost !== isHost) {
      p.isHost = isHost;
      changed = true;
    }
    const gone = !ids.has(p.id);
    if (open) continue;
    if (p.left !== gone) {
      p.left = gone;
      changed = true;
    }
  }
  if (open) {
    const before = s.players.length;
    s.players = s.players.filter((p) => ids.has(p.id));
    for (const m of members) {
      if (!s.players.some((p) => p.id === m.id)) s.players.push({ id: m.id, name: m.name, isHost: m.id === room.adminId, left: false });
    }
    if (s.players.length !== before || s.players.some((p) => {
      const m = members.find((x) => x.id === p.id);
      return m && m.name !== p.name;
    })) {
      for (const p of s.players) {
        const m = members.find((x) => x.id === p.id);
        if (m) p.name = m.name;
      }
      changed = true;
    }
    s.players.sort((a, b) => members.findIndex((m) => m.id === a.id) - members.findIndex((m) => m.id === b.id));
  }
  if (!s.players.some((p) => p.isHost) && s.players.length) {
    s.players[0].isHost = true;
    changed = true;
  }
  if (room.existingScores) s.existingScores = { ...room.existingScores };
  return changed ? s : state;
}
function fail(error) {
  return { ok: false, error: { code: error.code || "INTERNAL", message: error.message } };
}
async function handle(db, req) {
  const { roomId, userId, action, params = {}, requestId } = req;
  const now = req.now ?? Date.now();
  const rng = req.rng ?? Math.random;
  const ctx = { now, rng };
  if (!roomId || !userId) return fail(new GameError("NOT_IN_ROOM"));
  if (!COMMANDS[action]) return fail(new GameError("BAD_PHASE", `أمر غير معروف: ${action}`));
  const room = await db.getRoom(roomId);
  if (!room || !room.members.some((m) => m.id === userId)) return fail(new GameError("NOT_IN_ROOM"));
  if (room.activeGame !== void 0 && room.activeGame !== "bus_complete") return fail(new GameError("BAD_PHASE", "اللعبة دي مش شغّالة في الغرفة"));
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const row = await db.loadGame(roomId);
    let state = row ? row.state : createGame({ roomId, players: room.members.map((m) => ({ id: m.id, name: m.name, isHost: m.id === room.adminId })), existingScores: room.existingScores });
    let version = row ? row.version : null;
    const events = [];
    let dirty = !row;
    let commandError = null;
    const synced = syncRoster(state, room);
    if (synced !== state) {
      state = synced;
      dirty = true;
    }
    const t = tick(state, ctx);
    if (t.state !== state) {
      state = t.state;
      dirty = true;
      events.push(...t.events);
    }
    const awarded = await ensureAwards(db, state);
    if (awarded !== state) {
      state = awarded;
      dirty = true;
    }
    const seenList = state.seen && state.seen[userId] || [];
    const isDuplicateRequest = !!requestId && seenList.includes(requestId);
    if (action !== "view" && action !== "tick" && !isDuplicateRequest) {
      try {
        const r = COMMANDS[action](state, userId, params, ctx);
        if (r.state !== state) {
          state = r.state;
          dirty = true;
          events.push(...r.events);
          if (requestId) {
            state = structuredClone(state);
            state.seen ||= {};
            state.seen[userId] = [...seenList, requestId].slice(-SEEN_LIMIT);
          }
        }
      } catch (e) {
        if (e instanceof GameError) commandError = e;
        else throw e;
      }
    }
    if (dirty) {
      const saved = await db.saveGame(roomId, state, version);
      if (!saved.ok) continue;
      version = saved.version;
    }
    const view = { ...projectFor(state, userId, now), version: version ?? 0 };
    if (commandError) return { ...fail(commandError), view };
    return { ok: true, view, events: events.filter((e) => e.type !== "pointsLocked") };
  }
  return fail(new GameError("BAD_PHASE", "الغرفة مشغولة، جرّب تاني"));
}
async function ensureAwards(db, state) {
  if (state.phase !== "standings" || state.awardsDone === state.roundNo || !db.award) return state;
  if (!state.endedEarly) {
    try {
      for (const r of standings(state)) {
        if (r.score > 0) await db.award(r.id, `bus-complete:${state.roomId}:${state.roundNo}`, r.score, { rank: r.rank });
      }
    } catch (err) {
      console.error("[bus-complete] award failed, will retry", err && err.message);
      return state;
    }
  }
  const s = structuredClone(state);
  s.awardsDone = state.roundNo;
  return s;
}

// server/edge.js
var ACTIVATION_ERRORS = {
  not_admin: "NOT_ADMIN",
  bad_phase: "BAD_PHASE",
  too_few: "TOO_FEW",
  too_many: "TOO_MANY",
  wrong_game: "BAD_PHASE",
  unknown_game: "BAD_PHASE",
  room_not_found: "NOT_IN_ROOM"
};
var fail2 = (code, message) => ({ ok: false, error: { code, message: message || MESSAGES[code] || code } });
function fromDbError(err) {
  const msg = String(err && err.message || "");
  for (const [k, code] of Object.entries(ACTIVATION_ERRORS)) if (msg.includes(k)) return fail2(code);
  return null;
}
function createEdgeApi({ db, now = () => Date.now() }) {
  async function member(userId, roomId) {
    const room = await db.getRoom(roomId);
    if (!room || !room.members.some((m) => m.id === userId)) throw new GameError("NOT_IN_ROOM");
    return room;
  }
  async function init(userId, roomId) {
    const room = await member(userId, roomId);
    const me = room.members.find((m) => m.id === userId);
    return { ok: true, data: {
      roomId,
      players: room.members.map((m) => ({ id: m.id, name: m.name, isHost: m.id === room.adminId })),
      currentUserId: userId,
      playerName: me ? me.name : "",
      existingScores: room.existingScores || {},
      gameSettings: {}
    } };
  }
  async function start(userId, roomId) {
    await member(userId, roomId);
    try {
      await db.activate(roomId, userId);
    } catch (err) {
      const m = fromDbError(err);
      if (m) return m;
      throw err;
    }
    return handle(db, { roomId, userId, action: "view", now: now() });
  }
  async function exit(userId, roomId) {
    await member(userId, roomId);
    try {
      await db.returnToRoom(roomId, userId);
    } catch (err) {
      const m = fromDbError(err);
      if (m) return m;
      throw err;
    }
    return { ok: true };
  }
  async function handle2({ userId, body }) {
    try {
      if (!userId) return fail2("NOT_IN_ROOM", "سجّل دخولك الأول");
      if (!body || typeof body !== "object" || typeof body.roomId !== "string" || !body.roomId) return fail2("BAD_PHASE", "طلب غير صحيح");
      const { action, roomId, requestId } = body;
      const params = body.params && typeof body.params === "object" ? body.params : {};
      if (action === "init") return await init(userId, roomId);
      if (action === "start") return await start(userId, roomId);
      if (action === "exit") return await exit(userId, roomId);
      return await handle(db, { roomId, userId, action: String(action), params, requestId: typeof requestId === "string" ? requestId.slice(0, 80) : void 0, now: now() });
    } catch (err) {
      if (err instanceof GameError) return fail2(err.code, err.message);
      console.error("[bus-complete] internal error", err);
      return fail2("INTERNAL", "حصلت مشكلة غير متوقعة، جرّب تاني");
    }
  }
  return { handle: handle2 };
}

// server/deno-entry.js
var CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
var sb = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
var api = createEdgeApi({ db: makeSupabaseDb(sb) });
var reply = (obj) => new Response(JSON.stringify(obj), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data, error } = await sb.auth.getUser(token);
    const userId = !error && data && data.user ? data.user.id : null;
    let body = null;
    try {
      body = await req.json();
    } catch {
      body = null;
    }
    return reply(await api.handle({ userId, body }));
  } catch (err) {
    console.error("[bus-complete] fatal", err);
    return reply({ ok: false, error: { code: "INTERNAL", message: "حصلت مشكلة غير متوقعة" } });
  }
});

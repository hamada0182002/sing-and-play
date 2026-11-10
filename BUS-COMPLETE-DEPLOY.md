# نشر لعبة «أتوبيس كومبليت» على المنصة

الكود اتدمج بالفعل في المشروع. اللي فاضل خطوتين على Supabase (مرة واحدة) وبعدها اختبار سريع.

## ١) قاعدة البيانات
Supabase › SQL Editor › New query، الصق محتوى `supabase/migrations/0016_bus_complete.sql` وشغّله.
(لازم 0014 و0015 يكونوا متشغلين قبله. الملف آمن للتكرار ومبيعدّلش أي جدول أو دالة قديمة.)

بعد التشغيل اللعبة بتظهر لوحدها في الصفحة الرئيسية من جدول `games`.

## ٢) الـEdge Function
```
supabase functions deploy bus-complete
```
الملف جاهز في `supabase/functions/bus-complete/index.ts` (مولَّد، وبيستخدم `SUPABASE_URL` و`SUPABASE_SERVICE_ROLE_KEY` الموجودين أصلاً).

لو عدّلت كود اللعبة (`src/games/bus-complete/`) أعد التوليد قبل النشر:
```
npm i -D esbuild
node src/games/bus-complete/scripts/build-edge-function.mjs
```

## ٣) اختبار قبل الإطلاق (على بيئة تجريبية)
1. ٣ حسابات في غرفة واحدة، الأدمن يختار «أتوبيس كومبليت» ويبدأ، وجولة قصيرة (١٠ أسئلة).
2. افتح Network: ردود `view` للاعب ما فيها إجابات غيره قبل ما يبعت، وما فيها رهانات قبل القفل.
3. بعد الترتيب النهائي:
   `select * from game_point_awards where game_id = 'bus_complete';`
   سطر لكل لاعب نقاطه موجبة، وتكرار الطلبات ما بيضيفش نقاط تاني.
4. جرّب «طرد لاعب» و«مغادرة الغرفة» في نص اللعبة، واللعبة المفروض تكمّل بالباقيين.

## ما اتغيّر في المشروع
- جديد: `src/games/bus-complete/` · `src/features/games/BusCompleteGame.tsx` · `supabase/migrations/0016_bus_complete.sql` · `supabase/functions/bus-complete/`
- إضافات صغيرة: `games/api.ts` (دالتين) · `games/gameUi.ts` (شرح اللعبة) · `games/GameArt.tsx` (رسمة الأتوبيس) · `lobby/LobbyScreen.tsx` (البدء والعرض والرجوع) · `styles/global.css` (غلاف اللعبة `bcg-*`)

## التراجع
احذف `BusCompleteGame.tsx` وإضافات الملفات اللي فوق. الجداول والدوال الجديدة مستقلة (`bus_complete_*` و`bc_*`). ولو عايز تخفي اللعبة بس: `update public.games set enabled = false where id = 'bus_complete';`

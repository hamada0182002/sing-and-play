> ✅ **الدمج اتطبّق في المنصة** (الواجهة والـAPI واللوبي). الخطوات اللي فاضلة على Supabase في `BUS-COMPLETE-DEPLOY.md` بجذر المشروع. باقي الملف ده مرجع لما الحزمة كانت مستقلة.

# الدمج في منصة SING & PLAY

الوحدة جاهزة تتضاف **بدون تعديل أي ملف قديم** ما عدا ٣ أسطر صغيرة في اللوبي (مثل «أنا مين؟» بالظبط). كل الخطوات إضافية وقابلة للتراجع.

## ١) قاعدة البيانات (مرة واحدة)
شغّل `supabase/migrations/0016_bus_complete.sql` في Supabase › SQL Editor (آمن للتكرار). بيعمل:
- سطر `bus_complete` في جدول `games` (٣–١٠ لاعبين) → يظهر للأدمن في اختيار اللعبة.
- `bus_complete_games` (حالة اللعبة + الإجابات، **مقفول** على التطبيق) و`bus_complete_signal` (رقم نسخة فقط، Realtime).
- `bc_activate` و`bc_return_to_room` (للخادم فقط). نقاط المنصة بتعدّي من `award_game_points` الموجودة (بتمنع التكرار).

## ٢) الـEdge Function
```
supabase functions deploy bus-complete
```
الملف الجاهز: `supabase/functions/bus-complete/index.ts` (مولَّد، مفيش إعدادات إضافية: بيستخدم `SUPABASE_URL` و`SUPABASE_SERVICE_ROLE_KEY` الموجودين). لو عدّلت الكود: `npm i -D esbuild && node scripts/build-edge-function.mjs`.

## ٣) الواجهة
1. انسخ المجلد كله إلى `src/games/bus-complete/` (تقدر تحذف `demo/ dist/ tests/ supabase/ scripts/ integration/ server/ game-engine/ validation/ scoring/ utils/ data/lexicon/` من نسخة العميل لو عايز تقلّلها؛ المطلوب للمتصفح: `index.js adapters/ components/ screens/ admin/ hooks/ styles/ data/(copy,letters,categories).js`).
   > الأبسط: انسخه كله. حزمة العميل (`index.js`) **مش بتستورد** القاموس ولا المحرك (اختبار `client-bundle` بيضمن ده)، فالـbundler مش هيشحنهم.
2. انسخ `integration/BusCompleteGame.tsx` إلى `src/features/games/`.
3. أضف دالتين من `integration/api.snippet.ts` لـ`api.ts`، وسطر `integration/gameUi.snippet.ts` لـ`gameUi.ts`.
4. طبّق الأسطر الثلاثة في `integration/LobbyScreen.patch.md`.

## ٤) الأحداث للمنصة (اختياري)
```ts
mountBusComplete(el, { adapter, onEvent: (name, payload) => { /* gameStarted | questionStarted | answerSubmitted | cardUsed | questionApproved | scoreUpdated | finalWagerLocked | roundCompleted */ } });
```
لو المنصة بتعرّف ألوان الهوية كمتغيرات CSS، اربط `--bc-*` بها داخل `.bc-root` (الأنماط كلها معزولة تحته ولا تؤثر على باقي التطبيق).

## ٥) اختبار قبل الإطلاق (على بيئة تجريبية)
- ٣ حسابات في غرفة واحدة، الأدمن يختار «أتوبيس كومبليت» → يبدأ → جولة قصيرة (١٠ أسئلة).
- افتح Network: ردود `view` للاعب ما فيها إجابات غيره قبل ما يرسل، وما فيها رهانات قبل القفل.
- بعد الترتيب النهائي: `select * from game_point_awards where game_id='bus_complete'` → سطر لكل لاعب موجب، وتكرار الطلبات ما بيضيفش.

## التراجع
احذف `BusCompleteGame.tsx` والأسطر الثلاثة؛ الجداول والدوال الجديدة مستقلة (`bus_complete_*` و`bc_*`) ومفيش أي حاجة قديمة اتغيّرت.

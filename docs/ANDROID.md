# تطبيق أندرويد SING & PLAY — دليل التشغيل خطوة بخطوة

التطبيق = نفس موقع الويب داخل غلاف Capacitor، ويستخدم نفس حسابات Supabase والغرف واللاعبين. نسخة الويب لا تتأثر.

## المرة الأولى

### 1) حساب GitHub وريبو عام
1. أنشئ حسابًا مجانيًا على github.com.
2. ثبّت **GitHub Desktop** (مجاني) وسجّل دخولك.
3. فك ضغط مجلد المشروع، ثم في GitHub Desktop: File ← Add local repository ← اختر المجلد (لو سألك أنشئ Repository وافق).
4. اضغط **Publish repository**، واسم الريبو `sing-and-play`، و**أزل** علامة «Keep this code private» (لازم الريبو يكون عامًا ليستطيع التطبيق تنزيل التحديثات).
   - ملف `.env.local` لن يُرفع (مستثنى تلقائيًا).

### 2) إضافة الأسرار (مرة واحدة)
في GitHub: الريبو ← Settings ← Secrets and variables ← Actions ← New repository secret. أضف 6 أسرار بالأسماء والقيم الموجودة في ملف `GitHub-Secrets-KEEP-PRIVATE.txt`:
`ANDROID_KEYSTORE_BASE64` و`ANDROID_KEYSTORE_PASSWORD` و`ANDROID_KEY_ALIAS` و`ANDROID_KEY_PASSWORD` و`VITE_SUPABASE_URL` و`VITE_SUPABASE_ANON_KEY`.

### 3) بناء أول APK
الريبو ← تبويب **Actions** ← **Android Release** ← **Run workflow**. انتظر نحو 10 دقائق. عند النجاح تجد الـAPK في تبويب **Releases**.

### 4) التثبيت على الهاتف
افتح صفحة Releases من الهاتف، نزّل `SingAndPlay-1.0.0.apk`، واسمح للمتصفح بتثبيت التطبيقات عند الطلب.

## إصدار تحديث جديد
1. على GitHub افتح `android-version.json` (أيقونة القلم) وغيّر: `versionName` (مثل `1.0.1`) و`versionCode` (**لازم رقم أكبر**، مثل `2`).
2. أضف ملفًا جديدًا `release-notes/1.0.1.md` فيه ملاحظات التحديث (سطر لكل نقطة).
3. Actions ← Android Release ← Run workflow.
4. على الهاتف: الملف الشخصي ← **التحديثات** ← **البحث عن تحديثات** ← **تحميل وتثبيت التحديث**.

> تغيير ملفات المشروع على GitHub قد يُشغّل إعادة نشر الويب على Cloudflare بنفس النتيجة، وهذا عادي. بناء الـAPK نفسه لا يلمس نشر الويب.

## مفتاح التوقيع (مهم جدًا)
- كل الإصدارات تُوقَّع بنفس المفتاح `sing-and-play-release.jks`. لو تغيّر أو ضاع لن يقبل أندرويد التحديث فوق النسخة المثبتة.
- احتفظ بنسختين من الملف وملف كلمات المرور خارج الجهاز (درايف + فلاشة). لا ترفعهما على GitHub.
- بصمة الشهادة تظهر في وصف كل Release؛ لازم تكون نفسها دائمًا.

## قائمة اختبار الهاتف (قبل النشر للناس)
1. تسجيل الدخول بحساب موجود على الويب ويظهر نفس الاسم والنقاط.
2. إنشاء غرفة والدخول من الويب والتطبيق معًا.
3. التسجيل الصوتي (يطلب إذن الميكروفون) + الطبلة + «ضبط الصوت والتزامن».
4. زر الرجوع في أندرويد.
5. التحديثات: بعد إصدار 1.0.1 جرّب الشاشة من نسخة 1.0.0.

## ملفات الأندرويد
`capacitor.config.ts` · `native/android/*` (Plugin التنزيل والتثبيت) · `scripts/android-prepare.mjs` · `scripts/make-version-json.mjs` · `.github/workflows/android-release.yml` · `android-version.json` · `release-notes/` · `src/features/updates/*`

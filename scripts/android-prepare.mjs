// يجهّز مجلد android/ (المولَّد من Capacitor): صلاحيات، Plugin التحديث، الإصدار، التوقيع، الأيقونة.
// آمن لإعادة التشغيل (idempotent). لا يمس كود الويب ولا الألعاب.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const A = join(root, 'android');
if (!existsSync(A)) throw new Error('مجلد android غير موجود — شغّل: npx cap add android');

const ver = JSON.parse(readFileSync(join(root, 'android-version.json'), 'utf8'));
if (!Number.isInteger(ver.versionCode) || ver.versionCode < 1 || !/^\d+\.\d+\.\d+$/.test(ver.versionName)) {
  throw new Error('android-version.json غير صالح (versionName مثل 1.0.1 و versionCode رقم صحيح)');
}

// 1) Plugin التحديث + MainActivity
const javaDir = join(A, 'app/src/main/java/com/singandplay/app');
mkdirSync(javaDir, { recursive: true });
for (const f of ['ApkInstallerPlugin.java', 'MainActivity.java']) copyFileSync(join(root, 'native/android', f), join(javaDir, f));

// 2) الصلاحيات
const manifestPath = join(A, 'app/src/main/AndroidManifest.xml');
let manifest = readFileSync(manifestPath, 'utf8');
for (const perm of ['INTERNET', 'RECORD_AUDIO', 'MODIFY_AUDIO_SETTINGS', 'REQUEST_INSTALL_PACKAGES']) {
  if (!manifest.includes(`android.permission.${perm}"`)) {
    manifest = manifest.replace('</manifest>', `    <uses-permission android:name="android.permission.${perm}" />\n</manifest>`);
  }
}
if (!manifest.includes('android.hardware.microphone')) {
  manifest = manifest.replace('</manifest>', '    <uses-feature android:name="android.hardware.microphone" android:required="false" />\n</manifest>');
}
if (!manifest.includes('${applicationId}.fileprovider')) throw new Error('FileProvider غير موجود في AndroidManifest (قالب Capacitor تغيّر)');
writeFileSync(manifestPath, manifest);

// 3) الإصدار + التوقيع في app/build.gradle
const gradlePath = join(A, 'app/build.gradle');
let g = readFileSync(gradlePath, 'utf8');
g = g.replace(/versionCode\s+\d+/, `versionCode ${ver.versionCode}`).replace(/versionName\s+"[^"]*"/, `versionName "${ver.versionName}"`);
if (!g.includes('// SP-SIGNING')) {
  const signing = `    // SP-SIGNING
    signingConfigs {
        release {
            def ks = System.getenv("ANDROID_KEYSTORE_PATH")
            if (ks) {
                storeFile file(ks)
                storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias System.getenv("ANDROID_KEY_ALIAS")
                keyPassword System.getenv("ANDROID_KEY_PASSWORD")
            }
        }
    }
`;
  if (!/buildTypes\s*\{\s*release\s*\{/.test(g)) throw new Error('buildTypes/release غير موجود في build.gradle (قالب Capacitor تغيّر)');
  // أولًا اربط release بالتوقيع، ثم أضف تعريف signingConfigs قبل buildTypes
  g = g.replace(/(buildTypes\s*\{\s*release\s*\{)/, (m) => `${m}\n            signingConfig signingConfigs.release`);
  g = g.replace(/(\n[ \t]*)buildTypes\s*\{/, (m) => `\n${signing}${m}`);
}
writeFileSync(gradlePath, g);

// 4) لون خلفية الأيقونة + أيقونة التطبيق (ImageMagick إن وُجد؛ الفشل غير مؤثر)
const res = join(A, 'app/src/main/res');
try {
  mkdirSync(join(res, 'values'), { recursive: true });
  writeFileSync(join(res, 'values/ic_launcher_background.xml'), '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#101412</color>\n</resources>\n');
  const src = join(root, 'public/icon-512.png');
  const sizes = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
  for (const [d, s] of Object.entries(sizes)) {
    const dir = join(res, `mipmap-${d}`);
    mkdirSync(dir, { recursive: true });
    const fg = s * 2.25;
    const inner = Math.round(fg * 0.6);
    execFileSync('convert', [src, '-resize', `${s}x${s}`, join(dir, 'ic_launcher.png')]);
    execFileSync('convert', [src, '-resize', `${s}x${s}`, join(dir, 'ic_launcher_round.png')]);
    execFileSync('convert', [src, '-resize', `${inner}x${inner}`, '-background', 'none', '-gravity', 'center', '-extent', `${fg}x${fg}`, join(dir, 'ic_launcher_foreground.png')]);
  }
  console.log('أيقونة التطبيق: تم');
} catch {
  console.log('تنبيه: تعذّر ضبط الأيقونة (ImageMagick غير متاح) — ستُستخدم الأيقونة الافتراضية');
}

console.log(`جاهز: ${ver.versionName} (versionCode ${ver.versionCode})`);

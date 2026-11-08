// ينشئ version.json (ملف الإصدار المركزي) بعد بناء الـAPK.
// الاستخدام: node scripts/make-version-json.mjs <مسار-APK> <اسم-الملف-على-GitHub>
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const [apkPath, apkName] = process.argv.slice(2);
const repo = process.env.GITHUB_REPOSITORY;
if (!apkPath || !apkName || !repo) throw new Error('استخدام: make-version-json.mjs <apk> <apk-name> مع GITHUB_REPOSITORY');

const { versionName, versionCode } = JSON.parse(readFileSync('android-version.json', 'utf8'));
const notesFile = `release-notes/${versionName}.md`;
if (!existsSync(notesFile)) throw new Error(`ملف الملاحظات غير موجود: ${notesFile}`);
const notes = readFileSync(notesFile, 'utf8').split('\n').map((l) => l.replace(/^\s*[-*•]\s*/, '').trim()).filter(Boolean);

const info = {
  versionName,
  versionCode,
  apkUrl: `https://github.com/${repo}/releases/download/android-v${versionName}/${apkName}`,
  sha256: createHash('sha256').update(readFileSync(apkPath)).digest('hex'),
  notes,
  minVersionCode: 1,
};
writeFileSync('version.json', JSON.stringify(info, null, 2) + '\n');
console.log(info);

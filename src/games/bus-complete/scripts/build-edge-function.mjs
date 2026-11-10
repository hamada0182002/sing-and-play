// يجمّع الخادم (المحرك + القاموس + المعالج) في ملف واحد جاهز للنشر: supabase/functions/bus-complete/index.ts
// التشغيل:  node scripts/build-edge-function.mjs      (محتاج esbuild: npm i -D esbuild).  الملف الناتج متضمّن في الحزمة فمش لازم تبنيه إلا لو عدّلت الكود.
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// الحزمة موجودة داخل المنصة (src/games/bus-complete) فالـEdge Function بتتولّد في supabase/functions/bus-complete بجذر المشروع
const OUT = resolve(ROOT, '../../../supabase/functions/bus-complete/index.ts');
mkdirSync(dirname(OUT), { recursive: true });
await build({
  entryPoints: [resolve(ROOT, 'server/deno-entry.js')],
  outfile: OUT,
  bundle: true, format: 'esm', platform: 'neutral', target: 'es2022', charset: 'utf8', external: ['npm:*'],
  banner: { js: '// @ts-nocheck\n// ⚠️ ملف مولَّد تلقائيًا — لا تعدّله يدويًا. المصدر: server/ و game-engine/ و data/ ...  البناء: node scripts/build-edge-function.mjs' },
});
console.log('تم: supabase/functions/bus-complete/index.ts (بجذر المشروع)');

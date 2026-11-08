// يجمّع ملفات الـEdge Function في ملف واحد جاهز للنشر: supabase/functions/who-am-i/index.ts
// (بدون أي اعتمادات: بيشتغل بـ node فقط).   التشغيل:  node scripts/build-edge-function.mjs
// بيطلّع كمان نسخة للاختبارات: supabase/functions/who-am-i/tests/.core.mjs (نفس الكود بالظبط اللي هيتنشر)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../supabase/functions/who-am-i');
// الترتيب مهم: كل ملف بعد الملفات اللي بيستوردها
const MODULES = [
  ['game/data/categories.js', 'm_categories'],
  ['game/data/characters.js', 'm_characters'],
  ['game/logic/engine.js', 'm_engine'],
  ['supabase-db.js', 'm_supabaseDb'],
  ['handler.js', 'm_handler'],
];
const VAR_OF = new Map(MODULES.map(([p, v]) => [resolve(ROOT, p), v]));

function wrap(relPath, varName) {
  const file = resolve(ROOT, relPath);
  let src = readFileSync(file, 'utf8');
  const names = [];
  src = src.replace(/^import\s+(.+?)\s+from\s+['"](.+?)['"];?[ \t]*$/gm, (m, what, spec) => {
    const target = VAR_OF.get(resolve(dirname(file), spec));
    if (!target) throw new Error(`استيراد غير معروف في ${relPath}: ${spec}`);
    if (what.startsWith('* as ')) return `const ${what.slice(5).trim()} = ${target};`;
    if (what.startsWith('{') && !/\sas\s/.test(what)) return `const ${what} = ${target};`;
    throw new Error(`شكل استيراد غير مدعوم في ${relPath}: ${m}`);
  });
  src = src.replace(/^export\s*\{([^}]*)\};?[ \t]*$/gm, (m, list) => { list.split(',').map((s) => s.trim()).filter(Boolean).forEach((n) => names.push(n)); return ''; });
  src = src.replace(/^export\s+((?:async\s+)?(?:const|let|var|function\*?|class)\s+([A-Za-z_$][\w$]*))/gm, (m, rest, name) => { names.push(name); return rest; });
  if (/^export\s/m.test(src)) throw new Error(`export غير مدعوم في ${relPath}`);
  return `// ───── ${relPath} ─────\nconst ${varName} = (() => {\n${src}\nreturn { ${[...new Set(names)].join(', ')} };\n})();\n`;
}

const body = MODULES.map(([p, v]) => wrap(p, v)).join('\n');
const header = `// @ts-nocheck
// ⚠️ ملف مولَّد تلقائياً — لا تعدّله يدوياً. المصدر: supabase/functions/who-am-i/*  والبناء: node scripts/build-edge-function.mjs
`;

const serve = `
const { createHandler } = m_handler;
const { makeSupabaseDb } = m_supabaseDb;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const sb = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});
const api = createHandler({ db: makeSupabaseDb(sb) });
const reply = (obj) => new Response(JSON.stringify(obj), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    // هوية اللاعب بتتاخد من التوكن (JWT) وبتتأكد منها السيرفر، مش من أي حاجة مكتوبة في الطلب
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\\s+/i, '');
    const { data, error } = await sb.auth.getUser(token);
    const userId = !error && data && data.user ? data.user.id : null;
    let body = null;
    try { body = await req.json(); } catch { body = null; }
    return reply(await api.handle({ userId, body }));
  } catch (err) {
    console.error('[who-am-i] fatal', err);
    return reply({ ok: false, error: { code: 'INTERNAL', message: 'حصلت مشكلة غير متوقعة' } });
  }
});
`;

writeFileSync(resolve(ROOT, 'index.ts'), `${header}import { createClient } from 'npm:@supabase/supabase-js@2';\n\n${body}${serve}`);
writeFileSync(resolve(ROOT, 'tests/.core.mjs'), `${header}\n${body}\nexport const createHandler = m_handler.createHandler;\nexport const engine = m_engine;\nexport const GAME_ID = m_handler.GAME_ID;\n`);
console.log('تم: index.ts و tests/.core.mjs  (' + relative(process.cwd(), ROOT) + ')');

// نقطة دخول الـEdge Function (Deno). بيتجمّع مع باقي الملفات في supabase/functions/bus-complete/index.ts عبر scripts/build-edge-function.mjs
import { createClient } from 'npm:@supabase/supabase-js@2';
import { makeSupabaseDb } from './supabase-db.js';
import { createEdgeApi } from './edge.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const sb = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } });
const api = createEdgeApi({ db: makeSupabaseDb(sb) });
const reply = (obj) => new Response(JSON.stringify(obj), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    // هوية اللاعب بتتاخد من التوكن (JWT) وبيتأكد منها الخادم، مش من أي حاجة مكتوبة في الطلب
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data, error } = await sb.auth.getUser(token);
    const userId = !error && data && data.user ? data.user.id : null;
    let body = null;
    try { body = await req.json(); } catch { body = null; }
    return reply(await api.handle({ userId, body }));
  } catch (err) {
    console.error('[bus-complete] fatal', err);
    return reply({ ok: false, error: { code: 'INTERNAL', message: 'حصلت مشكلة غير متوقعة' } });
  }
});

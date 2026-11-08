// اختبار «الرمش» في متصفح حقيقي (Chromium عن طريق Playwright): بيتأكد إن إعادة رسم نفس الشاشة ما بتكرّرش حركة الدخول.
// التشغيل:  NODE_PATH=$(npm root -g) node tests/who-am-i-flicker.browser.mjs [مجلد_اللعبة]
// (افتراضي: src/games/who-am-i — ولو مررت مجلد النسخة الأصلية بتشوف المشكلة القديمة)
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import * as E from '../supabase/functions/who-am-i/game/logic/engine.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = resolve(process.argv[2] || 'src/games/who-am-i');
const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

const PAGE = `<!doctype html><meta charset=utf-8><link rel=stylesheet href="/styles/who-am-i.css">
<body style="margin:0"><div id=app style="height:100vh;width:420px"></div>
<script type=module>
import { mountWhoAmI } from '/index.js';
import { GameAdapter } from '/adapters/GameAdapter.js';
class Fake extends GameAdapter {
  init() { return Promise.resolve(window.__ctx); }
  subscribe(cb) { window.__push = cb; return () => {}; }
  getView() { return null; }
  async tick() { return { ok: true }; }
}
window.__ready = mountWhoAmI(document.getElementById('app'), { adapter: new Fake(), skipIntro: true });
</script>`;

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/test.html') { res.setHeader('Content-Type', 'text/html'); return res.end(PAGE); }
  const f = join(BASE, url);
  if (!existsSync(f)) { res.statusCode = 404; return res.end('no'); }
  res.setHeader('Content-Type', MIME[extname(f)] || 'application/octet-stream');
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

// ───── نبني حالات حقيقية بالمحرك الحقيقي ─────
const T = 1_700_000_000_000, rng = E.seededRng(5), ctx = (now) => ({ rng, now });
const players = ['u1', 'u2', 'u3', 'u4'].map((id, i) => ({ id, name: `لاعب${i + 1}`, isHost: i === 0 }));
let s = E.createGame({ roomId: 'ABC123', players, existingScores: {} });
s = E.startRound(s, 'u1', ctx(T)).state;
const active = s.turn.playerId;
const viewer = players.find((p) => p.id !== active).id;
const view = (st, now) => E.projectFor(st, viewer, now);
const v1 = view(s, T + 1000);
const v1b = view(s, T + 6000);                                   // نفس الحالة بعد 5 ثواني (serverNow بس اللي اتغيّر)
s = E.submitQuestion(s, active, { targetId: viewer, text: 'هل أنا مصري؟' }, ctx(T + 7000)).state;
const v2 = view(s, T + 7000);                                    // سؤال جديد
s = E.tick(s, ctx(T + 400_000)).state;                           // الوقت خلص → مهلة التخمين
s = E.tick(s, ctx(T + 420_000)).state;                           // المهلة خلصت → شاشة الكشف
const v4 = view(s, T + 420_000);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 420, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`http://localhost:${port}/test.html`);
await page.evaluate((c) => { window.__ctx = c; }, { roomId: 'ABC123', players, currentUserId: viewer, playerName: 'x', existingScores: {}, gameSettings: {} });
await page.reload();
await page.evaluate((c) => { window.__ctx = c; }, { roomId: 'ABC123', players, currentUserId: viewer, playerName: 'x', existingScores: {}, gameSettings: {} });
// الصفحة بتقرا __ctx وقت init؛ نعيد التحميل بعد ما نحقنها
await page.addInitScript((c) => { window.__ctx = c; }, { roomId: 'ABC123', players, currentUserId: viewer, playerName: 'x', existingScores: {}, gameSettings: {} });
await page.reload();
await page.waitForFunction(() => window.__push);

// كام حركة دخول «جديدة» بدأت (عمرها < 120ms) ومين العناصر؟
const fresh = () => page.evaluate(() => document.getAnimations()
  .filter((a) => a.animationName && ['wai-in', 'wai-fade', 'wai-up', 'wai-pop', 'wai-flip'].includes(a.animationName) && a.currentTime < 120)
  .map((a) => `${a.animationName}@${a.effect.target.className.baseVal ?? a.effect.target.className}`));
const push = async (v) => { await page.evaluate((x) => window.__push(x), v); await page.waitForTimeout(30); return fresh(); };
const settle = () => page.waitForTimeout(800);

const out = {};
out['1) أول ظهور للشاشة (المفروض فيه حركة)'] = await push(v1); await settle();
out['2) نفس الحالة تاني بعد 5 ثواني (المفروض ولا حركة)'] = await push(v1b); await settle();
out['3) سؤال جديد (المفروض حركة السؤال/النافذة الجديدة، مش الشاشة)'] = await push(v2); await settle();
out['4) نفس الحالة تاني (المفروض ولا حركة)'] = await push(v2); await settle();
out['5) الدور خلص → شاشة الكشف (المفروض حركة الشاشة الجديدة)'] = await push(v4); await settle();
out['6) الكشف تاني (المفروض ولا حركة)'] = await push(v4);

let bad = 0;
const expect = (k, pred, why) => { const ok = pred(out[k]); if (!ok) bad++; console.log(`${ok ? '✅' : '❌'} ${k}\n     ${JSON.stringify(out[k])}${ok ? '' : '   ← ' + why}`); };
expect('1) أول ظهور للشاشة (المفروض فيه حركة)', (a) => a.length > 0, 'مفروض فيه حركة');
expect('2) نفس الحالة تاني بعد 5 ثواني (المفروض ولا حركة)', (a) => a.length === 0, 'الشاشة رمشت');
expect('3) سؤال جديد (المفروض حركة السؤال/النافذة الجديدة، مش الشاشة)', (a) => a.length > 0 && a.every((x) => !x.startsWith('wai-in@wai-screen')), 'الشاشة كلها اتحركت تاني');
expect('4) نفس الحالة تاني (المفروض ولا حركة)', (a) => a.length === 0, 'الشاشة رمشت');
expect('5) الدور خلص → شاشة الكشف (المفروض حركة الشاشة الجديدة)', (a) => a.length > 0, 'مفروض حركة');
expect('6) الكشف تاني (المفروض ولا حركة)', (a) => a.length === 0, 'الشاشة رمشت');
// الحركات المستمرة (دوران الأسطوانة / النبض): لازم تكمّل من مكانها مع إعادة الرسم، مش ترجع للصفر
await push(v1); await settle();
const spinProgress = () => page.evaluate(() => {
  const a = document.getAnimations().find((x) => x.animationName === 'wai-spin' || x.animationName === 'wai-pulse');
  return a ? { name: a.animationName, p: a.effect.getComputedTiming().progress } : null;
});
const before = await spinProgress();
await page.evaluate((x) => window.__push(x), v1b); await page.waitForTimeout(40);
const after = await spinProgress();
if (before && after) {
  const d = Math.abs(((after.p - before.p) % 1 + 1.5) % 1 - 0.5);   // أقصر مسافة على الدايرة
  const ok = d < 0.06;
  if (!ok) bad++;
  console.log(`${ok ? '✅' : '❌'} 7) حركة مستمرة (${before.name}) متصلة: قبل=${before.p.toFixed(3)} بعد=${after.p.toFixed(3)} فرق=${d.toFixed(3)}`);
} else console.log('ℹ️ 7) مفيش حركة مستمرة على الشاشة دي');
if (errors.length) { bad++; console.log('❌ أخطاء في الصفحة:', errors); }

await browser.close(); server.close();
console.log(bad ? `\n❌ فشل (${bad})` : '\n✅ مفيش رمش');
process.exit(bad ? 1 : 0);

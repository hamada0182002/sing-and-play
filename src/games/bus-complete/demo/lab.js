import { mountBusComplete } from '../index.js';
import { LocalAdapter, createLocalHub } from '../local.js';
import { runBot } from './bots.js';

const params = new URLSearchParams(location.search);
const solo = params.get('solo') === '1';
const multi = params.get('multi') === '1';           // تابات متعددة عبر localStorage
const as = params.get('as');
const NAMES = ['أحمد', 'سارة', 'منى', 'يوسف', 'نور', 'كريم', 'هدى', 'عمر', 'ليلى', 'زياد'];
const count = Math.max(3, Math.min(10, Number(params.get('n') || 5)));
const members = NAMES.slice(0, count).map((name, i) => ({ id: `u${i + 1}`, name }));
const hub = createLocalHub({ roomId: 'demo-room', members, adminId: 'u1', persist: multi ? 'localStorage' : 'memory', existingScores: Object.fromEntries(members.map((m, i) => [m.id, 100 + i * 40])) });
window.__hub = hub;
if (solo) document.body.classList.add('solo');

const grid = document.getElementById('grid');
const adapters = {};
const log = [];
const show = as ? members.filter((m) => m.id === as) : (multi ? [members[0]] : members);
for (const m of show) {
  const phone = document.createElement('div'); phone.className = 'lab-phone'; phone.dataset.user = m.id;
  const tag = document.createElement('div'); tag.className = 'lab-tag'; tag.textContent = `${m.name}${m.id === 'u1' ? ' (أدمن)' : ''}`;
  phone.append(tag); grid.append(phone);
  const adapter = new LocalAdapter(hub, m.id);
  adapters[m.id] = adapter;
  mountBusComplete(phone, { adapter, onEvent: (n, p) => { log.push([m.id, n, p]); }, skipEntry: false, skipQuestionIntro: params.get('intro') !== '1' });
}
window.__adapters = adapters; window.__log = log;

// البوتات: بتلعب مكان اللاعبين اللي انت مش بتلعب بيهم (بدون الأدمن u1)
const botIds = new Set((params.get('bots') || (multi || solo ? '' : members.slice(1).map((m) => m.id).join(','))).split(',').filter(Boolean));
const botAdapters = {};
function botAdapter(id) { return botAdapters[id] ||= new LocalAdapter(hub, id); }
let botTimer = null;
function startBots() { stopBots(); botTimer = setInterval(() => { for (const id of botIds) { const a = adapters[id] || botAdapter(id); if (!a.getView()) { a.init(); } else runBot(a); } }, 900); }
function stopBots() { clearInterval(botTimer); botTimer = null; }
window.__botIds = botIds; window.__stopBots = stopBots;
if (params.get('autobots') === '1') startBots();

const bar = document.getElementById('bar');
bar.append(Object.assign(document.createElement('b'), { textContent: 'أتوبيس كومبليت — Lab' }));
const lbl = document.createElement('label'); lbl.textContent = 'بوتات:';
bar.append(lbl);
for (const m of members.slice(1)) {
  const l = document.createElement('label'); const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = botIds.has(m.id);
  cb.onchange = () => { cb.checked ? botIds.add(m.id) : botIds.delete(m.id); }; l.append(cb, m.name); bar.append(l);
}
const run = document.createElement('button'); run.textContent = 'شغّل البوتات'; run.onclick = () => { if (botTimer) { stopBots(); run.textContent = 'شغّل البوتات'; } else { startBots(); run.textContent = 'أوقف البوتات'; } };
const reset = document.createElement('button'); reset.textContent = 'ابدأ من الأول'; reset.onclick = () => { hub.reset(); location.reload(); };
bar.append(run, reset);

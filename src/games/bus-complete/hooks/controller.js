// الـ controller: يربط الـadapter بالشاشات. إعادة رسم كاملة مع استرجاع التركيز، ومؤقتات من ساعة الخادم.
import { h, clear, icon, ar, mmss, secs } from '../components/dom.js';
import { Toast, Sheet, Button, RING_C } from '../components/ui.js';
import { IntroScreen } from '../screens/IntroScreen.js';
import { WaitingScreen, AdminSettingsScreen, ConfirmScreen } from '../screens/Lobby.js';
import { QuestionScreen, QuestionOverScreen, QuestionIntro } from '../screens/QuestionScreen.js';
import { AdminReviewScreen, ResultsScreen, WagerScreen, StandingsScreen } from '../screens/ResultsScreens.js';
import { AdminDrawer } from '../admin/AdminDrawer.js';

export function createController(container, { adapter, onExit, skipIntro = false, skipEntry = skipIntro, skipQuestionIntro = true, introMs = 2600 } = {}) {
  const root = h('div', { class: 'bc-root', dir: 'rtl', lang: 'ar' });
  container.appendChild(root);
  const ui = { entered: skipEntry, draft: {}, pendingPoints: null, pendingDouble: null, pendingWager: null, introSeen: null, sheet: null, toast: null, adminOpen: false, newCat: '' };
  let view = null; let offset = 0; let destroyed = false; let toastT = null; let introT = null;
  const inflight = new Set(); const ticked = new Set();

  function toast(msg) { ui.toast = msg; clearTimeout(toastT); toastT = setTimeout(() => { ui.toast = null; render(); }, 2800); render(); }

  async function act(name, ...args) {
    const key = name + JSON.stringify(args);
    if (inflight.has(key)) return { ok: false, error: { code: 'BUSY' } };      // يمنع الضغط المتكرر
    inflight.add(key);
    try {
      const fn = adapter[name]; if (typeof fn !== 'function') throw new Error(`unknown command ${name}`);
      const r = await fn.apply(adapter, args);
      if (!r.ok && r.error) toast(r.error.message || 'حصلت مشكلة، جرّب تاني');
      return r;
    } catch (e) { toast('مفيش اتصال، جرّب تاني'); return { ok: false, error: { code: 'NETWORK' } }; }
    finally { inflight.delete(key); }
  }

  const c = {
    get view() { return view; }, ui, act, toast, onExit, render,
    enter() { ui.entered = true; render(); },
    openSheet(node) { ui.sheet = node; render(); }, closeSheet() { ui.sheet = null; render(); },
    dismissIntro() { clearTimeout(introT); ui.introSeen = introKey(); render(); },
    confirmEnd() {
      c.openSheet(Sheet({ title: 'تنهي الجولة دلوقتي؟', onClose: () => c.closeSheet(), children: [
        h('div', { class: 'bc-note bc-note--warn' }, 'هتظهر النتيجة النهائية من الأسئلة المعتمدة بس. مينفعش ترجع.'),
        h('div', { class: 'bc-row' }, Button('أيوه، أنهِ', { variant: 'brick', block: true, onClick: () => { c.closeSheet(); act('endRound'); } }), Button('لأ', { variant: 'dark', onClick: () => c.closeSheet() }))] }));
    },
  };

  const introKey = () => (view && view.question && view.phase === 'question') ? `${view.roundNo}:${view.question.no}` : null;
  function needIntro() { const k = introKey(); return !!k && !skipQuestionIntro && ui.introSeen !== k; }

  function screen() {
    const v = view;
    if (!ui.entered && v.phase === 'lobby') return IntroScreen(c);
    switch (v.phase) {
      case 'lobby': return v.isAdmin ? AdminSettingsScreen(c) : WaitingScreen(c);
      case 'confirm': return ConfirmScreen(c);
      case 'question': return QuestionScreen(c);
      case 'review': return v.isAdmin && v.admin.reviews[v.question.no] ? AdminReviewScreen(c) : QuestionOverScreen(c);
      case 'results': return ResultsScreen(c);
      case 'wager': return WagerScreen(c);
      case 'standings': return StandingsScreen(c);
      default: return h('div', { class: 'bc-screen' }, 'حالة غير معروفة');
    }
  }

  let lastScreenKey = '';
  function render() {
    if (destroyed || !view) return;
    const ae = document.activeElement; let focusKey = null; let sel = null;
    if (ae && root.contains(ae) && ae.getAttribute && ae.getAttribute('data-bc-key')) { focusKey = ae.getAttribute('data-bc-key'); try { sel = [ae.selectionStart, ae.selectionEnd]; } catch { /* ignore */ } }
    const scrollEl = root.querySelector('.bc-screen'); const sc = scrollEl ? scrollEl.scrollTop : 0;
    const sKey = `${view.phase}:${view.question ? view.question.no : ''}`;
    const sameScreen = sKey === lastScreenKey; lastScreenKey = sKey;
    clear(root);
    const scr = screen();
    if (sameScreen) scr.classList.add('bc-still');
    root.appendChild(scr);
    if (sameScreen && sc) scr.scrollTop = sc;
    if (view.isAdmin && view.phase !== 'lobby' && view.phase !== 'standings' && view.admin) {
      root.appendChild(h('button', { class: 'bc-fab', type: 'button', 'aria-label': 'لوحة الأدمن', onClick: () => { ui.adminOpen = true; render(); } }, icon('shield', 26)));
    }
    if (needIntro()) root.appendChild(QuestionIntro(c));
    if (ui.adminOpen && view.admin) root.appendChild(AdminDrawer(c));
    if (ui.sheet) root.appendChild(ui.sheet);
    if (ui.toast) root.appendChild(Toast(ui.toast));
    if (focusKey) {
      const el = root.querySelector(`[data-bc-key="${focusKey}"]`);
      if (el) { el.focus({ preventScroll: true }); try { if (sel && sel[0] != null) el.setSelectionRange(sel[0], sel[1]); } catch { /* ignore */ } }
    }
    paintTimers();
  }

  function nowServer() { return Date.now() + offset; }

  function paintTimers() {
    if (!view) return;
    const now = nowServer();
    root.querySelectorAll('[data-bc-time]').forEach((el) => {
      const end = Number(el.getAttribute('data-bc-time')); const left = end - now;
      const txt = el.getAttribute('data-bc-fmt') === 'mmss' ? mmss(left) : secs(left);
      if (el.textContent !== txt) el.textContent = txt;
      el.classList.toggle('is-low', left <= 5000 && left > 0);
    });
    root.querySelectorAll('[data-bc-arc]').forEach((el) => {
      const end = Number(el.getAttribute('data-bc-end')); const total = Number(el.getAttribute('data-bc-total')) || 1;
      const p = Math.max(0, Math.min(1, (end - now) / total));
      el.setAttribute('stroke-dashoffset', (RING_C * (1 - p)).toFixed(1));
      const vin = el.closest('.bc-vinyl'); if (vin) vin.classList.toggle('is-low', end - now <= 5000);
    });
    root.querySelectorAll('[data-bc-bar]').forEach((el) => {
      const end = Number(el.getAttribute('data-bc-end')); const total = Number(el.getAttribute('data-bc-total')) || 1;
      const p = Math.max(0, Math.min(1, (end - now) / total));
      el.style.transform = `scaleX(${p})`; el.classList.toggle('is-low', end - now <= 5000);
    });
    // الوقت انتهى عندنا: نطلب من الخادم يفحص (مرة لكل موعد). الخادم هو الحَكَم.
    const ends = [view.phaseEndsAt, view.question && view.phase === 'question' ? view.question.endsAt : null, view.wager ? view.wager.endsAt : null].filter(Boolean);
    for (const e of ends) if (now >= e + 200 && !ticked.has(e)) { ticked.add(e); adapter.tick().catch(() => {}); }
  }

  const timer = setInterval(paintTimers, 250);
  const unsub = adapter.subscribe((nv) => {
    const prevNo = introKey();
    view = nv; offset = nv.serverNow - Date.now();
    if (nv.phase !== 'wager') ui.pendingWager = null;
    if (nv.question && nv.question.mine && nv.question.mine.points != null) ui.pendingPoints = null;
    { const k = nv.question ? `${nv.roundNo}:${nv.question.no}` : null; if (ui.qKey !== k) { ui.qKey = k; ui.pendingPoints = null; ui.pendingDouble = null; } }
        if (nv.phase !== 'lobby') ui.entered = true;
    if (needIntro()) { clearTimeout(introT); const k = introKey(); introT = setTimeout(() => { if (introKey() === k) { ui.introSeen = k; render(); } }, introMs); }
    render();
  });

  return { destroy() { destroyed = true; clearInterval(timer); clearTimeout(toastT); clearTimeout(introT); try { unsub && unsub(); } catch { /* ignore */ } adapter.destroy(); if (root.parentNode) root.parentNode.removeChild(root); } };
}

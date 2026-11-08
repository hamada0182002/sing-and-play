// المتحكّم: يربط الواجهة بالـ GameAdapter فقط. لا يعرف شيئًا عن Supabase أو قواعد الاحتساب.
import { h } from '../components/dom.js';
import { Toast, RING_C } from '../components/ui.js';
import { IntroScreen } from '../screens/intro.js';
import { LobbyScreen } from '../screens/lobby.js';
import { TurnScreen } from '../screens/turn.js';
import { GuessScreen, GuessResultScreen } from '../screens/guess.js';
import { RevealScreen, TransitionScreen } from '../screens/reveal.js';
import { FinalScreen, NewRoundScreen } from '../screens/final.js';

const PHASE = { LOBBY: 'lobby', TURN: 'turn', REVEAL: 'reveal', TRANSITION: 'transition', FINAL: 'final' };

// العناصر اللي ليها حركة دخول مرة واحدة (انظر styles/who-am-i.css)
const ONE_SHOT = ['.wai-screen', '.wai-qa', '.wai-sheet-wrap', '.wai-sheet', '.wai-result', '.wai-result__card', '.wai-toast', '.wai-reveal-card__in'];

export class WhoAmIController {
  constructor(container, adapter, { onEvent, onExit, skipIntro } = {}) {
    this.container = container;
    this.adapter = adapter;
    this.onExit = onExit;
    this.skipIntro = !!skipIntro;
    this.offset = 0;
    this.view = null;
    this.ui = { screen: 'intro', sheet: null, targetId: null, draft: '', choice: null, guessResult: null, answering: null, toast: null, focusCompose: false };
    this.root = h('div', { class: 'wai-root', dir: 'rtl', lang: 'ar' });
    container.appendChild(this.root);
    this._unsubEvents = onEvent ? adapter.on('*', onEvent) : null;
    this._lastTick = 0;
  }

  async start() {
    this.ctx = await this.adapter.init();
    this._unsub = this.adapter.subscribe((v) => this.onView(v));
    this._timer = setInterval(() => this.updateTimers(), 250);
  }

  now() { return Date.now() + this.offset; }

  // ───── استقبال الحالة ─────
  onView(view) {
    this.offset = view.serverNow - Date.now();
    let prev = this.view;
    if (prev && prev.viewerId !== view.viewerId) {
      Object.assign(this.ui, { sheet: null, targetId: null, draft: '', choice: null, guessResult: null, answering: null });
      prev = null; // نتعامل معها كأنها أول عرض لهذا اللاعب
    }
    this.view = view;
    if (prev && prev.turn && view.turn && prev.turn.turnNo !== view.turn.turnNo) {
      Object.assign(this.ui, { sheet: null, targetId: null, draft: '', choice: null, guessResult: null, answering: null });
    }
    if (view.phase !== PHASE.TURN) Object.assign(this.ui, { sheet: null, choice: null, answering: null });
    if (view.phase !== PHASE.TURN && view.phase !== PHASE.REVEAL) this.ui.guessResult = null;
    if (!prev && (this.skipIntro || view.phase !== PHASE.LOBBY)) this.ui.screen = null;
    if (view.phase === PHASE.TURN || view.phase === PHASE.REVEAL || view.phase === PHASE.TRANSITION) this.ui.screen = null;

    // نتيجة التخمين (شاشة ١٠) — تظهر لصاحب الدور فقط
    const t = view.turn;
    const pt = prev && prev.turn;
    if (t && pt && t.turnNo === pt.turnNo && t.playerId === view.viewerId && t.attempts.length > pt.attempts.length) {
      const a = t.attempts[t.attempts.length - 1];
      this.ui.choice = null;
      this.ui.guessResult = {
        correct: a.correct, choice: a.choice, n: a.n, points: t.points,
        left: view.settings.maxGuesses - t.attempts.length, exhausted: !a.correct && t.attempts.length >= view.settings.maxGuesses,
        final: !!t.finalGuess,
      };
      clearTimeout(this._grTimer);
      // في مهلة الوقت الإضافي النتيجة الغلط بتختفي بسرعة عشان يلحق يختار تاني
      this._grTimer = setTimeout(() => this.setUi({ guessResult: null }), a.correct ? 3200 : (t.finalGuess ? 1400 : 3800));
    }
    // بدأت مهلة التخمين: نقفل أي ورقة مفتوحة (اختيار لاعب/كتابة سؤال)
    if (t && pt && t.turnNo === pt.turnNo && t.finalGuess && !pt.finalGuess) Object.assign(this.ui, { sheet: null, draft: '' });
    // اهتزاز خفيف عند وصول سؤال موجّه لك
    const q = t && t.questions.find((x) => x.status === 'pending' && x.targetId === view.viewerId);
    if (q && !(pt && pt.questions.some((x) => x.id === q.id)) && navigator.vibrate) { try { navigator.vibrate(120); } catch { /* ignore */ } }
    this.render();
  }

  setUi(patch) { Object.assign(this.ui, patch); this.render(); }

  async act(promise) {
    const r = await promise;
    if (r && !r.ok) this.toast(r.error ? r.error.message : 'حصلت مشكلة');
    return r;
  }

  toast(text) {
    this.ui.toast = text; this.render();
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { this.ui.toast = null; this.render(); }, 2600);
  }

  // ───── الرسم ─────
  render() {
    if (!this.view) return;
    const ta = this.root.querySelector('textarea');
    const hadFocus = ta && document.activeElement === ta;
    const sel = ta ? [ta.selectionStart, ta.selectionEnd] : null;
    const logEl = this.root.querySelector('.wai-log');
    const atBottom = !logEl || logEl.scrollHeight - logEl.scrollTop - logEl.clientHeight < 40;
    const prevScroll = logEl ? logEl.scrollTop : 0;

    // عدد العناصر المتحرّكة الموجودة قبل إعادة الرسم (عشان ما نكرّرش حركتها: ده سبب «الرمش»)
    const before = ONE_SHOT.map((sel) => this.root.querySelectorAll(sel).length);
    const prevKey = this._lastScreenKey;

    const layers = [this.pickScreen()];
    if (this.ui.guessResult) layers.push(GuessResultScreen(this));
    if (this.ui.toast) layers.push(Toast(this.ui.toast));
    // الحركات المستمرة (دوران الأسطوانة والنبض) بتتزامن مع الساعة، فمبتبدأش من الصفر مع كل رسم
    const nowMs = Date.now();
    this.root.style.setProperty('--wai-d9', `-${nowMs % 9000}ms`);
    this.root.style.setProperty('--wai-d1', `-${nowMs % 1000}ms`);
    this.root.replaceChildren(...layers);
    if (prevKey === this._screenKey) {
      // نفس الشاشة: اللي كان ظاهر قبل كده يفضل ثابت، وبس العنصر الجديد (سؤال جديد، نافذة جديدة...) يتحرّك
      ONE_SHOT.forEach((sel, i) => {
        const els = this.root.querySelectorAll(sel);
        for (let j = 0; j < Math.min(before[i], els.length); j++) els[j].classList.add('wai-still');
      });
    }
    this._lastScreenKey = this._screenKey;

    const ta2 = this.root.querySelector('textarea');
    if (ta2 && (hadFocus || this.ui.focusCompose)) {
      ta2.focus();
      if (sel && hadFocus) ta2.setSelectionRange(sel[0], sel[1]);
      this.ui.focusCompose = false;
    }
    const log2 = this.root.querySelector('.wai-log');
    if (log2) log2.scrollTop = atBottom ? log2.scrollHeight : prevScroll;
    this.updateTimers();
  }

  // مفتاح الشاشة (اسمها + الجولة + الدور): لو ما اتغيّرش يبقى إعادة الرسم لنفس الشاشة، فما نكرّرش حركة الدخول
  _pick(name, el) {
    const v = this.view;
    this._screenKey = `${name}:${v.roundNo ?? ''}:${v.turn ? v.turn.turnNo : ''}`;
    return el;
  }

  pickScreen() {
    const { view, ui } = this;
    if (ui.screen === 'intro') return this._pick('intro', IntroScreen(this));
    if (ui.screen === 'newround') return this._pick('newround', NewRoundScreen(this));
    switch (view.phase) {
      case PHASE.LOBBY: return this._pick('lobby', LobbyScreen(this));
      case PHASE.TURN:
        if (view.turn.playerId === view.viewerId && view.turn.guessOptions) return this._pick('guess', GuessScreen(this));
        return this._pick('turn', TurnScreen(this));
      case PHASE.REVEAL: return this._pick('reveal', RevealScreen(this));
      case PHASE.TRANSITION: return this._pick('transition', TransitionScreen(this));
      case PHASE.FINAL: return this._pick('final', FinalScreen(this));
      default: return this._pick('empty', h('div'));
    }
  }

  // ───── المؤقتات (بدون إعادة رسم كامل) ─────
  updateTimers() {
    const v = this.view; if (!v) return;
    const now = this.now();
    if (v.phase === PHASE.TURN && v.turn) {
      // مهلة التخمين بعد انتهاء الوقت (finalGuess): الحلقة والعدّاد بيحسبوا من ١٠ ثواني
      const total = (v.turn.finalGuess ? (v.settings.finalGuessSeconds || 10) : v.settings.turnSeconds) * 1000;
      const rem = Math.max(0, v.turn.endsAt - now);
      const low = v.turn.finalGuess || rem <= 30000;
      this.root.querySelectorAll('[data-wai-time]').forEach((el) => {
        const s = Math.ceil(rem / 1000);
        el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`.replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
        el.classList.toggle('is-low', low);
      });
      this.root.querySelectorAll('[data-wai-arc]').forEach((el) => {
        el.setAttribute('stroke-dashoffset', (RING_C * (1 - rem / total)).toFixed(1));
        el.parentNode.parentNode.classList.toggle('is-low', low);
      });
      if (rem <= 0) this.pokeServer();
    } else if ((v.phase === PHASE.REVEAL || v.phase === PHASE.TRANSITION) && v.phaseEndsAt) {
      const total = (v.phase === PHASE.REVEAL ? v.settings.revealSeconds : v.settings.transitionSeconds) * 1000;
      const rem = Math.max(0, v.phaseEndsAt - now);
      this.root.querySelectorAll('[data-wai-bar]').forEach((el) => { el.style.transform = `scaleX(${(rem / total).toFixed(3)})`; });
      this.root.querySelectorAll('[data-wai-count]').forEach((el) => {
        el.textContent = String(Math.max(1, Math.ceil(rem / 1000))).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
      });
      if (rem <= 0) this.pokeServer();
    }
  }

  pokeServer() {
    const t = Date.now();
    if (t - this._lastTick < 1000) return; // لا نكرر الطلب أكثر من مرة في الثانية
    this._lastTick = t;
    this.adapter.tick();
  }

  destroy() {
    clearInterval(this._timer); clearTimeout(this._grTimer); clearTimeout(this._toastTimer);
    if (this._unsub) this._unsub();
    if (this._unsubEvents) this._unsubEvents();
    this.root.remove();
  }
}

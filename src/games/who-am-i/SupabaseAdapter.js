// SupabaseAdapter — بيربط لعبة «أنا مين؟» بخادم SING & PLAY (Supabase Edge Function اسمها who-am-i).
// - كل القرارات والحماية على الخادم. الواجهة بتبعت أوامر وتستقبل «نسختها الآمنة» بس (من غير الشخصية السرية لصاحب الدور).
// - التحديث اللحظي: جدول who_am_i_signal بيتغيّر مع كل تغيير → كل لاعب يطلب نسخته. + استعلام دوري احتياطي.
// - بياخد عميل Supabase من برّه (مفيش import لـ lib/supabase) عشان يتجرّب بسهولة.
import { GameAdapter } from './adapters/GameAdapter.js';

const NETWORK_ERROR = { code: 'NETWORK', message: 'مشكلة في الاتصال، جرّب تاني' };

export class SupabaseAdapter extends GameAdapter {
  /**
   * @param {string} roomId  رقم الغرفة (UUID) في SING & PLAY
   * @param {*} supabase     عميل supabase-js بتاع اللاعب المسجّل دخوله
   * @param {{pollMs?:number, safetyTickMs?:number}} [options]
   */
  constructor(roomId, supabase, { pollMs = 10000, safetyTickMs = 15000 } = {}) {
    super();
    this.roomId = roomId;
    this.sb = supabase;
    this.pollMs = pollMs;
    this.safetyTickMs = safetyTickMs;
    this._view = null;
    this._sig = '';
    this._cb = null;
    this._channel = null;
    this._timers = [];
    this._cleanups = [];
    this._destroyed = false;
    this._refreshing = false;
    this._again = false;
  }

  async _invoke(action, params = {}) {
    try {
      const { data, error } = await this.sb.functions.invoke('who-am-i', { body: { ...params, roomId: this.roomId, action } });
      if (error || !data) return { ok: false, error: NETWORK_ERROR };
      return data;
    } catch {
      return { ok: false, error: NETWORK_ERROR };
    }
  }

  async init() {
    const r = await this._invoke('init');
    if (!r.ok) throw new Error(r.error ? r.error.message : NETWORK_ERROR.message);
    return r.data;
  }

  _push(view) {
    if (this._destroyed || !view) return;
    const cur = this._view;
    if (cur && cur.viewerId === view.viewerId && view.version < cur.version) return; // رد قديم وصل متأخر
    // الشاشة بتتعاد رسمها من الأول مع كل نسخة (وبتعمل حركة دخول)، فلو النسخة ما اتغيّرتش غير في serverNow ما نبعتهاش
    // (ده بيمنع «الرمش»: رد الأمر + الإشارة اللحظية + الاستعلام الدوري كلهم بيجيبوا نفس الحالة)
    const sig = JSON.stringify(view, (k, v) => (k === 'serverNow' ? undefined : v));
    if (cur && sig === this._sig) return;
    this._sig = sig;
    this._view = view;
    if (this._cb) this._cb(view);
  }

  async _refresh() {
    if (this._destroyed) return;
    if (this._refreshing) { this._again = true; return; }
    this._refreshing = true;
    try {
      const r = await this._invoke('view');
      if (r.ok && r.view) this._push(r.view);
    } finally {
      this._refreshing = false;
      if (this._again && !this._destroyed) { this._again = false; void this._refresh(); }
    }
  }

  subscribe(cb) {
    this._cb = cb;
    const refresh = () => { void this._refresh(); };
    refresh();
    this._channel = this.sb
      .channel(`wai-signal:${this.roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'who_am_i_signal', filter: `room_id=eq.${this.roomId}` }, refresh)
      .subscribe();
    this._timers.push(setInterval(refresh, this.pollMs));                    // احتياطي لو الاتصال اللحظي اتقطع
    this._timers.push(setInterval(() => { void this.tick(); }, this.safetyTickMs)); // يخلّص الأدوار المنتهية حتى لو محدش ضغط
    if (typeof document !== 'undefined') {
      const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
      document.addEventListener('visibilitychange', onVisible);
      window.addEventListener('online', refresh);
      this._cleanups.push(() => { document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('online', refresh); });
    }
    return () => this._teardown();
  }

  getView() { return this._view; }

  async _command(action, params) {
    const r = await this._invoke(action, params);
    if (r.ok && r.view) this._push(r.view);
    return r.ok ? { ok: true } : { ok: false, error: r.error || NETWORK_ERROR };
  }

  startRound() { return this._command('startRound'); }
  submitQuestion({ targetId, text }) { return this._command('submitQuestion', { targetId, text }); }
  cancelQuestion({ questionId }) { return this._command('cancelQuestion', { questionId }); }
  submitAnswer({ questionId, answer }) { return this._command('submitAnswer', { questionId, answer }); }
  requestGuess() { return this._command('requestGuess'); }
  cancelGuess() { return this._command('cancelGuess'); }
  submitGuess({ choiceId }) { return this._command('submitGuess', { choiceId }); }
  tick() { return this._command('tick'); }
  advance() { return this._command('advance'); }

  _teardown() {
    for (const t of this._timers) clearInterval(t);
    this._timers = [];
    for (const f of this._cleanups) f();
    this._cleanups = [];
    if (this._channel) {
      try { void this.sb.removeChannel(this._channel); } catch { /* مش مشكلة */ }
      this._channel = null;
    }
  }

  destroy() {
    this._destroyed = true;
    this._teardown();
    this._cb = null;
  }
}

// SupabaseAdapter — يربط اللعبة بخادم SING & PLAY (Supabase Edge Function اسمها bus-complete).
// - كل القرارات والحماية على الخادم. الواجهة بتبعت أوامر وتستقبل «نسختها الآمنة» بس.
// - التحديث اللحظي: جدول bus_complete_signal بيتغيّر مع كل تغيير → كل لاعب يطلب نسخته. + استعلام دوري احتياطي.
// - يأخذ عميل Supabase من برّه (مفيش import لـ lib/supabase) عشان يتجرّب بسهولة.
// - كل أمر بيتبعت معاه requestId فريد: لو الشبكة أعادت الطلب الخادم ما ينفذوش مرتين.
import { GameAdapter } from './GameAdapter.js';

const NETWORK_ERROR = { code: 'NETWORK', message: 'مشكلة في الاتصال، جرّب تاني' };
let _seq = 0;
const newRequestId = () => `${Date.now().toString(36)}-${(++_seq).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export class SupabaseAdapter extends GameAdapter {
  /**
   * @param {string} roomId  رقم الغرفة (UUID) في SING & PLAY
   * @param {*} supabase     عميل supabase-js بتاع اللاعب المسجّل دخوله
   * @param {{pollMs?:number, safetyTickMs?:number, functionName?:string, signalTable?:string}} [options]
   */
  constructor(roomId, supabase, { pollMs = 8000, safetyTickMs = 5000, functionName = 'bus-complete', signalTable = 'bus_complete_signal' } = {}) {
    super();
    this.roomId = roomId;
    this.sb = supabase;
    this.pollMs = pollMs;
    this.safetyTickMs = safetyTickMs;
    this.fn = functionName;
    this.signalTable = signalTable;
    this._channel = null;
    this._timers = [];
    this._cleanups = [];
    this._refreshing = false;
    this._again = false;
  }

  async _invoke(action, params = {}, requestId) {
    try {
      const { data, error } = await this.sb.functions.invoke(this.fn, { body: { params, roomId: this.roomId, action, requestId } });
      if (error || !data) return { ok: false, error: NETWORK_ERROR };
      return data;
    } catch {
      return { ok: false, error: NETWORK_ERROR };
    }
  }

  async init() {
    const r = await this._invoke('init');
    if (!r.ok) throw new Error(r.error ? r.error.message : NETWORK_ERROR.message);
    if (r.view) this._push(r.view);
    return r.data;
  }

  async _command(action, params = {}) {
    // نفس requestId لو أعدنا المحاولة بسبب خطأ شبكة
    const requestId = newRequestId();
    let r = await this._invoke(action, params, requestId);
    if (!r.ok && r.error && r.error.code === 'NETWORK') r = await this._invoke(action, params, requestId);
    if (r.view) this._push(r.view);
    return r.ok ? { ok: true, view: r.view } : { ok: false, error: r.error || NETWORK_ERROR };
  }

  async _refresh() {
    if (this._destroyed) return;
    if (this._refreshing) { this._again = true; return; }
    this._refreshing = true;
    try { const r = await this._invoke('view'); if (r.ok && r.view) this._push(r.view); } finally {
      this._refreshing = false;
      if (this._again && !this._destroyed) { this._again = false; void this._refresh(); }
    }
  }

  subscribe(cb) {
    this._cb = cb;
    const refresh = () => { void this._refresh(); };
    refresh();
    this._channel = this.sb
      .channel(`bc-signal:${this.roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: this.signalTable, filter: `room_id=eq.${this.roomId}` }, refresh)
      .subscribe();
    this._timers.push(setInterval(refresh, this.pollMs));                         // احتياطي لو الاتصال اللحظي اتقطع
    this._timers.push(setInterval(() => { void this.tick(); }, this.safetyTickMs)); // يقفل الأسئلة المنتهية حتى لو محدش ضغط
    if (typeof document !== 'undefined') {
      const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
      document.addEventListener('visibilitychange', onVisible);
      window.addEventListener('online', refresh);
      this._cleanups.push(() => { document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('online', refresh); });
    }
    return () => this._teardown();
  }

  _teardown() {
    for (const t of this._timers) clearInterval(t);
    this._timers = [];
    for (const c of this._cleanups) c();
    this._cleanups = [];
    if (this._channel) { try { this.sb.removeChannel(this._channel); } catch { /* ignore */ } this._channel = null; }
    this._cb = null;
  }

  destroy() { super.destroy(); this._teardown(); }
}

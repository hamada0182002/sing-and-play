// ───────────────────────────────────────────────────────────────
// GameAdapter — الواجهة الوحيدة بين «أتوبيس كومبليت» ومنصة SING & PLAY.
// الواجهة (screens/components) لا تعرف أي شيء عن Supabase أو الغرف. تتكلم مع هذا العقد فقط.
//
// داخل (المنصة → اللعبة):
//   init() ترجع: { roomId, players:[{id,name,isHost?}], currentUserId, playerName, existingScores:{[userId]:number}, gameSettings }
//   subscribe(cb) تستدعي cb(view) كلما تغيّرت الحالة. view = نتيجة projectFor() الخاصة بهذا اللاعب فقط.
//
// خارج (اللعبة → المنصة): on(eventName, handler) / on('*', handler)
//   gameStarted · questionStarted · answerSubmitted · cardUsed · questionApproved · scoreUpdated · finalWagerLocked · roundCompleted
//
// الأوامر: كلها ترجع Promise<{ ok:true, view } | { ok:false, error:{code,message} }>
// ───────────────────────────────────────────────────────────────

export const PLATFORM_EVENTS = [
  'gameStarted', 'questionStarted', 'answerSubmitted', 'cardUsed',
  'questionApproved', 'scoreUpdated', 'finalWagerLocked', 'roundCompleted',
];

export class GameAdapter {
  constructor() {
    this._listeners = {};
    this._view = null;
    this._sig = '';
    this._cb = null;
    this._destroyed = false;
  }

  async init() { throw new Error('GameAdapter.init() not implemented'); }
  /** @param {(view:Object)=>void} cb @returns {()=>void} unsubscribe */
  subscribe() { throw new Error('GameAdapter.subscribe() not implemented'); }
  getView() { return this._view; }

  /** كل الأوامر بتعدّي من هنا (التنفيذ الفعلي في الـ adapter الفرعي). */
  async _command() { throw new Error('GameAdapter._command() not implemented'); }

  // ─ الأدمن: إعدادات اللوبي ─
  updateSettings(patch) { return this._command('updateSettings', patch); }
  addCategory(name) { return this._command('addCategory', { name }); }
  updateCategory({ id, name, enabled }) { return this._command('updateCategory', { id, name, enabled }); }
  removeCategory(id) { return this._command('removeCategory', { id }); }
  resetCategories() { return this._command('resetCategories'); }
  startRound() { return this._command('startRound'); }
  // ─ الأدمن: إدارة السؤال ─
  advance() { return this._command('advance'); }
  closeQuestion() { return this._command('closeQuestion'); }
  gradeAnswer({ questionNo, playerId, status }) { return this._command('gradeAnswer', { questionNo, playerId, status }); }
  bulkGrade({ questionNo, status }) { return this._command('bulkGrade', { questionNo, status }); }
  approveQuestion() { return this._command('approveQuestion'); }
  adjustNext(params) { return this._command('adjustNext', params); }
  endRound() { return this._command('endRound'); }
  newRound() { return this._command('newRound'); }
  // ─ اللاعب ─
  lockPoints(points) { return this._command('lockPoints', { points }); }
  activateDouble() { return this._command('activateDouble'); }
  /** points و double للسؤال العادي (في نفس الإرسال). السؤال النهائي: النص بس. */
  submitAnswer(text, { points, double } = {}) { return this._command('submitAnswer', { text, points, double: !!double }); }
  lockWager(amount) { return this._command('lockWager', { amount }); }
  /** تذكير للخادم بفحص انتهاء الوقت. آمن للتكرار. */
  tick() { return this._command('tick'); }
  refresh() { return this._command('view'); }

  // ─ أحداث اللعبة → المنصة ─
  on(eventName, handler) {
    (this._listeners[eventName] ||= []).push(handler);
    return () => { this._listeners[eventName] = (this._listeners[eventName] || []).filter((h) => h !== handler); };
  }
  emit(eventName, payload) {
    for (const h of [...(this._listeners[eventName] || []), ...(this._listeners['*'] || [])]) {
      try { h(eventName, payload); } catch (e) { console.error('[bus-complete] listener error', e); }
    }
  }

  /** يستقبل نسخة جديدة: يتجاهل القديم والمطابق، ويطلّع أحداث المنصة من الفرق بين النسختين. */
  _push(view) {
    if (this._destroyed || !view) return;
    const cur = this._view;
    if (cur && cur.viewerId === view.viewerId && view.version < cur.version) return;     // رد قديم وصل متأخر
    const sig = JSON.stringify(view, (k, v) => (k === 'serverNow' ? undefined : v));
    if (cur && sig === this._sig) return;                                                 // نفس الحالة: مفيش إعادة رسم (يمنع الرمش)
    this._sig = sig;
    this._view = view;
    this._emitDiff(cur, view);
    if (this._cb) this._cb(view);
  }

  _emitDiff(prev, next) {
    const sameViewer = prev && prev.viewerId === next.viewerId;
    const base = { roomId: next.roomId, roundNo: next.roundNo, playerId: next.viewerId };
    if (!sameViewer) return;
    if (prev.phase !== next.phase && next.phase === 'confirm') this.emit('gameStarted', { ...base, settings: next.settings });
    const pq = prev.question; const nq = next.question;
    if (nq && (!pq || pq.no !== nq.no) && next.phase === 'question') this.emit('questionStarted', { ...base, questionNo: nq.no, kind: nq.kind, category: nq.category, letter: nq.letter });
    if (nq && nq.mine && nq.mine.submitted && !(pq && pq.no === nq.no && pq.mine && pq.mine.submitted)) this.emit('answerSubmitted', { ...base, questionNo: nq.no });
    if (nq && nq.mine && nq.mine.doubled && !(pq && pq.no === nq.no && pq.mine && pq.mine.doubled)) this.emit('cardUsed', { ...base, questionNo: nq.no });
    if (prev.me && next.me && prev.me.wager == null && next.me.wager != null && next.phase === 'wager') this.emit('finalWagerLocked', { ...base, amount: next.me.wager });
    if (nq && nq.approved && !(pq && pq.no === nq.no && pq.approved)) {
      this.emit('questionApproved', { ...base, questionNo: nq.no });
      const mine = nq.results && nq.results.find((r) => r.playerId === next.viewerId);
      if (mine && mine.delta !== 0) this.emit('scoreUpdated', { ...base, questionNo: nq.no, delta: mine.delta, total: mine.total });
    }
    if (prev.phase !== 'standings' && next.phase === 'standings') this.emit('roundCompleted', { ...base, standings: next.standings });
  }

  destroy() { this._destroyed = true; }
}

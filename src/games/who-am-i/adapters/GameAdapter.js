// ───────────────────────────────────────────────────────────────
// GameAdapter — الواجهة الوحيدة بين «أنا مين؟» ومنصة SING & PLAY.
// الواجهة (screens/components) لا تعرف أي شيء عن Supabase أو الغرف. تتكلم مع هذا العقد فقط.
//
// داخل (المنصة → اللعبة): init() و subscribe()
//   init() ترجع:
//     roomId, players[{id,name,isHost?}], currentUserId, playerName,
//     existingScores{[userId]:number}, gameSettings{...}
//   subscribe(cb) تستدعي cb(view) كلما تغيّرت الحالة. view هي نتيجة projectFor() الخاصة بهذا اللاعب
//   (الشخصية السرية غير موجودة فيها لصاحب الدور).
//
// خارج (اللعبة → المنصة): on(eventName, handler) / on('*', handler)
//   gameStarted · turnStarted · questionSubmitted · answerSubmitted
//   guessSubmitted · turnCompleted · scoreUpdated · roundCompleted
//
// الأوامر: كلها ترجع Promise<{ ok:true } | { ok:false, error:{code,message} }>
// ───────────────────────────────────────────────────────────────

export const PLATFORM_EVENTS = [
  'gameStarted', 'turnStarted', 'questionSubmitted', 'answerSubmitted',
  'guessSubmitted', 'turnCompleted', 'scoreUpdated', 'roundCompleted',
];

export class GameAdapter {
  constructor() { this._listeners = {}; }

  /** @returns {Promise<{roomId:string, players:Array, currentUserId:string, playerName:string, existingScores:Object, gameSettings:Object}>} */
  async init() { throw new Error('GameAdapter.init() not implemented'); }

  /** @param {(view:Object)=>void} cb  @returns {()=>void} unsubscribe */
  subscribe(cb) { throw new Error('GameAdapter.subscribe() not implemented'); }
  getView() { throw new Error('GameAdapter.getView() not implemented'); }

  // ─ أوامر اللاعب ─
  async startRound() { throw new Error('not implemented'); }
  async submitQuestion({ targetId, text }) { throw new Error('not implemented'); }
  async cancelQuestion({ questionId }) { throw new Error('not implemented'); }
  async submitAnswer({ questionId, answer }) { throw new Error('not implemented'); }
  async requestGuess() { throw new Error('not implemented'); }
  async cancelGuess() { throw new Error('not implemented'); }
  async submitGuess({ choiceId }) { throw new Error('not implemented'); }
  /** تذكير للخادم بفحص انتهاء الوقت. آمن للتكرار. */
  async tick() { return { ok: true }; }
  /** المضيف يتخطى انتظار الكشف/الانتقال. */
  async advance() { throw new Error('not implemented'); }

  // ─ أحداث اللعبة → المنصة ─
  on(eventName, handler) {
    (this._listeners[eventName] ||= []).push(handler);
    return () => { this._listeners[eventName] = this._listeners[eventName].filter((h) => h !== handler); };
  }
  emit(eventName, payload) {
    for (const h of [...(this._listeners[eventName] || []), ...(this._listeners['*'] || [])]) {
      try { h(eventName, payload); } catch (e) { console.error('[who-am-i] listener error', e); }
    }
  }

  destroy() {}
}

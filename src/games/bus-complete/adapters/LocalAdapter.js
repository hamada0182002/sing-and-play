// LocalAdapter — «الـ Mock Adapter»: يشغّل نفس معالج الخادم (server/handler.js + المحرك) داخل المتصفح بدون أي خادم.
// بيستخدم لتجربة اللعبة قبل الدمج: كل لاعب = adapter. ولو persist='localStorage' بتتزامن الحالة بين تابات المتصفح
// (BroadcastChannel) فتقدر تفتح أكتر من تاب وتلعب كأنك على أجهزة مختلفة.
//
// ⚠ للتطوير فقط: الحَكَم بيشتغل في المتصفح نفسه، فمش آمن ضد لاعب بيفتح الـDevTools. الإنتاج = SupabaseAdapter.
import { GameAdapter } from './GameAdapter.js';
import { handle } from '../server/handler.js';
import { createMemoryDb } from '../server/memory-db.js';

/** هاب محلي لغرفة واحدة. */
export function createLocalHub({ roomId = 'local-room', members, adminId, existingScores, persist = 'memory', storageKey } = {}) {
  const key = storageKey || `bus-complete:${roomId}`;
  const room = { adminId: adminId || members[0].id, members, existingScores: existingScores || Object.fromEntries(members.map((m) => [m.id, 0])) };
  const mem = createMemoryDb();
  mem.setRoom(roomId, room);
  let db = mem;
  let bc = null;
  const listeners = new Set();
  let lastVersion = null;
  const notify = () => { for (const l of listeners) l(); };

  if (persist === 'localStorage' && typeof localStorage !== 'undefined') {
    const read = () => { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; } };
    const write = (v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* مساحة ممتلئة */ } };
    db = {
      awards: mem.awards,
      async getRoom() { return room; },
      async loadGame() { const g = read(); return g ? { state: g.state, version: g.version } : null; },
      async saveGame(_id, state, expected) {
        const g = read();
        const cur = g ? g.version : null;
        if (cur !== expected) return { ok: false, version: cur };
        const version = (cur ?? 0) + 1;
        write({ state, version });
        if (bc) bc.postMessage({ t: 'changed' });
        return { ok: true, version };
      },
      async award(playerId, k, points, meta) {
        const a = (() => { try { return JSON.parse(localStorage.getItem(`${key}:awards`) || '{}'); } catch { return {}; } })();
        const id = `${k}:${playerId}`;
        if (a[id]) return;
        a[id] = { playerId, points, meta };
        try { localStorage.setItem(`${key}:awards`, JSON.stringify(a)); } catch { /* ignore */ }
      },
    };
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(key);
      bc.onmessage = () => notify();
    }
    if (typeof window !== 'undefined') window.addEventListener('storage', (e) => { if (e.key === key) notify(); });
  }

  return {
    roomId, room, db, key,
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    // نبلّغ المشتركين فقط لما نسخة الحالة تتغيّر (وإلا كل «view» كان هيطلّب «view» تانية للأبد).
    call: (userId, action, params, requestId) => handle(db, { roomId, userId, action, params, requestId }).then((r) => {
      const ver = r.view ? r.view.version : null;
      if (ver !== lastVersion) { lastVersion = ver; notify(); }
      return r;
    }),
    reset() {
      mem.games.clear();
      if (persist === 'localStorage') { try { localStorage.removeItem(key); localStorage.removeItem(`${key}:awards`); } catch { /* ignore */ } if (bc) bc.postMessage({ t: 'changed' }); }
      notify();
    },
  };
}

let _seq = 0;

export class LocalAdapter extends GameAdapter {
  constructor(hub, userId, { safetyTickMs = 1000 } = {}) {
    super();
    this.hub = hub;
    this.userId = userId;
    this.safetyTickMs = safetyTickMs;
    this._timers = [];
    this._off = null;
    this._refreshing = false;
    this._again = false;
  }

  async init() {
    const me = this.hub.room.members.find((m) => m.id === this.userId);
    const r = await this.hub.call(this.userId, 'view');
    if (r.view) this._push(r.view);
    return {
      roomId: this.hub.roomId,
      players: this.hub.room.members.map((m) => ({ id: m.id, name: m.name, isHost: m.id === this.hub.room.adminId })),
      currentUserId: this.userId, playerName: me ? me.name : '', existingScores: this.hub.room.existingScores, gameSettings: {},
    };
  }

  async _command(action, params = {}) {
    const r = await this.hub.call(this.userId, action, params, `${this.userId}-${Date.now().toString(36)}-${++_seq}`);
    if (r.view) this._push(r.view);
    return r.ok ? { ok: true, view: r.view } : { ok: false, error: r.error };
  }

  async _refresh() {
    if (this._destroyed) return;
    if (this._refreshing) { this._again = true; return; }
    this._refreshing = true;
    try { const r = await this.hub.call(this.userId, 'view'); if (r.view) this._push(r.view); } finally {
      this._refreshing = false;
      if (this._again && !this._destroyed) { this._again = false; void this._refresh(); }
    }
  }

  subscribe(cb) {
    this._cb = cb;
    if (this._view) cb(this._view);
    void this._refresh();
    this._off = this.hub.onChange(() => { void this._refresh(); });
    this._timers.push(setInterval(() => { void this._refresh(); }, this.safetyTickMs));   // يقفل الوقت المنتهي حتى لو محدش ضغط
    return () => this._teardown();
  }

  _teardown() { for (const t of this._timers) clearInterval(t); this._timers = []; if (this._off) this._off(); this._off = null; this._cb = null; }
  destroy() { super.destroy(); this._teardown(); }
}

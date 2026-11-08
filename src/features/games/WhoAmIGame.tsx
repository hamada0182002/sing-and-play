import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { mountWhoAmI } from '../../games/who-am-i';
import { SupabaseAdapter } from '../../games/who-am-i/SupabaseAdapter';
import '../../games/who-am-i/styles/who-am-i.css';
import { kickPlayer } from '../admin/api';
import { playErrorText } from '../play/api';
import type { LobbyPlayer } from '../rooms/api';

interface Props {
  roomId: string;
  canExit: boolean;   // زر «رجوع للغرفة» للأدمن فقط
  onExit: () => void;
  onLeave: () => void; // مغادرة الغرفة (لكل اللاعبين)
  isAdmin?: boolean;   // الأدمن بس يقدر يطرد لاعب (مثلاً لو قفل التطبيق وعطّل اللعبة)
  me?: string;
  players?: LobbyPlayer[];
}

// بيشغّل لعبة «أنا مين؟» بمحرّكها وشاشاتها المستقلة داخل غرفة SING & PLAY
export default function WhoAmIGame({ roomId, canExit, onExit, onLeave, isAdmin = false, me = '', players = [] }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const exitRef = useRef(onExit);
  exitRef.current = onExit;
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [kickOpen, setKickOpen] = useState(false);
  const [kickTarget, setKickTarget] = useState<string | null>(null); // اللاعب اللي مستني تأكيد طرده
  const [kickBusy, setKickBusy] = useState(false);
  const [kickError, setKickError] = useState('');

  // تأكيد المغادرة بيتلغي لوحده بعد 5 ثواني (عشان ما يفضلش مفتوح بالغلط)
  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 5000);
    return () => clearTimeout(t);
  }, [confirming]);

  // تأكيد الطرد بيتلغي لوحده بعد 5 ثواني
  useEffect(() => {
    if (!kickTarget) return;
    const t = setTimeout(() => setKickTarget(null), 5000);
    return () => clearTimeout(t);
  }, [kickTarget]);

  async function doKick(userId: string) {
    setKickBusy(true);
    setKickError('');
    try {
      await kickPlayer(roomId, userId);
      setKickTarget(null);
    } catch (e) {
      setKickError(playErrorText(e));
    } finally {
      setKickBusy(false);
    }
  }

  const others = players.filter((p) => p.user_id !== me);

  useEffect(() => {
    const el = host.current;
    if (!el || !supabase) return;
    let alive = true;
    let handle: { destroy: () => void } | null = null;
    const adapter = new SupabaseAdapter(roomId, supabase);
    mountWhoAmI(el, { adapter, onExit: canExit ? () => exitRef.current() : undefined })
      .then((h) => {
        if (alive) handle = h;
        else h.destroy();
      })
      .catch(() => {
        if (alive) setError('تعذّر تحميل اللعبة، جرّب تحدّث الصفحة');
      });
    return () => {
      alive = false;
      if (handle) handle.destroy();
      adapter.destroy();
    };
  }, [roomId, canExit]);

  return (
    <div className="wai-shell">
      <div className="wai-leavebar">
        {confirming ? (
          <>
            <span>تغادر الغرفة؟</span>
            <span style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-flame small" onClick={onLeave}>أيوه، غادر</button>
              <button type="button" className="btn btn-outline small" onClick={() => setConfirming(false)}>لأ</button>
            </span>
          </>
        ) : (
          <>
            <button type="button" className="link-btn" onClick={() => setConfirming(true)}>مغادرة الغرفة</button>
            {isAdmin && others.length > 0 && (
              <button type="button" className="link-btn wai-kick-open" onClick={() => { setKickOpen(true); setKickError(''); }}>طرد لاعب</button>
            )}
          </>
        )}
      </div>
      {kickOpen && (
        <div className="wai-kick-wrap" role="dialog" aria-label="طرد لاعب" onClick={(e) => { if (e.target === e.currentTarget) { setKickOpen(false); setKickTarget(null); } }}>
          <div className="wai-kick">
            <div className="display wai-kick-title">طرد لاعب</div>
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>لو لاعب قفل التطبيق أو بقى غايب، اطرده عشان اللعبة تكمّل. دوره بيخلص فوراً.</p>
            <div className="list">
              {others.map((p) => {
                const name = p.profiles?.display_name ?? 'لاعب';
                const asking = kickTarget === p.user_id;
                return (
                  <div key={p.user_id} className="row">
                    <div className="avatar-sm display" aria-hidden="true">{name.charAt(0)}</div>
                    <div style={{ flex: 1, fontWeight: 800 }}>{name}</div>
                    {asking ? (
                      <span style={{ display: 'flex', gap: 8 }}>
                        <button type="button" className="btn small" disabled={kickBusy} style={{ background: 'var(--brick)', color: 'var(--ivory)', fontSize: 16, padding: '0 14px' }} onClick={() => void doKick(p.user_id)}>{kickBusy ? '...' : 'أيوه، اطرده'}</button>
                        <button type="button" className="btn btn-outline small" disabled={kickBusy} onClick={() => setKickTarget(null)}>لأ</button>
                      </span>
                    ) : (
                      <button type="button" className="btn small" disabled={kickBusy} style={{ background: 'var(--brick)', color: 'var(--ivory)', fontSize: 16, padding: '0 16px' }} onClick={() => setKickTarget(p.user_id)}>طرد</button>
                    )}
                  </div>
                );
              })}
            </div>
            {kickError && <p className="msg err" role="alert">{kickError}</p>}
            <button type="button" className="btn btn-outline submit" onClick={() => { setKickOpen(false); setKickTarget(null); }}>إغلاق</button>
          </div>
        </div>
      )}
      {error && <p className="msg err" role="alert">{error}</p>}
      <div ref={host} className="wai-slot" />
    </div>
  );
}

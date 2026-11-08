import { useState } from 'react';
import Avatar from '../../ui/Avatar';
import type { LobbyPlayer } from '../rooms/api';
import { playErrorText, restartGame } from './api';

export default function FinalScreen({ players, me, isAdmin, roomId, onLeave }: { players: LobbyPlayer[]; me: string; isAdmin: boolean; roomId: string; onLeave: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const top = sorted[0]?.score ?? 0;
  const winners = top > 0 ? sorted.filter((p) => p.score === top) : [];
  const rank = (p: LobbyPlayer) => 1 + sorted.filter((o) => o.score > p.score).length;

  async function again() {
    setBusy(true);
    setError('');
    try {
      await restartGame(roomId);
    } catch (e) {
      setError(playErrorText(e));
      setBusy(false);
    }
  }

  return (
    <main className="screen" style={{ textAlign: 'center' }}>
      <div className="muted" style={{ fontWeight: 700 }}>انتهت المباراة</div>
      <div className="display" style={{ fontSize: 36, color: 'var(--butter)' }}>{winners.length ? (winners.length > 1 ? 'الفائزون' : 'الفائز') : 'تعادل بدون نقاط'}</div>
      {winners.length > 0 && (
        <>
          <div className="disc-mid"><span className="display" style={{ fontSize: 80, lineHeight: 1, color: 'var(--ground)' }}>١</span></div>
          <div className="display" style={{ fontSize: 32 }}>{winners.map((w) => w.profiles?.display_name ?? 'لاعب').join(' · ')}</div>
          <div className="muted">{top} نقطة</div>
        </>
      )}
      <div className="list" style={{ textAlign: 'right' }}>
        {sorted.map((p) => (
          <div key={p.user_id} className="ticket">
            <span className="display" style={{ fontSize: 28, width: 32, color: 'var(--butter)' }}>{rank(p)}</span>
            <Avatar id={p.user_id} name={p.profiles?.display_name ?? '?'} size={42} />
            <div style={{ flex: 1, fontWeight: 800 }}>{p.profiles?.display_name ?? 'لاعب'}{p.user_id === me ? ' (أنت)' : ''}</div>
            <span className="display" style={{ fontSize: 26 }}>{p.score}</span>
          </div>
        ))}
      </div>
      {error && <p className="msg err" role="alert">{error}</p>}
      <div style={{ display: 'flex', gap: 12, marginTop: 'auto' }}>
        {isAdmin ? (
          <button className="btn btn-gold" type="button" style={{ flex: 1 }} disabled={busy} onClick={() => void again()}>العب مجدداً</button>
        ) : null}
        <button className="btn btn-outline" type="button" style={{ flex: 1 }} onClick={onLeave}>الرئيسية</button>
      </div>
      {!isAdmin && <p className="muted" style={{ margin: 0 }}>لو الأدمن بدأ مباراة جديدة هتظهر لك هنا لو فضلت في الغرفة.</p>}
    </main>
  );
}

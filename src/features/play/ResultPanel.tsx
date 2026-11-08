import { useState } from 'react';
import { deleteRecording, endGame, nextRound, playErrorText, type RoundRow } from './api';

export default function ResultPanel({ round, roomId, isAdmin, singerName }: { round: RoundRow; roomId: string; isAdmin: boolean; singerName: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (e) {
      setError(playErrorText(e));
    }
    setBusy(false);
  }

  const cancelled = round.recording_status === 'cancelled';

  return (
    <div className="result-box">
      {cancelled ? (
        <p className="msg ok">{singerName} ألغى تسجيله، والدور بدون نقاط</p>
      ) : round.recording_status === 'failed' ? (
        <p className="msg ok">تعذّر تسجيل غناء {singerName}، والدور بدون نقاط</p>
      ) : round.skipped ? (
        <p className="msg ok">{singerName} تخطّى دوره دون خسارة نقاط</p>
      ) : (
        <>
          <div className="muted" style={{ fontWeight: 700 }}>نتيجة الدور {round.round_no}</div>
          <div className="display" style={{ fontSize: 60, lineHeight: 1 }}>{round.avg_stars ?? '—'}</div>
          <div className="muted" style={{ fontWeight: 700 }}>
            {round.avg_stars === null ? 'لا توجد أصوات' : `متوسط النجوم · +${round.points} نقطة لـ${singerName}`}
          </div>
        </>
      )}

      {isAdmin ? (
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-gold" type="button" style={{ flex: 2 }} disabled={busy} onClick={() => void run(async () => { await deleteRecording(round); await nextRound(roomId); })}>الدور التالي</button>
          <button className="btn btn-outline small" type="button" style={{ flex: 1 }} disabled={busy} onClick={() => void run(async () => { await deleteRecording(round); await endGame(roomId); })}>إنهاء</button>
        </div>
      ) : (
        <p className="muted">بانتظار الأدمن لبدء الدور التالي…</p>
      )}
      {error && <p className="msg err" role="alert">{error}</p>}
    </div>
  );
}

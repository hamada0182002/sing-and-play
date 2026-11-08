import { useEffect, useRef, useState } from 'react';
import type { Go } from '../../app/routes';
import { RULES } from '../../game/rules';
import { supabase } from '../../lib/supabase';
import Avatar from '../../ui/Avatar';
import { useAuth } from '../auth/AuthProvider';
import ChatPanel from '../chat/ChatPanel';
import { leaveRoom, type LobbyPlayer, type RoomRow } from '../rooms/api';
import { advanceRound, closeVoting, fetchCurrentRound, finishTurn, getServerOffset, pingRoom, playErrorText, skipAbsentSinger, type RoundRow } from './api';
import BeatPicker from './BeatPicker';
import CardsBar from './CardsBar';
import ListenPanel from './ListenPanel';
import ResultPanel from './ResultPanel';
import VotePanel from './VotePanel';
import { DEFAULT_MIX, loadSyncMs, type MixSettings } from './beats';
import { useTurnRecorder } from './useTurnRecorder';

const CIRC = 2 * Math.PI * 54;

export default function GameScreen({ room, players, go, onSettings }: { room: RoomRow; players: LobbyPlayer[]; go: Go; onSettings?: () => void }) {
  const { session } = useAuth();
  const me = session?.user.id ?? '';
  const [round, setRound] = useState<RoundRow | null>(null);
  const [offset, setOffset] = useState(0);
  const [tick, setTick] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const attempt = useRef({ key: '', at: 0 });
  const [mix, setMix] = useState<MixSettings>(() => ({ ...DEFAULT_MIX, syncMs: loadSyncMs() }));

  useEffect(() => {
    let live = true;
    const load = () => fetchCurrentRound(room.id).then((r) => live && setRound(r)).catch(() => live && setError('تعذّر تحميل الدور'));
    void load();
    getServerOffset().then((o) => live && setOffset(o)).catch(() => undefined);
    const channel = supabase!
      .channel(`game-${room.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rounds', filter: `room_id=eq.${room.id}` }, () => void load())
      .subscribe();
    const poll = setInterval(() => void load(), 6000);
    const clock = setInterval(() => setTick((t) => t + 1), 250);
    return () => {
      live = false;
      clearInterval(poll);
      clearInterval(clock);
      void supabase!.removeChannel(channel);
    };
  }, [room.id]);

  const remaining = round?.phase_ends_at
    ? Math.max(0, Math.ceil((Date.parse(round.phase_ends_at) - (Date.now() + offset)) / 1000))
    : 0;

  useEffect(() => {
    if (!round || remaining > 0) return;
    if (round.phase !== 'singing' && round.phase !== 'voting') return;
    const key = `${round.id}-${round.attempt}-${round.phase}`;
    if (attempt.current.key === key && Date.now() - attempt.current.at < 2000) return;
    attempt.current = { key, at: Date.now() };
    advanceRound(round.id).then(setRound).catch(() => undefined);
  }, [remaining, round, tick]);

  // نبضة حضور كل 5 ثواني عشان السيرفر يعرف مين لسه متصل
  useEffect(() => {
    const beat = () => void pingRoom(room.id).catch(() => undefined);
    beat();
    const t = setInterval(beat, 5000);
    const onVisible = () => { if (document.visibilityState === 'visible') beat(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', beat);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', beat);
    };
  }, [room.id]);

  // لو المغني خرج أو فصل: أي لاعب يسأل السيرفر، والسيرفر يتخطى الدور ويبدأ اللي بعده
  const watchRoundId = round && !round.approved && round.singer_id !== me && ['singing', 'listening', 'voting'].includes(round.phase) ? round.id : null;
  useEffect(() => {
    if (!watchRoundId) return;
    const check = () => void skipAbsentSinger(watchRoundId).then(setRound).catch(() => undefined);
    const t = setInterval(check, 5000 + Math.random() * 2000);
    return () => clearInterval(t);
  }, [watchRoundId]);

  const timeUp = !!round && round.phase === 'singing' && round.phase_ends_at !== null && remaining === 0;
  const { state: recState, seconds: recSeconds, micError, start, stop } = useTurnRecorder(round, !!round && round.singer_id === me, mix, timeUp);

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

  if (!round) {
    return <main className="screen center"><p className="muted">{error || 'جارٍ تجهيز الدور…'}</p></main>;
  }

  const isAdmin = room.admin_id === me;
  const isSinger = round.singer_id === me;
  const singerName = players.find((p) => p.user_id === round.singer_id)?.profiles?.display_name ?? 'لاعب';
  const timed = round.phase === 'singing' || round.phase === 'voting';
  const total = round.phase === 'voting' ? RULES.voteSeconds : RULES.turnSeconds;
  const progress = round.phase_ends_at ? Math.min(1, remaining / total) : 0;
  const voters = Math.max(0, players.length - 1);
  const votedIds = round.voted_ids ?? [];
  const hot = round.phase === 'voting' ? remaining <= 5 : recState === 'recording';

  return (
    <main className="screen game">
      <header className="g-head">
        <span className="badge-soft sm">الدور {round.round_no}</span>
        <div className="g-singer"><small>يغني</small>{singerName}{isSinger ? ' (أنت)' : ''}</div>
        <span className="badge-soft sm">غرفة <span dir="ltr">{room.code}</span></span>
      </header>

      {round.notice && <p className="msg ok" role="status" style={{ textAlign: 'center', padding: '6px 10px', fontSize: 14 }}>{round.notice}</p>}

      <section className="game-main">
        <div className="hud">
          <div className={`ring-sm ${timed ? '' : 'idle'}`}>
            {timed && (
              <svg viewBox="0 0 120 120" aria-hidden="true">
                <circle cx="60" cy="60" r="54" fill="none" stroke="var(--line-soft)" strokeWidth="8" />
                <circle cx="60" cy="60" r="54" fill="none" stroke="var(--butter)" strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - progress)} transform="rotate(-90 60 60)" />
              </svg>
            )}
            <div className={`disc-sm ${timed ? '' : 'plain'}`}><span className="display letter-xs">{round.letter}</span></div>
          </div>
          {timed && (
            <div className="hud-time">
              <span className="display" style={{ color: hot ? 'var(--flame)' : undefined }}>{remaining}</span>
              <span>{round.phase === 'voting' ? 'ثانية للتصويت' : 'ثانية متبقية'}</span>
            </div>
          )}
        </div>

        {isSinger && round.phase === 'singing' && (
          <BeatPicker settings={mix} onChange={setMix} locked={recState === 'recording'} />
        )}

        {round.phase === 'singing' && (
          isSinger ? (
            <div className="rec-controls">
              {recState === 'idle' && (
                <button className="btn btn-gold submit" type="button" onClick={() => void start()}>تسجيل</button>
              )}
              {recState === 'recording' && (
                <>
                  <p className="rec-live"><span className="rec-dot" aria-hidden="true" />جارٍ التسجيل · {recSeconds} ث</p>
                  <button className="btn btn-brick submit" type="button" onClick={stop}>إيقاف</button>
                </>
              )}
              {recState === 'stopped' && (
                <>
                  <p className="muted" style={{ margin: 0, textAlign: 'center', fontSize: 14 }}>تم تسجيل مقطع ({recSeconds} ث). تقدر تعيده طالما الوقت باقي.</p>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-flame" type="button" style={{ flex: 1 }} onClick={() => void start()}>إعادة</button>
                    <button className="btn btn-gold" type="button" style={{ flex: 1 }} disabled={busy} onClick={() => void run(() => finishTurn(round.id).then(setRound))}>انتهيت</button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <p className="muted" style={{ textAlign: 'center' }}>{singerName} يغني الآن…</p>
          )
        )}

        {round.phase === 'listening' && (
          <>
            <ListenPanel key={`${round.id}-${round.attempt}`} round={round} singerName={singerName} isSinger={isSinger} isAdmin={isAdmin} />
            <p className="muted" style={{ textAlign: 'center', fontSize: 14 }}>التصويت هيبدأ أوتوماتيك أول ما التسجيل يوصل…</p>
          </>
        )}

        {round.phase === 'voting' && (
          <>
            <ListenPanel key={`${round.id}-${round.attempt}`} round={round} singerName={singerName} isSinger={isSinger} isAdmin={isAdmin} />
            {isSinger ? (
              <p className="muted" style={{ textAlign: 'center' }}>اللاعبون يصوّتون على غنائك ({round.votes_count} من {voters})</p>
            ) : (
              <VotePanel key={`${round.id}-${round.attempt}`} round={round} />
            )}
            <div className="voters-list">
              {players.filter((p) => p.user_id !== round.singer_id).map((p) => {
                const done = votedIds.includes(p.user_id);
                return (
                  <span key={p.user_id} className="badge-soft sm" style={{ opacity: done ? 1 : 0.55 }}>
                    {done ? '✓' : '…'} {p.profiles?.display_name ?? 'لاعب'}
                  </span>
                );
              })}
            </div>
            {isAdmin && <button className="btn btn-outline small" type="button" disabled={busy} onClick={() => void run(() => closeVoting(round.id))}>إنهاء التصويت الآن ({round.votes_count}/{voters})</button>}
          </>
        )}

        {round.phase === 'result' && <ResultPanel key={`${round.id}-${round.attempt}`} round={round} roomId={room.id} isAdmin={isAdmin} singerName={singerName} />}

        {error && <p className="msg err" role="alert">{error}</p>}
        {micError && <p className="msg err" role="alert">{micError}</p>}
      </section>

      <footer className="g-foot">
        {room.allow_cards && <CardsBar roomId={room.id} round={round} players={players} me={me} />}
        <div className="bottom-bar">
          <div className="strip" aria-label="اللاعبون ونقاطهم">
            {players.map((p) => (
              <div key={p.user_id} className="strip-item">
                <Avatar id={p.user_id} name={p.profiles?.display_name ?? '?'} size={34} ring={p.user_id === round.singer_id} />
                <div className="strip-name">{p.profiles?.display_name ?? 'لاعب'}</div>
                <div className="strip-score">{p.score}</div>
              </div>
            ))}
          </div>
          <ChatPanel roomId={room.id} players={players} me={me} enabled={room.allow_chat} />
        </div>
        <div className="game-links">
          {onSettings && <button className="link-btn" type="button" onClick={onSettings}>إعدادات الغرفة</button>}
          <button className="link-btn" type="button" onClick={() => void leaveRoom(room.id).then(() => go({ name: 'home' })).catch(() => setError('تعذّر مغادرة الغرفة'))}>مغادرة المباراة</button>
        </div>
      </footer>
    </main>
  );
}

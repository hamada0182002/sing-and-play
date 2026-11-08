import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import type { Go } from '../../app/routes';
import BottomNav from '../../ui/BottomNav';
import Icon from '../../ui/icons';
import GameArt from '../games/GameArt';
import { gameTitle } from '../games/gameUi';
import { useGameChoice } from '../games/useGameChoice';
import RoomRow from './RoomRow';
import { joinRoom, listPublicRooms, roomErrorText, type PublicRoom } from './api';

const d = (n: number) => ({ '--d': n }) as CSSProperties;

// صفحة اللعبة: غرفة سريعة، إنشاء غرفة، الغرف المفتوحة لنفس اللعبة
export default function GameHubScreen({ go, game }: { go: Go; game: string }) {
  const { games, setGame } = useGameChoice();
  const [rooms, setRooms] = useState<PublicRoom[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const title = gameTitle(games, game);

  // الغرفة الجاية (إنشاء/قايمة) بتتعمل لنفس اللعبة
  useEffect(() => {
    setGame(game);
  }, [game]);

  const load = useCallback(async () => {
    try {
      setRooms(await listPublicRooms(game));
    } catch {
      setRooms([]);
    }
  }, [game]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 5000);
    return () => clearInterval(t);
  }, [load]);

  async function join(code: string) {
    setBusy(true);
    setError('');
    try {
      const room = await joinRoom(code);
      go({ name: 'lobby', roomId: room.id });
    } catch (e) {
      setError(roomErrorText(e));
      setBusy(false);
    }
  }

  async function quick() {
    setBusy(true);
    setError('');
    try {
      const open = (await listPublicRooms(game)).find((r) => r.player_count < r.max_players);
      if (!open) {
        setError('لا توجد غرف مفتوحة للعبة دي الآن، أنشئ غرفة جديدة');
        setBusy(false);
        return;
      }
      await join(open.code);
    } catch (e) {
      setError(roomErrorText(e));
      setBusy(false);
    }
  }

  return (
    <main className="screen">
      <div className="hub-top enter">
        <button type="button" className="icon-btn" aria-label="رجوع للألعاب" onClick={() => go({ name: 'home' })}><Icon name="back" /></button>
        <h2 className="display">{title}</h2>
      </div>

      <div className="hub-banner">
        <GameArt id={game} wide />
        <span className="gtile-shade" aria-hidden="true" />
      </div>

      <button className="btn btn-gold submit enter" type="button" style={{ ...d(1), fontSize: 26, minHeight: 56 }} disabled={busy} onClick={() => void quick()}>ادخل غرفة سريعة</button>
      <div className="enter" style={{ ...d(2), display: 'flex', gap: 12 }}>
        <button className="btn btn-flame" type="button" style={{ flex: 1 }} onClick={() => go({ name: 'create' })}>أنشئ غرفة</button>
        <button className="btn btn-outline" type="button" style={{ flex: 1 }} onClick={() => go({ name: 'create', visibility: 'private' })}>غرفة خاصة</button>
      </div>
      {error && <p className="msg err" role="alert">{error}</p>}

      <div className="enter" style={{ ...d(3), display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div className="display" style={{ fontSize: 26, color: 'var(--butter)' }}>الغرف المفتوحة</div>
        <button className="link-btn" type="button" onClick={() => go({ name: 'rooms' })}>عرض الكل / ادخل بكود</button>
      </div>
      <div className="list enter" style={d(4)}>
        {rooms === null && <p className="muted">جارٍ التحميل…</p>}
        {rooms?.length === 0 && <p className="muted">لا توجد غرف عامة الآن.</p>}
        {rooms?.slice(0, 3).map((r) => <RoomRow key={r.id} room={r} busy={busy} onJoin={(c) => void join(c)} />)}
      </div>

      <BottomNav current="home" go={go} />
    </main>
  );
}

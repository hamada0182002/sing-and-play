import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { Go } from '../../app/routes';
import BottomNav from '../../ui/BottomNav';
import RoomRow from './RoomRow';
import { gameUi } from '../games/gameUi';
import { useGameChoice } from '../games/useGameChoice';
import { joinRoom, listPublicRooms, roomErrorText, type PublicRoom } from './api';

export default function RoomListScreen({ go }: { go: Go }) {
  const { games, game, setGame } = useGameChoice();
  const [rooms, setRooms] = useState<PublicRoom[] | null>(null);
  const [search, setSearch] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setRooms(await listPublicRooms(game));
    } catch {
      setError('تعذّر تحميل الغرف');
    }
  }, [game]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 4000);
    return () => clearInterval(t);
  }, [load]);

  async function join(c: string) {
    setBusy(true);
    setError('');
    try {
      const room = await joinRoom(c);
      go({ name: 'lobby', roomId: room.id });
    } catch (err) {
      setError(roomErrorText(err));
      setBusy(false);
    }
  }

  function onCode(e: FormEvent) {
    e.preventDefault();
    void join(code);
  }

  const shown = rooms?.filter((r) => r.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <main className="screen">
      <h2 className="display" style={{ fontSize: 34, margin: 0 }}>الغرف المتاحة</h2>
      {games.length > 1 && (
        <div className="tabs">
          {games.map((g) => (
            <button key={g.id} type="button" className={`tab ${g.id === game ? 'on' : ''}`} onClick={() => { setRooms(null); setGame(g.id); }}>
              {gameUi(g.id).icon} {g.title}
            </button>
          ))}
        </div>
      )}
      <input className="field" placeholder="ابحث باسم الغرفة" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="بحث" />
      <form onSubmit={onCode} style={{ display: 'flex', gap: 10 }}>
        <input className="field code-input" dir="ltr" placeholder="كود غرفة خاصة" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={6} aria-label="كود الغرفة" />
        <button className="btn btn-gold small" type="submit" disabled={busy || code.trim().length < 6}>انضم</button>
      </form>
      {error && <p className="msg err" role="alert">{error}</p>}
      <div className="list">
        {shown === undefined && <p className="muted">جارٍ التحميل…</p>}
        {shown?.length === 0 && <p className="muted">{search ? 'لا توجد غرفة بهذا الاسم.' : 'لا توجد غرف عامة الآن. أنشئ غرفة جديدة.'}</p>}
        {shown?.map((r) => <RoomRow key={r.id} room={r} busy={busy} onJoin={(c) => void join(c)} />)}
      </div>
      <button className="btn btn-flame submit" type="button" onClick={() => go({ name: 'create' })}>أنشئ غرفة</button>
      <BottomNav current="rooms" go={go} />
    </main>
  );
}

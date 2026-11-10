import { useEffect, useState } from 'react';
import { useBackHandler } from '../../app/back';
import type { Go } from '../../app/routes';
import { RULES } from '../../game/rules';
import { supabase } from '../../lib/supabase';
import Avatar from '../../ui/Avatar';
import AdminPanel from '../admin/AdminPanel';
import ChatPanel from '../chat/ChatPanel';
import FinalScreen from '../play/FinalScreen';
import GameScreen from '../play/GameScreen';
import { playErrorText, startGame } from '../play/api';
import { useAuth } from '../auth/AuthProvider';
import { fetchPlayers, fetchRoom, leaveRoom, type LobbyPlayer, type RoomRow } from '../rooms/api';
import WhoAmIGame from '../games/WhoAmIGame';
import BusCompleteGame from '../games/BusCompleteGame';
import { gamesErrorText, returnFromBusComplete, returnToRoom, selectGame, startBusComplete, startWhoAmI } from '../games/api';
import GamePicker from '../games/GamePicker';
import { gameTitle, gameUi } from '../games/gameUi';
import { useGames } from '../games/useGames';

export default function LobbyScreen({ roomId, go }: { roomId: string; go: Go }) {
  const { session } = useAuth();
  const me = session?.user.id;
  const [room, setRoom] = useState<RoomRow | null>(null);
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [pickingGame, setPickingGame] = useState(false); // الأدمن فاتح قايمة تغيير اللعبة
  const [switching, setSwitching] = useState(false);
  const games = useGames();
  useBackHandler(showAdmin, () => setShowAdmin(false));

  useEffect(() => {
    let live = true;
    async function load() {
      try {
        const r = await fetchRoom(roomId);
        if (!live) return;
        if (!r) return go({ name: 'home' });
        const list = await fetchPlayers(roomId);
        if (!live) return;
        if (me && !list.some((p) => p.user_id === me)) return go({ name: 'home' });
        setRoom(r);
        setPlayers(list);
      } catch {
        if (live) setError('تعذّر تحميل الغرفة');
      }
    }
    void load();
    const channel = supabase!
      .channel(`lobby-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_players', filter: `room_id=eq.${roomId}` }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, () => void load())
      .subscribe();
    const timer = setInterval(() => void load(), 8000); // احتياطي لو انقطع الاتصال اللحظي
    return () => {
      live = false;
      clearInterval(timer);
      void supabase!.removeChannel(channel);
    };
  }, [roomId, me, go]);

  // الأدمن يرجّع الغرفة بعد لعبة أنا مين
  async function backToRoom() {
    try {
      await returnToRoom(roomId);
      const r = await fetchRoom(roomId);
      if (r) setRoom(r);
    } catch (e) {
      setError(gamesErrorText(e));
    }
  }

  // الأدمن يرجّع الغرفة بعد لعبة أتوبيس كومبليت (دالة خروج مستقلة على الخادم)
  async function backFromBusComplete() {
    try {
      await returnFromBusComplete(roomId);
      const r = await fetchRoom(roomId);
      if (r) setRoom(r);
    } catch (e) {
      setError(gamesErrorText(e));
    }
  }

  async function leave() {
    try {
      await leaveRoom(roomId);
      go({ name: 'home' });
    } catch {
      setError('تعذّر مغادرة الغرفة');
    }
  }

  async function copyCode() {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* النسخ غير متاح في هذا المتصفح */
    }
  }

  const selectedGame = room?.selected_game ?? 'sing';

  // الأدمن يغيّر اللعبة وهو في الغرفة (من غير ما يخرج ويعمل غرفة جديدة). الكل بيشوف التغيير لحظياً.
  async function changeGame(gameId: string) {
    if (gameId === selectedGame) {
      setPickingGame(false);
      return;
    }
    setSwitching(true);
    setError('');
    try {
      const updated = await selectGame(roomId, gameId);
      setRoom(updated);
      setPickingGame(false);
    } catch (e) {
      setError(gamesErrorText(e));
    }
    setSwitching(false);
  }

  async function begin() {
    setStarting(true);
    setError('');
    try {
      if (selectedGame === 'who_am_i') await startWhoAmI(roomId);
      else if (selectedGame === 'bus_complete') await startBusComplete(roomId);
      else await startGame(roomId);
    } catch (e) {
      setError(selectedGame === 'who_am_i' || selectedGame === 'bus_complete' ? gamesErrorText(e) : playErrorText(e));
    }
    setStarting(false);
  }

  if (!room) {
    return <main className="screen center"><p className="muted">{error || 'جارٍ التحميل…'}</p></main>;
  }

  const isAdmin = room.admin_id === me;
  const game = games.find((g) => g.id === selectedGame);
  const minPlayers = game?.min_players ?? RULES.minPlayers;
  const maxPlayers = game?.max_players ?? room.max_players;
  const missing = Math.max(0, minPlayers - players.length);
  const tooMany = players.length > maxPlayers;
  const needText = (n: number) => (n === 1 ? 'لاعباً واحداً' : n === 2 ? 'لاعبَين' : `${n} لاعبين`);

  if (showAdmin && isAdmin && me) return <AdminPanel room={room} players={players} me={me} onClose={() => setShowAdmin(false)} />;
  if (room.status === 'playing' && room.active_game === 'who_am_i') return <WhoAmIGame roomId={roomId} canExit={isAdmin} isAdmin={isAdmin} me={me ?? ''} players={players} onExit={() => void backToRoom()} onLeave={() => void leave()} />;
  if (room.status === 'playing' && room.active_game === 'bus_complete') return <BusCompleteGame roomId={roomId} canExit={isAdmin} isAdmin={isAdmin} me={me ?? ''} players={players} allowChat={room.allow_chat} onExit={() => void backFromBusComplete()} onLeave={() => void leave()} />;
  if (room.status === 'playing') return <GameScreen room={room} players={players} go={go} onSettings={isAdmin ? () => setShowAdmin(true) : undefined} />;
  if (room.status === 'finished') return <FinalScreen players={players} me={me ?? ''} isAdmin={isAdmin} roomId={roomId} onLeave={() => void leave()} />;

  return (
    <main className="screen">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <h2 className="display" style={{ fontSize: 30, margin: 0 }}>انتظار اللاعبين</h2>
        <button type="button" className="badge-soft code-chip" onClick={() => void copyCode()} aria-label="نسخ كود الغرفة">
          <span dir="ltr">{room.code}</span>
          <span style={{ fontSize: 12, marginInlineStart: 8 }}>{copied ? 'تم النسخ' : 'نسخ'}</span>
        </button>
      </div>
      <p className="muted" style={{ margin: 0 }}>{room.name} · {players.length} / {room.max_players} لاعباً · {room.visibility === 'public' ? 'غرفة عامة' : 'غرفة خاصة'}</p>
      <div className="game-chip">
        <span aria-hidden="true">{gameUi(selectedGame).icon}</span>
        <span style={{ flex: 1 }}>{gameTitle(games, selectedGame)}</span>
        {isAdmin && (
          <button type="button" className="link-btn" onClick={() => setPickingGame((o) => !o)}>
            {pickingGame ? 'إغلاق' : 'غيّر اللعبة'}
          </button>
        )}
      </div>
      {isAdmin && pickingGame && (
        <GamePicker
          games={games}
          selected={selectedGame}
          title="غيّر اللعبة"
          busy={switching}
          onSelect={(id) => void changeGame(id)}
          disabledReason={(g) => (players.length > g.max_players ? `اللعبة دي أقصاها ${g.max_players} لاعبين وعندكم ${players.length}` : null)}
        />
      )}

      <div className="list">
        {players.map((p) => (
          <div key={p.user_id} className="ticket">
            <Avatar id={p.user_id} name={p.profiles?.display_name ?? '?'} size={44} />
            <div style={{ flex: 1, fontWeight: 800, fontSize: 17 }}>{p.profiles?.display_name ?? 'لاعب'}{p.user_id === me ? ' (أنت)' : ''}</div>
            {p.user_id === room.admin_id && <span className="badge">الأدمن</span>}
          </div>
        ))}
      </div>

      <p className="muted" style={{ textAlign: 'center', margin: 0 }}>
        {tooMany ? `الحد الأقصى للعبة دي ${maxPlayers} لاعبين` : missing > 0 ? `ننتظر ${needText(missing)} على الأقل لبدء المباراة` : 'العدد مكتمل للبدء'}
      </p>
      {error && <p className="msg err" role="alert">{error}</p>}

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {isAdmin && (
          <button className="btn btn-gold submit" type="button" style={{ fontSize: 28, minHeight: 60 }} disabled={missing > 0 || tooMany || starting} onClick={() => void begin()}>
            {starting ? '...' : 'ابدأ المباراة'}
          </button>
        )}
        <div className="bottom-bar" style={{ borderTop: 0, paddingTop: 0 }}>
          <ChatPanel roomId={roomId} players={players} me={me ?? ''} enabled={room.allow_chat} />
          <div className="game-links" style={{ flex: 1 }}>
            {isAdmin && <button className="link-btn" type="button" onClick={() => setShowAdmin(true)}>إعدادات الغرفة</button>}
            <button className="link-btn" type="button" onClick={() => void leave()}>مغادرة الغرفة</button>
          </div>
        </div>
      </div>
    </main>
  );
}

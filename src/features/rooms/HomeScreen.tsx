import { useState, type CSSProperties } from 'react';
import type { Go } from '../../app/routes';
import Avatar from '../../ui/Avatar';
import BottomNav from '../../ui/BottomNav';
import { useAuth } from '../auth/AuthProvider';
import GameGrid from '../games/GameGrid';
import GameInfoSheet from '../games/GameInfoSheet';
import { useGameChoice } from '../games/useGameChoice';

export default function HomeScreen({ go }: { go: Go }) {
  const { profile } = useAuth();
  const { games, setGame } = useGameChoice();
  const [infoId, setInfoId] = useState<string | null>(null);
  const infoGame = games.find((g) => g.id === infoId);

  // دخول صفحة اللعبة (فيها: غرفة سريعة، إنشاء غرفة، الغرف المفتوحة)
  function open(id: string) {
    setGame(id);
    setInfoId(null);
    go({ name: 'game', game: id });
  }

  return (
    <main className="screen">
      <div className="home-head enter">
        <Avatar id={profile?.id ?? ''} name={profile?.display_name ?? '?'} size={52} />
        <div style={{ flex: 1 }}>
          <div className="display" style={{ fontSize: 24 }}>أهلاً، {profile?.display_name}</div>
          <div className="muted" style={{ fontSize: 14 }}>{profile?.total_points ?? 0} نقطة · {profile?.games_played ?? 0} مباراة</div>
        </div>
      </div>

      <h2 className="display home-title enter" style={{ '--d': 1 } as CSSProperties}>اختار لعبتك</h2>
      <GameGrid games={games} onOpen={open} onInfo={setInfoId} />

      <BottomNav current="home" go={go} />
      {infoGame && <GameInfoSheet game={infoGame} onClose={() => setInfoId(null)} onPlay={() => open(infoGame.id)} />}
    </main>
  );
}

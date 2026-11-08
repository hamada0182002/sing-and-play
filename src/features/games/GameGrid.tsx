import type { CSSProperties } from 'react';
import Icon from '../../ui/icons';
import type { GameInfo } from './api';
import GameArt from './GameArt';

interface Props {
  games: GameInfo[];
  onOpen: (gameId: string) => void;   // دخول صفحة اللعبة (غرف سريعة / إنشاء غرفة...)
  onInfo: (gameId: string) => void;   // شرح اللعبة
}

// شبكة كروت الألعاب في الصفحة الرئيسية
export default function GameGrid({ games, onOpen, onInfo }: Props) {
  return (
    <section className="game-grid" aria-label="الألعاب">
      {games.map((g, i) => (
        <article key={g.id} className="gtile" style={{ '--i': i } as CSSProperties}>
          <button type="button" className="gtile-main" aria-label={`العب ${g.title}`} onClick={() => onOpen(g.id)}>
            <GameArt id={g.id} />
            <span className="gtile-shade" aria-hidden="true" />
            <span className="gtile-foot">
              <span className="gtile-play" aria-hidden="true"><Icon name="play" size={22} /></span>
              <span className="gtile-text">
                <span className="gtile-title">{g.title}</span>
                <span className="gtile-sub">من {g.min_players} لـ {g.max_players} لاعبين</span>
              </span>
            </span>
          </button>
          <button type="button" className="gtile-info" aria-label={`معلومات عن ${g.title}`} onClick={() => onInfo(g.id)}>i</button>
        </article>
      ))}
    </section>
  );
}

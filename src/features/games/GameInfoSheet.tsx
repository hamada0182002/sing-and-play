import { useBackHandler } from '../../app/back';
import type { GameInfo } from './api';
import GameArt from './GameArt';
import { gameUi } from './gameUi';

interface Props {
  game: GameInfo;
  onClose: () => void;
  onPlay: () => void;
}

// نافذة شرح اللعبة (بتطلع من تحت، وزر الرجوع في أندرويد بيقفلها)
export default function GameInfoSheet({ game, onClose, onPlay }: Props) {
  useBackHandler(true, onClose);
  const ui = gameUi(game.id);
  return (
    <div className="gsheet-wrap" role="presentation" onClick={onClose}>
      <section className="gsheet" role="dialog" aria-modal="true" aria-label={game.title} onClick={(e) => e.stopPropagation()}>
        <div className="gsheet-art"><GameArt id={game.id} wide /></div>
        <h3 className="display">{game.title}</h3>
        {ui.blurb && <p className="muted">{ui.blurb}</p>}
        <div><span className="badge">من {game.min_players} لـ {game.max_players} لاعبين</span></div>
        {ui.howTo.length > 0 && (
          <>
            <div className="display" style={{ fontSize: 22, color: 'var(--butter)' }}>إزاي تلعب</div>
            <ol className="gsheet-steps">
              {ui.howTo.map((t) => <li key={t}>{t}</li>)}
            </ol>
          </>
        )}
        <button type="button" className="btn btn-gold submit" onClick={onPlay}>العب</button>
        <button type="button" className="link-btn" onClick={onClose}>إغلاق</button>
      </section>
    </div>
  );
}

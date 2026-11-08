import type { GameInfo } from './api';
import { gameUi } from './gameUi';

interface Props {
  games: GameInfo[];
  selected: string;
  onSelect: (gameId: string) => void;
}

// اختيار اللعبة في الصفحة الرئيسية (قبل إنشاء الغرفة أو دخولها)
export default function GamePicker({ games, selected, onSelect }: Props) {
  return (
    <section className="game-picker" aria-label="اختيار اللعبة">
      <h3 className="game-picker-title">اختار اللعبة</h3>
      {games.map((g) => {
        const ui = gameUi(g.id);
        const on = g.id === selected;
        return (
          <button key={g.id} type="button" className={`game-card${on ? ' on' : ''}`} aria-pressed={on} onClick={() => onSelect(g.id)}>
            <span className="game-icon" aria-hidden="true">{ui.icon}</span>
            <span style={{ flex: 1 }}>
              <span className="game-name">{g.title}</span>
              {ui.blurb && <span className="game-desc">{ui.blurb}</span>}
              <span className="game-desc">من {g.min_players} لـ {g.max_players} لاعبين</span>
            </span>
            {on && <span className="badge">المختارة</span>}
          </button>
        );
      })}
    </section>
  );
}

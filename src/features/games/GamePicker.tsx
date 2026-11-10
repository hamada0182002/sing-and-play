import type { GameInfo } from './api';
import { gameUi } from './gameUi';

interface Props {
  games: GameInfo[];
  selected: string;
  onSelect: (gameId: string) => void;
  title?: string;
  busy?: boolean;
  // لو رجّعت نص: اللعبة دي مقفولة والنص هو السبب (مثلاً عدد اللاعبين أكبر من أقصى عدد للعبة)
  disabledReason?: (g: GameInfo) => string | null;
}

// اختيار اللعبة: في الصفحة الرئيسية (قبل إنشاء الغرفة أو دخولها)، وفي انتظار الغرفة (الأدمن يغيّر اللعبة من غير ما يخرج)
export default function GamePicker({ games, selected, onSelect, title = 'اختار اللعبة', busy = false, disabledReason }: Props) {
  return (
    <section className="game-picker" aria-label={title}>
      <h3 className="game-picker-title">{title}</h3>
      {games.map((g) => {
        const ui = gameUi(g.id);
        const on = g.id === selected;
        const reason = on ? null : disabledReason?.(g) ?? null;
        return (
          <button key={g.id} type="button" className={`game-card${on ? ' on' : ''}`} aria-pressed={on} disabled={busy || !!reason} style={reason ? { opacity: 0.5 } : undefined} onClick={() => onSelect(g.id)}>
            <span className="game-icon" aria-hidden="true">{ui.icon}</span>
            <span style={{ flex: 1 }}>
              <span className="game-name">{g.title}</span>
              {ui.blurb && <span className="game-desc">{ui.blurb}</span>}
              <span className="game-desc">{reason ?? `من ${g.min_players} لـ ${g.max_players} لاعبين`}</span>
            </span>
            {on && <span className="badge">المختارة</span>}
          </button>
        );
      })}
    </section>
  );
}

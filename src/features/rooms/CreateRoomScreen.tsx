import { useState, type FormEvent } from 'react';
import type { Go } from '../../app/routes';
import { RULES } from '../../game/rules';
import { gameTitle, gameUi } from '../games/gameUi';
import { useGameChoice } from '../games/useGameChoice';
import { createRoom, roomErrorText } from './api';

export default function CreateRoomScreen({ go, initialVisibility }: { go: Go; initialVisibility?: 'public' | 'private' }) {
  const { games, game, info } = useGameChoice();
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>(initialVisibility ?? 'public');
  const [size, setSize] = useState<number>(RULES.maxPlayers);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // عدد اللاعبين لازم يناسب اللعبة (الغنا من 2 لـ15، أنا مين من 3 لـ10)
  const minSize = Math.max(RULES.minPlayers, info?.min_players ?? RULES.minPlayers);
  const maxSize = Math.min(RULES.maxPlayers, info?.max_players ?? RULES.maxPlayers);
  const shownSize = Math.min(Math.max(size, minSize), maxSize);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const room = await createRoom(name.trim(), visibility, shownSize, game);
      go({ name: 'lobby', roomId: room.id });
    } catch (err) {
      setError(roomErrorText(err));
      setBusy(false);
    }
  }

  return (
    <main className="screen">
      <h2 className="display" style={{ fontSize: 34, margin: 0 }}>إنشاء غرفة</h2>
      <div className="game-chip">
        <span aria-hidden="true">{gameUi(game).icon}</span>
        <span style={{ flex: 1 }}>{gameTitle(games, game)}</span>
        <button type="button" className="link-btn" onClick={() => go({ name: 'home' })}>تغيير اللعبة</button>
      </div>
      <form onSubmit={onSubmit} className="form">
        <label htmlFor="rn">اسم الغرفة</label>
        <input id="rn" className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} required />
        <label>نوع الغرفة</label>
        <div className="tabs">
          <button type="button" className={`tab ${visibility === 'public' ? 'on' : ''}`} onClick={() => setVisibility('public')}>عامة</button>
          <button type="button" className={`tab ${visibility === 'private' ? 'on' : ''}`} onClick={() => setVisibility('private')}>خاصة</button>
        </div>
        <p className="muted" style={{ fontSize: 14 }}>
          {visibility === 'public' ? 'تظهر في قائمة الغرف ويدخلها أي لاعب.' : 'لا تظهر في القائمة، ويدخلها من معه الكود فقط.'}
        </p>
        <label>عدد اللاعبين الأقصى</label>
        <div className="stepper">
          <button type="button" className="btn btn-outline small" aria-label="أقل" onClick={() => setSize(Math.max(minSize, shownSize - 1))}>−</button>
          <span className="display" style={{ fontSize: 36 }}>{shownSize}</span>
          <button type="button" className="btn btn-gold small" aria-label="أكثر" onClick={() => setSize(Math.min(maxSize, shownSize + 1))}>+</button>
        </div>
        {error && <p className="msg err" role="alert">{error}</p>}
        <button className="btn btn-gold submit" type="submit" disabled={busy}>{busy ? '...' : 'أنشئ الغرفة'}</button>
        <button className="btn btn-outline submit" type="button" onClick={() => go({ name: 'home' })}>رجوع</button>
      </form>
    </main>
  );
}

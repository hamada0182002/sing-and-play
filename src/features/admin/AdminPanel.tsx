import { useState } from 'react';
import { playErrorText } from '../play/api';
import type { LobbyPlayer, RoomRow } from '../rooms/api';
import { kickPlayer, updateRoomSettings } from './api';

function Switch({ label, on, disabled, onChange }: { label: string; on: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="row">
      <span style={{ flex: 1, fontWeight: 700 }}>{label}</span>
      <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} className={`switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)}><span /></button>
    </div>
  );
}

export default function AdminPanel({ room, players, me, onClose }: { room: RoomRow; players: LobbyPlayer[]; me: string; onClose: () => void }) {
  const [isPrivate, setIsPrivate] = useState(room.visibility === 'private');
  const [allowCards, setAllowCards] = useState(room.allow_cards);
  const [allowChat, setAllowChat] = useState(room.allow_chat);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      await action();
      return true;
    } catch (e) {
      setError(playErrorText(e));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (await run(() => updateRoomSettings(room.id, isPrivate ? 'private' : 'public', allowCards, allowChat))) setSaved(true);
  }

  return (
    <main className="screen">
      <h2 className="display" style={{ fontSize: 32, margin: 0 }}>إعدادات الغرفة</h2>
      <Switch label="غرفة خاصة" on={isPrivate} disabled={room.status !== 'waiting'} onChange={setIsPrivate} />
      {room.status !== 'waiting' && <p className="muted" style={{ fontSize: 13 }}>نوع الغرفة يتغيّر قبل بدء المباراة فقط</p>}
      <Switch label="السماح باستخدام الكروت" on={allowCards} onChange={setAllowCards} />
      <Switch label="السماح بالشات" on={allowChat} onChange={setAllowChat} />
      <button className="btn btn-gold submit" type="button" disabled={busy} onClick={() => void save()}>{saved ? 'تم الحفظ' : 'حفظ الإعدادات'}</button>

      <div className="display" style={{ fontSize: 24, color: 'var(--butter)', marginTop: 8 }}>اللاعبون</div>
      <div className="list">
        {players.map((p) => (
          <div key={p.user_id} className="row">
            <div className="avatar-sm display" aria-hidden="true">{(p.profiles?.display_name ?? '?').charAt(0)}</div>
            <div style={{ flex: 1, fontWeight: 800 }}>{p.profiles?.display_name ?? 'لاعب'}{p.user_id === me ? ' (أنت)' : ''}</div>
            {p.user_id !== me && (
              <button className="btn small" type="button" disabled={busy} style={{ background: 'var(--brick)', color: 'var(--ivory)', fontSize: 16, padding: '0 16px' }}
                onClick={() => { if (window.confirm(`طرد ${p.profiles?.display_name ?? 'اللاعب'} من الغرفة؟`)) void run(() => kickPlayer(room.id, p.user_id)); }}>طرد</button>
            )}
          </div>
        ))}
      </div>
      {error && <p className="msg err" role="alert">{error}</p>}
      <button className="btn btn-outline submit" type="button" onClick={onClose}>رجوع</button>
    </main>
  );
}

import Avatar from '../../ui/Avatar';
import type { PublicRoom } from './api';

export default function RoomRow({ room, busy, onJoin }: { room: PublicRoom; busy: boolean; onJoin: (code: string) => void }) {
  const full = room.player_count >= room.max_players;
  return (
    <div className="ticket">
      <Avatar id={room.id} name={room.name} size={48} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 17, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{room.name}</div>
        <div className="muted" style={{ fontSize: 13 }}>{room.player_count} / {room.max_players} لاعباً</div>
      </div>
      <button className="btn btn-gold small" type="button" disabled={busy || full} onClick={() => onJoin(room.code)}>{full ? 'ممتلئة' : 'انضم'}</button>
    </div>
  );
}

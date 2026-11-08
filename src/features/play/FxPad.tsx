import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { EFFECTS, playEffect, type EffectId } from './effects';

// الطبلات والمؤثرات: تُسمع عند كل لاعبي الغرفة. تتوقف عند المغني أثناء غنائه حتى لا تدخل في تسجيله.
export default function FxPad({ roomId, muted }: { roomId: string; muted: boolean }) {
  const [open, setOpen] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const lastSent = useRef(0);

  useEffect(() => {
    const channel = supabase!.channel(`fx-${roomId}`, { config: { broadcast: { self: false } } });
    channel
      .on('broadcast', { event: 'fx' }, ({ payload }) => {
        if (mutedRef.current) return;
        const id = (payload as { id?: string }).id;
        if (EFFECTS.some((e) => e.id === id)) playEffect(id as EffectId, 0.5);
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      void supabase!.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomId]);

  function fire(id: EffectId) {
    if (muted) return;
    const now = Date.now();
    if (now - lastSent.current < 400) return;
    lastSent.current = now;
    playEffect(id);
    void channelRef.current?.send({ type: 'broadcast', event: 'fx', payload: { id } });
  }

  return (
    <div>
      <button className="btn btn-outline small" type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}>الطبلات والمؤثرات</button>
      {open && (
        <div className="fx-pad">
          {muted && <p className="muted" style={{ width: '100%', margin: 0 }}>المؤثرات متوقفة أثناء غنائك حتى لا تدخل في التسجيل</p>}
          {EFFECTS.map((e) => (
            <button key={e.id} type="button" className="btn btn-flame small" disabled={muted} onClick={() => fire(e.id)}>{e.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

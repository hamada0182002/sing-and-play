import { useEffect, useRef, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { useBackHandler } from '../../app/back';
import Icon from '../../ui/icons';
import type { LobbyPlayer } from '../rooms/api';
import { chatErrorText, fetchMessages, sendMessage, type Msg } from './api';

export default function ChatPanel({ roomId, players, me, enabled }: { roomId: string; players: LobbyPlayer[]; me: string; enabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [unread, setUnread] = useState(0);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const openRef = useRef(open);
  openRef.current = open;
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let live = true;
    fetchMessages(roomId).then((m) => live && setMsgs(m)).catch(() => undefined);
    const channel = supabase!
      .channel(`chat-${roomId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` }, (payload) => {
        const m = payload.new as Msg;
        setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev.slice(-49), m]));
        if (!openRef.current && m.user_id !== me) setUnread((u) => u + 1);
      })
      .subscribe();
    return () => {
      live = false;
      void supabase!.removeChannel(channel);
    };
  }, [roomId, me]);

  useEffect(() => {
    if (open) setUnread(0);
    if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [open, msgs.length]);

  async function onSend(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setError('');
    try {
      await sendMessage(roomId, body);
      setText('');
      setMsgs(await fetchMessages(roomId));
    } catch (err) {
      setError(chatErrorText(err));
    }
  }

  useBackHandler(open, () => setOpen(false));

  if (!enabled) return null;
  const nameOf = (id: string) => players.find((p) => p.user_id === id)?.profiles?.display_name ?? 'لاعب';

  return (
    <>
      <button className="icon-btn" type="button" aria-label="الشات" onClick={() => setOpen(true)}><Icon name="chat" />{unread > 0 && <span className="dot">{unread}</span>}</button>
      {open && (
        <div className="chat-sheet" role="dialog" aria-label="الشات">
          <div className="chat-head">
            <span className="display" style={{ fontSize: 26 }}>الشات</span>
            <button className="btn btn-outline small" type="button" onClick={() => setOpen(false)}>إغلاق</button>
          </div>
          <div className="chat-list" ref={listRef}>
            {msgs.length === 0 && <p className="muted">لا توجد رسائل بعد</p>}
            {msgs.map((m) => (
              <div key={m.id} className={`bubble ${m.user_id === me ? 'mine' : ''}`}>
                <div className="bubble-name">{nameOf(m.user_id)}</div>
                {m.body}
              </div>
            ))}
          </div>
          {error && <p className="msg err" role="alert">{error}</p>}
          <form onSubmit={(e) => void onSend(e)} className="chat-form">
            <input className="field" value={text} onChange={(e) => setText(e.target.value)} maxLength={200} aria-label="اكتب رسالة" placeholder="اكتب رسالة…" />
            <button className="btn btn-gold small" type="submit" disabled={!text.trim()}>إرسال</button>
          </form>
        </div>
      )}
    </>
  );
}

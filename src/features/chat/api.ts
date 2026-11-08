import { supabase } from '../../lib/supabase';

export interface Msg {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
}

function db() {
  if (!supabase) throw new Error('no_backend');
  return supabase;
}

export async function fetchMessages(roomId: string): Promise<Msg[]> {
  const { data, error } = await db()
    .from('messages')
    .select('id, user_id, body, created_at')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data as Msg[]).reverse();
}

export async function sendMessage(roomId: string, body: string): Promise<void> {
  const { error } = await db().rpc('send_message', { p_room: roomId, p_body: body });
  if (error) throw error;
}

export function chatErrorText(e: unknown): string {
  const m = ((e as { message?: string })?.message ?? '').toLowerCase();
  if (m.includes('chat_disabled')) return 'الأدمن أوقف الشات';
  if (m.includes('too_fast')) return 'استنى ثانية قبل الرسالة التالية';
  return 'تعذّر إرسال الرسالة';
}

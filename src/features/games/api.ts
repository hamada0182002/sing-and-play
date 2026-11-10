import { supabase } from '../../lib/supabase';
import type { RoomRow } from '../rooms/api';

// نقطة واحدة لكل ما يخص اختيار الألعاب داخل الغرفة. لعبة الغنا بتتبدأ بدالتها القديمة (startGame في play/api).

export interface GameInfo {
  id: string;
  title: string;
  min_players: number;
  max_players: number;
  enabled: boolean;
  sort_order: number;
}

function db() {
  if (!supabase) throw new Error('backend_not_configured');
  return supabase;
}

export async function listGames(): Promise<GameInfo[]> {
  const { data, error } = await db().from('games').select('*').eq('enabled', true).order('sort_order');
  if (error) throw error;
  return data as GameInfo[];
}

// الأدمن بس: اختيار اللعبة قبل البدء (الكل بيشوف الاختيار لحظياً)
export async function selectGame(roomId: string, gameId: string): Promise<RoomRow> {
  const { data, error } = await db().rpc('select_game', { p_room: roomId, p_game: gameId });
  if (error) throw error;
  return data as RoomRow;
}

// الأدمن بس: الرجوع للغرفة بعد انتهاء لعبة أنا مين (أو إلغائها)
export async function returnToRoom(roomId: string): Promise<void> {
  const { error } = await db().rpc('return_to_room', { p_room: roomId });
  if (error) throw error;
}

// الأدمن بس: بدء لعبة أنا مين (الخادم بيتأكد من الأدمن والعدد وبيجهّز اللعبة)
export async function startWhoAmI(roomId: string): Promise<void> {
  const { data, error } = await db().functions.invoke('who-am-i', { body: { roomId, action: 'start' } });
  if (error) throw new Error('network');
  const r = data as { ok?: boolean; error?: { message?: string } } | null;
  if (!r || !r.ok) throw new Error(r?.error?.message ?? 'start_failed');
}

// الأدمن بس: بدء لعبة أتوبيس كومبليت (الخادم بيتأكد من الأدمن والعدد وبيجهّز اللعبة)
export async function startBusComplete(roomId: string): Promise<void> {
  const { data, error } = await db().functions.invoke('bus-complete', { body: { roomId, action: 'start' } });
  if (error) throw new Error('network');
  const r = data as { ok?: boolean; error?: { message?: string } } | null;
  if (!r || !r.ok) throw new Error(r?.error?.message ?? 'start_failed');
}

// الأدمن بس: الرجوع للغرفة بعد أتوبيس كومبليت (return_to_room الخاصة بـ«أنا مين؟» ما بتنفعش هنا)
export async function returnFromBusComplete(roomId: string): Promise<void> {
  const { data, error } = await db().functions.invoke('bus-complete', { body: { roomId, action: 'exit' } });
  if (error) throw new Error('network');
  const r = data as { ok?: boolean; error?: { message?: string } } | null;
  if (!r || !r.ok) throw new Error(r?.error?.message ?? 'exit_failed');
}

export function gamesErrorText(e: unknown): string {
  const m = e instanceof Error ? e.message : '';
  if (/[\u0600-\u06FF]/.test(m)) return m; // رسالة عربية جاهزة جاية من الخادم
  if (m === 'network') return 'مشكلة في الاتصال بالسيرفر، جرّب تاني';
  if (m.includes('not_admin')) return 'الأدمن فقط يقدر يعمل ده';
  if (m.includes('bad_phase')) return 'مش وقت ده دلوقتي';
  return 'حصل خطأ، جرّب تاني';
}

import type { CardType } from '../../game/rules';
import { supabase } from '../../lib/supabase';

export interface RoundRow {
  id: string;
  room_id: string;
  round_no: number;
  singer_id: string;
  letter: string;
  phase: 'thinking' | 'singing' | 'listening' | 'voting' | 'result';
  phase_ends_at: string | null;
  recording_path: string | null;
  recording_status: 'pending' | 'ready' | 'shared' | 'failed' | 'cancelled';
  attempt: number;
  approved: boolean;
  skipped: boolean;
  votes_count: number;
  voted_ids: string[];
  avg_stars: number | null;
  points: number;
  notice: string | null;
}

function db() {
  if (!supabase) throw new Error('no_backend');
  return supabase;
}

export async function fetchCurrentRound(roomId: string): Promise<RoundRow | null> {
  const { data, error } = await db()
    .from('rounds')
    .select('*')
    .eq('room_id', roomId)
    .order('round_no', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as RoundRow | null) ?? null;
}

export async function startGame(roomId: string): Promise<RoundRow> {
  const { data, error } = await db().rpc('start_game', { p_room: roomId });
  if (error) throw error;
  return data as RoundRow;
}

export async function advanceRound(roundId: string): Promise<RoundRow> {
  const { data, error } = await db().rpc('advance_round', { p_round: roundId });
  if (error) throw error;
  return data as RoundRow;
}

export async function finishTurn(roundId: string): Promise<RoundRow> {
  const { data, error } = await db().rpc('finish_turn', { p_round: roundId });
  if (error) throw error;
  return data as RoundRow;
}

export async function nextRound(roomId: string): Promise<RoundRow> {
  const { data, error } = await db().rpc('next_round', { p_room: roomId });
  if (error) throw error;
  return data as RoundRow;
}

export async function endGame(roomId: string): Promise<void> {
  const { error } = await db().rpc('end_game', { p_room: roomId });
  if (error) throw error;
}

// الفرق بين ساعة الجهاز وساعة الخادم بالمللي ثانية، عشان العداد يكون متطابقاً عند كل اللاعبين
export async function getServerOffset(): Promise<number> {
  const t0 = Date.now();
  const { data, error } = await db().rpc('server_now');
  const t1 = Date.now();
  if (error) throw error;
  return Date.parse(data as string) - (t0 + t1) / 2;
}

export function playErrorText(e: unknown): string {
  const m = ((e as { message?: string })?.message ?? '').toLowerCase();
  if (m.includes('not_admin')) return 'الأدمن فقط يقدر يعمل ده';
  if (m.includes('not_enough_players')) return 'لازم لاعبان على الأقل';
  if (m.includes('already_started')) return 'المباراة بدأت بالفعل';
  if (m.includes('not_singer')) return 'ده مش دورك';
  if (m.includes('round_not_finished')) return 'الدور لسه ما خلصش';
  if (m.includes('cards_disabled')) return 'الأدمن عطّل الكروت في الغرفة';
  if (m.includes('card_used')) return 'استخدمت الكارت ده قبل كده';
  if (m.includes('bad_phase')) return 'مش وقت ده دلوقتي';
  if (m.includes('force_pending')) return 'في إجبار لسه ما اتنفّذش';
  if (m.includes('self_vote')) return 'ماتقدرش تصوّت لنفسك';
  if (m.includes('recording_pending')) return 'التسجيل لسه بيترفع';
  if (m.includes('invalid_target')) return 'اللاعب المختار غير صالح';
  return 'حدث خطأ، حاول مرة أخرى';
}

export async function finishRecording(roundId: string, path: string | null, ok: boolean): Promise<RoundRow> {
  const { data, error } = await db().rpc('finish_recording', { p_round: roundId, p_path: path, p_ok: ok });
  if (error) throw error;
  return data as RoundRow;
}

// يحمّل التسجيل ويرجّع رابطاً مؤقتاً للتشغيل على هذا الجهاز
export async function downloadRecording(path: string): Promise<string> {
  const { data, error } = await db().storage.from('recordings').download(path);
  if (error || !data) throw error ?? new Error('download_failed');
  return URL.createObjectURL(data);
}

// الأدمن يحذف التسجيل بعد انتهاء الدور (فشل الحذف لا يوقف اللعب)
export async function deleteRecording(round: RoundRow): Promise<void> {
  if (!round.recording_path) return;
  await db().storage.from('recordings').remove([round.recording_path]).catch(() => undefined);
}

export async function startVoting(roundId: string): Promise<RoundRow> {
  const { data, error } = await db().rpc('start_voting', { p_round: roundId });
  if (error) throw error;
  return data as RoundRow;
}

export async function castVote(roundId: string, stars: number): Promise<RoundRow> {
  const { data, error } = await db().rpc('cast_vote', { p_round: roundId, p_stars: stars });
  if (error) throw error;
  return data as RoundRow;
}

export async function closeVoting(roundId: string): Promise<RoundRow> {
  const { data, error } = await db().rpc('close_voting', { p_round: roundId });
  if (error) throw error;
  return data as RoundRow;
}

export async function approveRound(roundId: string): Promise<RoundRow> {
  const { data, error } = await db().rpc('approve_round', { p_round: roundId });
  if (error) throw error;
  return data as RoundRow;
}

export async function playCard(roomId: string, card: CardType, target?: string): Promise<void> {
  const { error } = await db().rpc('use_card', { p_room: roomId, p_card: card, p_target: target ?? null });
  if (error) throw error;
}

export async function fetchMyCards(roomId: string, userId: string): Promise<CardType[]> {
  const { data, error } = await db().from('card_uses').select('card_type').eq('room_id', roomId).eq('user_id', userId);
  if (error) throw error;
  return (data as { card_type: CardType }[]).map((r) => r.card_type);
}

export async function shareRecording(roundId: string): Promise<RoundRow> {
  const { data, error } = await db().rpc('share_recording', { p_round: roundId });
  if (error) throw error;
  return data as RoundRow;
}

export async function cancelRecording(roundId: string): Promise<RoundRow> {
  const { data, error } = await db().rpc('cancel_recording', { p_round: roundId });
  if (error) throw error;
  return data as RoundRow;
}

export async function restartGame(roomId: string): Promise<void> {
  const { error } = await db().rpc('restart_game', { p_room: roomId });
  if (error) throw error;
}

// نبضة حضور: بتقول للسيرفر إني لسه متصل
export async function pingRoom(roomId: string): Promise<void> {
  const { error } = await db().rpc('ping_room', { p_room: roomId });
  if (error) throw error;
}

// السيرفر يتخطى دور المغني لو خرج أو انقطع اتصاله (ويرجّع الدور الحالي)
export async function skipAbsentSinger(roundId: string): Promise<RoundRow> {
  const { data, error } = await db().rpc('skip_absent_singer', { p_round: roundId });
  if (error) throw error;
  return data as RoundRow;
}

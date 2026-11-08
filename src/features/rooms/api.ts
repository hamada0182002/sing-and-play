import { supabase } from '../../lib/supabase';

export interface RoomRow {
  id: string;
  code: string;
  name: string;
  visibility: 'public' | 'private';
  status: 'waiting' | 'playing' | 'finished';
  admin_id: string;
  max_players: number;
  allow_cards: boolean;
  allow_chat: boolean;
  selected_game?: string;        // اللعبة اللي الغرفة اتعملت ليها (الافتراضي: sing)
  active_game?: string | null;   // اللعبة الشغالة دلوقتي (null = لعبة الغنا)
}

export interface PublicRoom {
  id: string;
  code: string;
  name: string;
  max_players: number;
  player_count: number;
  selected_game?: string;
}

export interface LobbyPlayer {
  user_id: string;
  joined_at: string;
  score: number;
  profiles: { display_name: string } | null;
}

function db() {
  if (!supabase) throw new Error('no_backend');
  return supabase;
}

// لو قاعدة البيانات لسه ما اتحدّثتش (0015) والغرفة للعبة الغنا، نستخدم الصيغة القديمة عشان التطبيق ما يقفش
function isMissingFunction(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === 'PGRST202';
}

export async function createRoom(name: string, visibility: 'public' | 'private', maxPlayers: number, game = 'sing'): Promise<RoomRow> {
  let { data, error } = await db().rpc('create_room', { p_name: name, p_visibility: visibility, p_max_players: maxPlayers, p_game: game });
  if (error && game === 'sing' && isMissingFunction(error)) {
    ({ data, error } = await db().rpc('create_room', { p_name: name, p_visibility: visibility, p_max_players: maxPlayers }));
  }
  if (error) throw error;
  return data as RoomRow;
}

export async function joinRoom(code: string): Promise<RoomRow> {
  const { data, error } = await db().rpc('join_room', { p_code: code });
  if (error) throw error;
  return data as RoomRow;
}

export async function leaveRoom(roomId: string): Promise<void> {
  const { error } = await db().rpc('leave_room', { p_room: roomId });
  if (error) throw error;
}

export async function listPublicRooms(game?: string): Promise<PublicRoom[]> {
  let { data, error } = await db().rpc('list_public_rooms', game ? { p_game: game } : {});
  if (error && isMissingFunction(error)) {
    ({ data, error } = await db().rpc('list_public_rooms'));
    if (!error && game) data = ((data ?? []) as PublicRoom[]).filter((r) => (r.selected_game ?? 'sing') === game);
  }
  if (error) throw error;
  return ((data ?? []) as PublicRoom[]).map((r) => ({ ...r, player_count: Number(r.player_count) }));
}

export async function fetchRoom(id: string): Promise<RoomRow | null> {
  const { data, error } = await db().from('rooms').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as RoomRow | null) ?? null;
}

export async function fetchPlayers(roomId: string): Promise<LobbyPlayer[]> {
  const { data, error } = await db()
    .from('room_players')
    .select('user_id, joined_at, score, profiles(display_name)')
    .eq('room_id', roomId)
    .order('joined_at');
  if (error) throw error;
  return data as unknown as LobbyPlayer[];
}

// الغرفة النشطة للاعب (لو أغلق الصفحة ورجع يلاقي نفسه فيها)
export async function findMyRoom(userId: string): Promise<string | null> {
  const { data, error } = await db()
    .from('room_players')
    .select('room_id, rooms!inner(status)')
    .eq('user_id', userId)
    .in('rooms.status', ['waiting', 'playing'])
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? (data as { room_id: string }).room_id : null;
}

export function roomErrorText(e: unknown): string {
  const m = ((e as { message?: string })?.message ?? '').toLowerCase();
  if (m.includes('room_not_found')) return 'لا توجد غرفة بهذا الكود';
  if (m.includes('room_full')) return 'الغرفة ممتلئة';
  if (m.includes('game_started')) return 'المباراة بدأت بالفعل';
  if (m.includes('invalid_name')) return 'اسم الغرفة من ٢ إلى ٣٠ حرفاً';
  if (m.includes('invalid_size')) return 'عدد اللاعبين غير مناسب للعبة دي';
  if (m.includes('unknown_game')) return 'اللعبة دي غير متاحة';
  return 'حدث خطأ، حاول مرة أخرى';
}

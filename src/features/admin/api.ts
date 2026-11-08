import { supabase } from '../../lib/supabase';
import type { RoomRow } from '../rooms/api';

function db() {
  if (!supabase) throw new Error('no_backend');
  return supabase;
}

export async function kickPlayer(roomId: string, userId: string): Promise<void> {
  const { error } = await db().rpc('kick_player', { p_room: roomId, p_user: userId });
  if (error) throw error;
}

export async function updateRoomSettings(roomId: string, visibility: 'public' | 'private', allowCards: boolean, allowChat: boolean): Promise<RoomRow> {
  const { error, data } = await db().rpc('update_room_settings', { p_room: roomId, p_visibility: visibility, p_allow_cards: allowCards, p_allow_chat: allowChat });
  if (error) throw error;
  return data as RoomRow;
}

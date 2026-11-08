import { GameAdapter } from './adapters/GameAdapter';

export class SupabaseAdapter extends GameAdapter {
  constructor(roomId: string, supabase: unknown, options?: { pollMs?: number; safetyTickMs?: number });
}

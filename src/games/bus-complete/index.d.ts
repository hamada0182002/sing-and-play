export type BusCompleteEvent = 'gameStarted' | 'questionStarted' | 'answerSubmitted' | 'cardUsed' | 'questionApproved' | 'scoreUpdated' | 'finalWagerLocked' | 'roundCompleted';
export const PLATFORM_EVENTS: BusCompleteEvent[];
export interface CommandResult { ok: boolean; view?: unknown; error?: { code: string; message: string } }
export class GameAdapter {
  init(): Promise<unknown>;
  subscribe(cb: (view: any) => void): () => void;
  getView(): any;
  on(event: BusCompleteEvent | '*', handler: (event: string, payload: Record<string, unknown>) => void): () => void;
  destroy(): void;
}
export class SupabaseAdapter extends GameAdapter {
  constructor(roomId: string, supabase: any, options?: { pollMs?: number; safetyTickMs?: number; functionName?: string; signalTable?: string });
}
export interface MountOptions { adapter: GameAdapter; onEvent?: (event: string, payload: Record<string, unknown>) => void; onExit?: () => void; skipIntro?: boolean; skipEntry?: boolean; skipQuestionIntro?: boolean }
export function mountBusComplete(container: HTMLElement, options: MountOptions): Promise<{ destroy: () => void }>;

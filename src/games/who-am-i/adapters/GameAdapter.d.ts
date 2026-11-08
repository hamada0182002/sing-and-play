export interface AdapterResult {
  ok: boolean;
  error?: { code: string; message: string };
}

export const PLATFORM_EVENTS: string[];

export class GameAdapter {
  constructor();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  init(): Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  subscribe(cb: (view: any) => void): () => void;
  getView(): unknown;
  startRound(): Promise<AdapterResult>;
  submitQuestion(args: { targetId: string; text: string }): Promise<AdapterResult>;
  cancelQuestion(args: { questionId: string }): Promise<AdapterResult>;
  submitAnswer(args: { questionId: string; answer: string }): Promise<AdapterResult>;
  requestGuess(): Promise<AdapterResult>;
  cancelGuess(): Promise<AdapterResult>;
  submitGuess(args: { choiceId: string }): Promise<AdapterResult>;
  tick(): Promise<AdapterResult>;
  advance(): Promise<AdapterResult>;
  on(eventName: string, handler: (eventName: string, payload: unknown) => void): () => void;
  emit(eventName: string, payload: unknown): void;
  destroy(): void;
}

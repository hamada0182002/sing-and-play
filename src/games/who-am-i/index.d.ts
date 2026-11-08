import type { GameAdapter } from './adapters/GameAdapter';

export { GameAdapter, PLATFORM_EVENTS } from './adapters/GameAdapter';

export interface MountOptions {
  adapter: GameAdapter;
  onEvent?: (name: string, payload: unknown) => void;
  onExit?: () => void;
  skipIntro?: boolean;
}

export function mountWhoAmI(container: HTMLElement, options: MountOptions): Promise<{ destroy: () => void }>;

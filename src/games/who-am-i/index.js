// نقطة الدخول العامة للوحدة. هذا هو الملف الوحيد الذي يستورده المشروع الأصلي.
//
//   import { mountWhoAmI } from 'games/who-am-i';
//   import 'games/who-am-i/styles/index.css';
//   const game = await mountWhoAmI(el, { adapter: new SupabaseAdapter(...), onEvent });
//   ... game.destroy();
import { WhoAmIController } from './logic/controller.js';

export { GameAdapter, PLATFORM_EVENTS } from './adapters/GameAdapter.js';

/**
 * @param {HTMLElement} container   عنصر بارتفاع محدّد (مثلاً 100dvh) يحتوي اللعبة
 * @param {{adapter: import('./adapters/GameAdapter.js').GameAdapter,
 *          onEvent?: (name:string, payload:Object)=>void,   // gameStarted … roundCompleted
 *          onExit?: ()=>void,                                // زر «رجوع للغرفة» في النهاية
 *          skipIntro?: boolean}} options
 */
export async function mountWhoAmI(container, { adapter, onEvent, onExit, skipIntro } = {}) {
  if (!adapter) throw new Error('mountWhoAmI: adapter is required');
  const controller = new WhoAmIController(container, adapter, { onEvent, onExit, skipIntro });
  await controller.start();
  return { controller, destroy: () => controller.destroy() };
}

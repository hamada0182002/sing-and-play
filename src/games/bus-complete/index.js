// نقطة الدخول العامة للعبة «أتوبيس كومبليت».
import { createController } from './hooks/controller.js';
export { GameAdapter, PLATFORM_EVENTS } from './adapters/GameAdapter.js';
export { SupabaseAdapter } from './adapters/SupabaseAdapter.js';

/**
 * يركّب اللعبة داخل عنصر. بيرجع { destroy() }.
 * @param {HTMLElement} container
 * @param {{adapter: import('./adapters/GameAdapter.js').GameAdapter, onEvent?:(name:string,payload:object)=>void, onExit?:()=>void, skipIntro?:boolean, skipEntry?:boolean, skipQuestionIntro?:boolean}} opts
 */
export async function mountBusComplete(container, { adapter, onEvent, onExit, skipIntro = false, skipEntry, skipQuestionIntro } = {}) {
  if (!adapter) throw new Error('mountBusComplete: adapter مطلوب');
  if (onEvent) adapter.on('*', onEvent);
  await adapter.init();
  return createController(container, { adapter, onExit, skipIntro, ...(skipEntry !== undefined && { skipEntry }), ...(skipQuestionIntro !== undefined && { skipQuestionIntro }) });
}

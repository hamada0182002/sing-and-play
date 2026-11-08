import { useCallback, useEffect, useRef, useState } from 'react';
import { leaveRoom } from '../features/rooms/api';
import { runBack } from './back';
import type { Go, Route } from './routes';

// تنقّل مرتبط بتاريخ المتصفح: زر الرجوع في أندرويد يرجّع للشاشة السابقة بدل ما يخرّج من التطبيق
const TABS = ['home', 'rooms', 'profile'];
interface Entry { sp: true; i: number }
const HOME: Route = { name: 'home' };

export function useRouter(enabled: boolean) {
  const [route, setRoute] = useState<Route>(HOME);
  const stack = useRef<Route[]>([HOME]);
  const resetting = useRef(false);

  const mark = (i: number): Entry => ({ sp: true, i });

  const resetToRoot = useCallback(() => {
    if (stack.current.length <= 1) {
      stack.current = [HOME];
      window.history.replaceState(mark(0), '');
      setRoute(HOME);
    } else {
      resetting.current = true;
      window.history.go(-(stack.current.length - 1));
    }
  }, []);

  const go: Go = useCallback((next) => {
    const cur = stack.current[stack.current.length - 1];
    if (next.name === 'home') {
      resetToRoot();
      return;
    }
    if (JSON.stringify(cur) === JSON.stringify(next)) return;
    const replace = (cur.name === 'create' && next.name === 'lobby') || (cur.name !== 'home' && TABS.includes(cur.name) && TABS.includes(next.name));
    if (replace) {
      stack.current[stack.current.length - 1] = next;
      window.history.replaceState(mark(stack.current.length - 1), '');
    } else {
      stack.current.push(next);
      window.history.pushState(mark(stack.current.length - 1), '');
    }
    setRoute(next);
  }, [resetToRoot]);

  // بداية الجلسة (أو تسجيل الخروج): ارجع للرئيسية، ولو اللاعب داخل غرفة افتحها فوقها
  const start = useCallback((roomId?: string) => {
    stack.current = [HOME];
    window.history.replaceState(mark(0), '');
    setRoute(HOME);
    if (roomId) {
      const lobby: Route = { name: 'lobby', roomId };
      stack.current.push(lobby);
      window.history.pushState(mark(1), '');
      setRoute(lobby);
    }
  }, []);

  const goBack = useCallback(() => window.history.back(), []);

  useEffect(() => {
    if (!enabled) return;
    const onPop = (e: PopStateEvent) => {
      if (resetting.current) {
        resetting.current = false;
        stack.current = [HOME];
        window.history.replaceState(mark(0), '');
        setRoute(HOME);
        return;
      }
      const idx = (e.state as Entry | null)?.i;
      const curIdx = stack.current.length - 1;
      if (typeof idx !== 'number' || idx === curIdx) return;
      if (idx > curIdx) {
        window.history.back();
        return;
      }
      // رجوع للخلف
      if (runBack()) {
        window.history.pushState(mark(curIdx), ''); // رجّعنا المكان بعد ما قفلنا الشاشة المنبثقة
        return;
      }
      const leaving = stack.current[curIdx];
      if (leaving.name === 'lobby') {
        if (!window.confirm('تغادر الغرفة؟')) {
          window.history.pushState(mark(curIdx), '');
          return;
        }
        stack.current = stack.current.slice(0, idx + 1);
        void leaveRoom(leaving.roomId).catch(() => undefined).finally(() => resetToRoot());
        return;
      }
      stack.current = stack.current.slice(0, idx + 1);
      setRoute(stack.current[idx]);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [enabled, resetToRoot]);

  return { route, go, goBack, start };
}

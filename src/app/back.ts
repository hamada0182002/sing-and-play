import { useEffect, useRef } from 'react';

// زر الرجوع (أندرويد): الشاشات المنبثقة (شات، إعدادات...) تسجّل هنا عشان الرجوع يقفلها بدل ما يخرّج المستخدم
const handlers: Array<() => boolean> = [];

export function runBack(): boolean {
  for (let i = handlers.length - 1; i >= 0; i--) {
    if (handlers[i]()) return true;
  }
  return false;
}

export function useBackHandler(active: boolean, onBack: () => void): void {
  const ref = useRef(onBack);
  ref.current = onBack;
  useEffect(() => {
    if (!active) return;
    const handler = () => {
      ref.current();
      return true;
    };
    handlers.push(handler);
    return () => {
      const i = handlers.lastIndexOf(handler);
      if (i >= 0) handlers.splice(i, 1);
    };
  }, [active]);
}

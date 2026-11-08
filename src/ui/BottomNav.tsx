import type { Go, Route } from '../app/routes';
import Icon, { type IconName } from './icons';

const ITEMS: { name: 'home' | 'rooms' | 'profile'; label: string; icon: IconName }[] = [
  { name: 'home', label: 'الرئيسية', icon: 'home' },
  { name: 'rooms', label: 'الغرف', icon: 'menu' },
  { name: 'profile', label: 'ملفي', icon: 'user' },
];

export default function BottomNav({ current, go }: { current: Route['name']; go: Go }) {
  return (
    <nav className="bottom-nav" aria-label="التنقل">
      {ITEMS.map((i) => (
        <button key={i.name} type="button" className={`nav-item ${current === i.name ? 'on' : ''}`} aria-current={current === i.name ? 'page' : undefined} onClick={() => go({ name: i.name })}>
          <Icon name={i.icon} />
          <span>{i.label}</span>
        </button>
      ))}
    </nav>
  );
}

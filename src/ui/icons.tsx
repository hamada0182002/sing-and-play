const PATHS = {
  home: 'M4 11l8-7 8 7v9H4z',
  menu: 'M4 6h16M4 12h16M4 18h16',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  chat: 'M4 5h16v11H9l-5 4z',
  play: 'M7 4l12 8-12 8z',
  back: 'M9 5l7 7-7 7',
  stop: 'M6 6h12v12H6z',
  second_chance: 'M4 12a8 8 0 1 0 3-6.2M4 4v4h4',
  skip_turn: 'M5 5l8 7-8 7zM17 5v14',
  deduct_points: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8 12h8',
  force_player: 'M5 12h13M13 7l5 5-5 5',
} as const;

export type IconName = keyof typeof PATHS;

export default function Icon({ name, size = 26 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

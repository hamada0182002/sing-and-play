export type Route =
  | { name: 'home' }
  | { name: 'create'; visibility?: 'public' | 'private' }
  | { name: 'game'; game: string }
  | { name: 'rooms' }
  | { name: 'profile' }
  | { name: 'sound' }
  | { name: 'lobby'; roomId: string };

export type Go = (route: Route) => void;

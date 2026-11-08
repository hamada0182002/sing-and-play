import { useEffect, useState } from 'react';
import { listGames, type GameInfo } from './api';
import { FALLBACK_GAMES } from './gameUi';

let cache: GameInfo[] = FALLBACK_GAMES;

// قايمة الألعاب: بتظهر فوراً من القايمة الاحتياطية، وبعدين بتتحدّث من قاعدة البيانات
export function useGames(): GameInfo[] {
  const [games, setGames] = useState<GameInfo[]>(cache);
  useEffect(() => {
    let live = true;
    listGames()
      .then((g) => {
        cache = g;
        if (live) setGames(g);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  return games;
}

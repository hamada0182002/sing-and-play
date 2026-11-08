import { useState } from 'react';
import type { GameInfo } from './api';
import { useGames } from './useGames';

// اللعبة اللي اللاعب اختارها من الصفحة الرئيسية (بتتحفظ على جهازه)
const KEY = 'sp.game';

function readStored(): string {
  try {
    return localStorage.getItem(KEY) || 'sing';
  } catch {
    return 'sing';
  }
}

function storeGame(id: string) {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* التخزين غير متاح */
  }
}

export interface GameChoice {
  games: GameInfo[];
  game: string;                 // معرّف اللعبة المختارة (دايماً صالح)
  info: GameInfo | undefined;   // بياناتها من قاعدة البيانات (لو اتحمّلت)
  setGame: (id: string) => void;
}

export function useGameChoice(): GameChoice {
  const games = useGames();
  const [stored, setStored] = useState(readStored);
  // لو اللعبة المحفوظة مش موجودة في القايمة (اتشالت مثلاً) نرجع لأول لعبة
  const game = games.length === 0 || games.some((g) => g.id === stored) ? stored : games[0].id;
  return {
    games,
    game,
    info: games.find((g) => g.id === game),
    setGame: (id: string) => {
      storeGame(id);
      setStored(id);
    },
  };
}

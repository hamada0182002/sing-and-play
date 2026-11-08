import type { CardType } from './rules';

export type RoomVisibility = 'public' | 'private';
export type RoomStatus = 'waiting' | 'playing' | 'finished';
export type RoundPhase = 'thinking' | 'singing' | 'listening' | 'voting' | 'result';

export interface Room {
  id: string;
  code: string;
  name: string;
  visibility: RoomVisibility;
  status: RoomStatus;
  adminId: string;
  maxPlayers: number;
}

export interface RoomPlayer {
  roomId: string;
  userId: string;
  displayName: string;
  score: number;
  usedCards: CardType[];
}

export interface Round {
  id: string;
  roomId: string;
  singerId: string;
  letter: string;
  phase: RoundPhase;
  phaseEndsAt: string | null;
}

import { useCallback, useEffect, useState } from 'react';
import { useBackHandler } from '../../app/back';
import { CARD_LABELS, CARD_TYPES, type CardType } from '../../game/rules';
import { supabase } from '../../lib/supabase';
import Icon from '../../ui/icons';
import type { LobbyPlayer } from '../rooms/api';
import { deleteRecording, fetchMyCards, playCard, playErrorText, type RoundRow } from './api';

const COLORS: Record<CardType, { bg: string; fg: string }> = {
  second_chance: { bg: 'var(--butter)', fg: 'var(--ground)' },
  skip_turn: { bg: 'var(--olive)', fg: 'var(--ground)' },
  deduct_points: { bg: 'var(--brick)', fg: 'var(--ivory)' },
  force_player: { bg: 'var(--flame)', fg: 'var(--ground)' },
};
const NEEDS_TARGET: CardType[] = ['deduct_points', 'force_player'];

export default function CardsBar({ roomId, round, players, me }: { roomId: string; round: RoundRow; players: LobbyPlayer[]; me: string }) {
  const [used, setUsed] = useState<CardType[]>([]);
  const [picking, setPicking] = useState<CardType | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useBackHandler(picking !== null, () => setPicking(null));

  const load = useCallback(() => fetchMyCards(roomId, me).then(setUsed).catch(() => undefined), [roomId, me]);

  useEffect(() => {
    void load();
    const channel = supabase!
      .channel(`cards-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'card_uses', filter: `room_id=eq.${roomId}` }, () => void load())
      .subscribe();
    return () => { void supabase!.removeChannel(channel); };
  }, [roomId, load]);

  const isSinger = round.singer_id === me;
  function allowed(card: CardType): boolean {
    if (used.includes(card)) return false;
    if (card === 'second_chance') return isSinger && !(round.approved && round.skipped) && ['listening', 'voting', 'result'].includes(round.phase);
    if (card === 'skip_turn') return isSinger && !(round.approved && round.skipped);
    return true;
  }

  async function use(card: CardType, target?: string) {
    setBusy(true);
    setError('');
    try {
      await playCard(roomId, card, target);
      if (card === 'second_chance') await deleteRecording(round);
      setPicking(null);
      await load();
    } catch (e) {
      setError(playErrorText(e));
    }
    setBusy(false);
  }

  function onTap(card: CardType) {
    if (!allowed(card) || busy) return;
    if (NEEDS_TARGET.includes(card)) {
      setPicking(card);
    } else if (window.confirm(`استخدام كارت «${CARD_LABELS[card]}»؟ يُستخدم مرة واحدة فقط في المباراة.`)) {
      void use(card);
    }
  }

  return (
    <div>
      <div className="gcards" aria-label="الكروت">
        {CARD_TYPES.map((c) => (
          <button key={c} type="button" className="gcard" disabled={!allowed(c) || busy} onClick={() => onTap(c)}
            aria-label={`${CARD_LABELS[c]}${used.includes(c) ? ' (مستخدم)' : ''}`}
            style={{ background: COLORS[c].bg, color: COLORS[c].fg, opacity: used.includes(c) ? 0.3 : allowed(c) ? 1 : 0.55 }}>
            <Icon name={c} size={20} />
            <span>{CARD_LABELS[c]}</span>
          </button>
        ))}
      </div>
      {picking && (
        <div className="picker" role="dialog" aria-label="اختر لاعباً">
          <div style={{ fontWeight: 800 }}>{picking === 'deduct_points' ? 'اختر لاعباً لخصم ١٠ نقاط منه' : 'اختر لاعباً ليغني نفس الحرف في الدور القادم'}</div>
          {players.filter((p) => p.user_id !== me).map((p) => (
            <button key={p.user_id} type="button" className="btn btn-outline small" disabled={busy} onClick={() => void use(picking, p.user_id)}>{p.profiles?.display_name ?? 'لاعب'}</button>
          ))}
          <button type="button" className="btn small" style={{ background: 'transparent', color: 'var(--muted)' }} onClick={() => setPicking(null)}>إلغاء</button>
        </div>
      )}
      {error && <p className="msg err" role="alert">{error}</p>}
    </div>
  );
}

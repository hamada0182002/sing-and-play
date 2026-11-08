import { useState } from 'react';
import { castVote, playErrorText, type RoundRow } from './api';

export default function VotePanel({ round }: { round: RoundRow }) {
  const [stars, setStars] = useState<number | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function send() {
    setBusy(true);
    setError('');
    try {
      await castVote(round.id, stars ?? 0);
      setSent(true);
    } catch (e) {
      setError(playErrorText(e));
    }
    setBusy(false);
  }

  function pick(n: number) {
    setStars(n);
    setSent(false);
  }

  const label = sent ? 'تم تسجيل تصويتك' : stars !== null ? `أرسل تقييمك (${stars} من ٥)` : 'اختر تقييمك';

  return (
    <div className="vote-box">
      <div className="stars" dir="ltr" role="group" aria-label="التقييم من ٠ إلى ٥">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" aria-label={`${n} من 5`} aria-pressed={(stars ?? 0) >= n} className={`star ${(stars ?? 0) >= n ? 'on' : ''}`} onClick={() => pick(n)}>★</button>
        ))}
      </div>
      <div className="nums" dir="ltr">
        {[0, 1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" className={`num-btn ${stars === n ? 'on' : ''}`} onClick={() => pick(n)}>{n}</button>
        ))}
      </div>
      <button className="btn btn-gold submit" type="button" style={{ fontSize: 24, minHeight: 50, marginTop: 2 }} disabled={stars === null || busy || sent} onClick={() => void send()}>{label}</button>
      {error && <p className="msg err" role="alert">{error}</p>}
    </div>
  );
}

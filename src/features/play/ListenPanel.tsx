import { useEffect, useRef, useState } from 'react';
import Icon from '../../ui/icons';
import { downloadRecording, type RoundRow } from './api';

const BARS = [14, 30, 22, 40, 18, 34, 26, 38, 16, 28, 36, 20, 32, 12];

export default function ListenPanel({ round, singerName }: { round: RoundRow; singerName: string; isSinger?: boolean; isAdmin?: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const status = round.recording_status;
  // التسجيل يتبعت للجميع تلقائياً أول ما يخلص رفعه (المغني مابيسمعوش قبل كده)
  const canHear = status === 'shared';

  useEffect(() => {
    if (!canHear || !round.recording_path) return;
    let live = true;
    let objectUrl = '';
    downloadRecording(round.recording_path)
      .then((u) => {
        if (!live) return URL.revokeObjectURL(u);
        objectUrl = u;
        setUrl(u);
      })
      .catch(() => live && setError('تعذّر تحميل التسجيل'));
    return () => {
      live = false;
      audioRef.current?.pause();
      audioRef.current = null;
      setPlaying(false);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [canHear, round.recording_path]);

  function toggle() {
    if (!url) return;
    if (!audioRef.current) {
      const a = new Audio(url);
      a.onended = () => setPlaying(false);
      audioRef.current = a;
    }
    const a = audioRef.current;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      a.play().then(() => setPlaying(true)).catch(() => setError('تعذّر تشغيل التسجيل'));
    }
  }

  if (status === 'failed') return <p className="msg err" role="alert">تعذّر تسجيل غناء {singerName}</p>;
  if (status === 'pending') return <p className="msg ok" style={{ textAlign: 'center' }}>{error || `جارٍ رفع تسجيل ${singerName}…`}</p>;

  if (status === 'ready') return <p className="msg ok" style={{ textAlign: 'center' }}>جارٍ إرسال تسجيل {singerName}…</p>;

  return (
    <div className="listen-wrap">
      <div className="listen-row">
        <div className="wave-box">
          <div className={`wave ${playing ? 'on' : ''}`} aria-hidden="true">
            {BARS.map((h, i) => <span key={i} style={{ height: h, animationDelay: `${(i % 5) * 0.12}s` }} />)}
          </div>
        </div>
        {!url ? (
          <p className="muted" style={{ fontSize: 14 }}>{error || 'جارٍ تحميل التسجيل…'}</p>
        ) : (
          <button className="btn btn-flame" type="button" onClick={toggle}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name={playing ? 'stop' : 'play'} size={20} />{playing ? 'إيقاف' : 'تشغيل'}</span>
          </button>
        )}
      </div>
      {error && url && <p className="msg err" role="alert">{error}</p>}
    </div>
  );
}

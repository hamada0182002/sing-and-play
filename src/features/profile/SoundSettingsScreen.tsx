import { useEffect, useRef, useState } from 'react';
import { BEATS, DEFAULT_SYNC_MS, loadSyncMs, saveSyncMs, type BeatId } from '../play/beats';
import { loadBeat, previewBeat, previewingId, recordSyncTest, resumeAudio, stopPreview } from '../play/mixer';

const MIC_VOL = 100;
const BEAT_VOL = 60;

// ضبط تزامن الطبلة مع صوتك مرة واحدة قبل اللعب (القيمة تتحفظ على الجهاز)
export default function SoundSettingsScreen({ onBack }: { onBack: () => void }) {
  const [beatId, setBeatId] = useState<BeatId>('shaabi');
  const [sync, setSync] = useState<number>(loadSyncMs);
  const [previewing, setPreviewing] = useState<BeatId | null>(null);
  const [test, setTest] = useState<'idle' | 'rec' | 'ready' | 'play'>('idle');
  const [error, setError] = useState('');
  const testUrl = useRef<string | null>(null);
  const testAudio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => {
    stopPreview();
    testAudio.current?.pause();
    if (testUrl.current) URL.revokeObjectURL(testUrl.current);
  }, []);

  function changeSync(v: number) {
    setSync(v);
    saveSyncMs(v);
  }

  async function selectBeat(id: BeatId) {
    setError('');
    setBeatId(id);
    try {
      await resumeAudio();
      await loadBeat(id);
    } catch {
      setError('ملف الطبلة مش موجود أو تالف');
    }
  }

  async function togglePreview(id: BeatId) {
    setError('');
    if (previewingId() === id) {
      stopPreview();
      setPreviewing(null);
      return;
    }
    try {
      await previewBeat(id, BEAT_VOL);
      setPreviewing(id);
    } catch {
      setPreviewing(null);
      setError('ملف الطبلة مش موجود أو تالف');
    }
  }

  async function runTest() {
    setError('');
    testAudio.current?.pause();
    stopPreview();
    setPreviewing(null);
    setTest('rec');
    let mic: MediaStream | null = null;
    try {
      mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      const blob = await recordSyncTest(mic, beatId, MIC_VOL, BEAT_VOL, sync, 6);
      if (testUrl.current) URL.revokeObjectURL(testUrl.current);
      testUrl.current = URL.createObjectURL(blob);
      setTest('ready');
    } catch {
      setTest('idle');
      setError('تعذّر تشغيل التجربة. تأكد من السماح بالميكروفون ووجود ملف الطبلة.');
    } finally {
      mic?.getTracks().forEach((t) => t.stop());
    }
  }

  function playTest() {
    if (!testUrl.current) return;
    testAudio.current?.pause();
    const a = new Audio(testUrl.current);
    testAudio.current = a;
    a.onended = () => setTest('ready');
    void a.play().then(() => setTest('play')).catch(() => setError('تعذّر تشغيل التجربة'));
  }

  return (
    <main className="screen">
      <h2 className="display" style={{ fontSize: 32, margin: 0 }}>ضبط الصوت والتزامن</h2>
      <p className="muted">
        بتضبط هنا تزامن الطبلة مع صوتك مرة واحدة، وبتتحفظ على جهازك وتتطبق في كل مباراة. جرّب بنفس السماعة اللي هتلعب بيها.
      </p>

      <div className="beat-picker">
        <div style={{ fontWeight: 800 }}>اختر إيقاعاً للتجربة</div>
        <div className="beat-row">
          {BEATS.map((b) => (
            <div key={b.id} className="beat-item">
              <button type="button" className={`beat-opt ${beatId === b.id ? 'on' : ''}`} aria-pressed={beatId === b.id} onClick={() => void selectBeat(b.id)}>{b.label}</button>
              <button type="button" className="beat-prev" aria-label={`معاينة ${b.label}`} onClick={() => void togglePreview(b.id)}>{previewing === b.id ? 'إيقاف' : 'معاينة'}</button>
            </div>
          ))}
        </div>

        <label className="range-row">ضبط التزامن: {sync} مللي ثانية
          <input type="range" min={-400} max={600} step={10} value={sync} onChange={(e) => changeSync(Number(e.target.value))} />
        </label>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-flame small" disabled={test === 'rec'} onClick={() => void runTest()}>
            {test === 'rec' ? 'غنّي مع الطبلة…' : 'جرّب التزامن (٦ ثواني)'}
          </button>
          {(test === 'ready' || test === 'play') && <button type="button" className="btn btn-gold small" onClick={playTest}>اسمع التجربة</button>}
          <button type="button" className="btn btn-outline small" onClick={() => changeSync(DEFAULT_SYNC_MS)}>إعادة الضبط</button>
        </div>
      </div>

      <p className="muted" style={{ fontSize: 14 }}>
        بعد «اسمع التجربة»: لو الطبلة بتيجي بعد صوتك حرّك الشريط ناحية السالب (مثلاً −١٥٠)، ولو بتيجي قبل صوتك زوّد الرقم (مثلاً +١٥٠). كرر لحد ما يتظبط.
        سماعات البلوتوث بتأخر كتير، والسلكية أدق.
      </p>
      {error && <p className="msg err" role="alert">{error}</p>}
      <button className="btn btn-outline submit" type="button" onClick={onBack}>رجوع</button>
    </main>
  );
}

import { useEffect, useState } from 'react';
import { BEATS, type BeatId, type MixSettings } from './beats';
import { loadBeat, previewBeat, previewingId, resumeAudio, setPreviewVolume, stopPreview } from './mixer';

// اختيار الطبلة + معاينتها + مستوى الصوت (للمغني فقط، وقت التفكير والغناء)
export default function BeatPicker({ settings, onChange, locked }: { settings: MixSettings; onChange: (s: MixSettings) => void; locked: boolean }) {
  const [previewing, setPreviewing] = useState<BeatId | null>(null);
  const [error, setError] = useState('');

  useEffect(() => () => stopPreview(), []);
  useEffect(() => {
    if (locked) {
      stopPreview();
      setPreviewing(null);
    }
  }, [locked]);
  useEffect(() => setPreviewVolume(settings.beatVol), [settings.beatVol]);

  async function select(id: BeatId | null) {
    if (locked) return;
    setError('');
    onChange({ ...settings, beatId: id });
    if (!id) return;
    try {
      await resumeAudio(); // الضغطة دي بتفعّل الصوت في المتصفح
      await loadBeat(id);
    } catch {
      setError('ملف الطبلة مش موجود أو تالف');
      onChange({ ...settings, beatId: null });
    }
  }

  async function togglePreview(id: BeatId) {
    if (locked) return;
    setError('');
    if (previewingId() === id) {
      stopPreview();
      setPreviewing(null);
      return;
    }
    try {
      await previewBeat(id, settings.beatVol);
      setPreviewing(id);
    } catch {
      setPreviewing(null);
      setError('ملف الطبلة مش موجود أو تالف');
    }
  }

  return (
    <div className="beat-picker">
      <div style={{ fontWeight: 800, fontSize: 14 }}>الطبلة (اختياري)</div>
      <div className="beat-row">
        <button type="button" className={`beat-opt ${settings.beatId === null ? 'on' : ''}`} aria-pressed={settings.beatId === null} disabled={locked} onClick={() => void select(null)}>بدون</button>
        {BEATS.map((b) => (
          <div key={b.id} className="beat-item">
            <button type="button" className={`beat-opt ${settings.beatId === b.id ? 'on' : ''}`} aria-pressed={settings.beatId === b.id} disabled={locked} onClick={() => void select(b.id)}>{b.label}</button>
            <button type="button" className="beat-prev" aria-label={`معاينة ${b.label}`} disabled={locked} onClick={() => void togglePreview(b.id)}>{previewing === b.id ? 'إيقاف' : 'معاينة'}</button>
          </div>
        ))}
      </div>
      <label className="range-row">صوت الميكروفون
        <input type="range" min={0} max={150} value={settings.micVol} onChange={(e) => onChange({ ...settings, micVol: Number(e.target.value) })} />
      </label>
      <label className="range-row">صوت الطبلة
        <input type="range" min={0} max={100} value={settings.beatVol} disabled={settings.beatId === null && !previewing} onChange={(e) => onChange({ ...settings, beatVol: Number(e.target.value) })} />
      </label>
      <p className="beat-note">صوت الطبلة بيوطي لوحده أول ما التسجيل يبدأ. سماعات الرأس أفضل.</p>
      {error && <p className="msg err" role="alert">{error}</p>}
    </div>
  );
}

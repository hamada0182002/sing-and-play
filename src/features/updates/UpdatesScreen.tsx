import { useEffect, useRef, useState } from 'react';
import {
  canInstallPackages,
  checkForUpdate,
  downloadUpdate,
  getInstalled,
  installUpdate,
  openInstallSettings,
  type InstalledInfo,
  type VersionInfo,
} from './updater';

type Phase =
  | { name: 'idle' }
  | { name: 'checking' }
  | { name: 'uptodate' }
  | { name: 'available'; latest: VersionInfo }
  | { name: 'needPermission'; latest: VersionInfo }
  | { name: 'downloading'; latest: VersionInfo; ratio: number }
  | { name: 'installing'; latest: VersionInfo; path: string };

export default function UpdatesScreen({ onBack }: { onBack: () => void }) {
  const [installed, setInstalled] = useState<InstalledInfo | null>(null);
  const [phase, setPhase] = useState<Phase>({ name: 'idle' });
  const [error, setError] = useState('');
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    getInstalled().then((i) => alive.current && setInstalled(i)).catch(() => undefined);
    return () => { alive.current = false; };
  }, []);

  const msg = (e: unknown) => (e instanceof Error ? e.message : 'حدث خطأ غير متوقع');

  async function check() {
    setError('');
    setPhase({ name: 'checking' });
    try {
      const r = await checkForUpdate();
      if (!alive.current) return;
      setInstalled(r.installed);
      setPhase(r.kind === 'uptodate' ? { name: 'uptodate' } : { name: 'available', latest: r.latest });
    } catch (e) {
      if (!alive.current) return;
      setError(msg(e));
      setPhase({ name: 'idle' });
    }
  }

  async function start(latest: VersionInfo) {
    setError('');
    try {
      if (!(await canInstallPackages())) {
        setPhase({ name: 'needPermission', latest });
        return;
      }
      setPhase({ name: 'downloading', latest, ratio: 0 });
      const path = await downloadUpdate(latest, (ratio) => alive.current && setPhase({ name: 'downloading', latest, ratio }));
      if (!alive.current) return;
      setPhase({ name: 'installing', latest, path });
      await installUpdate(path);
    } catch (e) {
      if (!alive.current) return;
      setError(msg(e));
      setPhase({ name: 'available', latest });
    }
  }

  const busy = phase.name === 'checking' || phase.name === 'downloading';

  return (
    <main className="screen center">
      <h2 className="display" style={{ fontSize: 36, margin: 0 }}>التحديثات</h2>
      <p className="muted" dir="ltr">
        {installed ? `الإصدار الحالي: ${installed.versionName} (${installed.versionCode})` : '…'}
      </p>

      {error && <p className="msg err" role="alert">{error}</p>}
      {phase.name === 'uptodate' && <p className="msg ok">أنت تستخدم أحدث إصدار</p>}

      {(phase.name === 'available' || phase.name === 'needPermission' || phase.name === 'downloading' || phase.name === 'installing') && (
        <div className="card" style={{ width: '100%', textAlign: 'start' }}>
          <div className="display" style={{ fontSize: 26, color: 'var(--butter)' }} dir="ltr">
            {phase.latest.versionName}
          </div>
          <p className="muted" style={{ marginBottom: 6 }}>إصدار جديد متاح</p>
          {phase.latest.notes.length > 0 && (
            <ul style={{ margin: 0, paddingInlineStart: 20 }}>
              {phase.latest.notes.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          )}
        </div>
      )}

      {phase.name === 'needPermission' && (
        <>
          <p className="msg err">
            لتثبيت التحديث لازم تسمح للتطبيق بتثبيت التطبيقات: اضغط «فتح الإعدادات»، فعّل «السماح من هذا المصدر»، ثم ارجع للتطبيق واضغط تحميل مرة أخرى.
          </p>
          <button className="btn btn-gold" type="button" onClick={() => void openInstallSettings()}>فتح الإعدادات</button>
        </>
      )}

      {phase.name === 'downloading' && (
        <div style={{ width: '100%' }}>
          <div style={{ height: 14, borderRadius: 8, background: 'var(--surface)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${phase.ratio >= 0 ? Math.round(phase.ratio * 100) : 100}%`, background: 'var(--butter)', transition: 'width .2s' }} />
          </div>
          <p className="muted" style={{ marginTop: 8 }}>
            {phase.ratio >= 0 ? `جارٍ التحميل… ${Math.round(phase.ratio * 100)}%` : 'جارٍ التحميل…'}
          </p>
        </div>
      )}

      {phase.name === 'installing' && (
        <>
          <p className="msg ok">تم التحميل. أكّد التثبيت في نافذة أندرويد.</p>
          <button className="btn btn-gold" type="button" onClick={() => void installUpdate(phase.path).catch((e) => setError(msg(e)))}>فتح المثبّت مرة أخرى</button>
        </>
      )}

      {(phase.name === 'available' || phase.name === 'needPermission') && (
        <button className="btn btn-gold" type="button" onClick={() => void start(phase.latest)}>تحميل وتثبيت التحديث</button>
      )}

      <button className="btn btn-outline" type="button" onClick={() => void check()} disabled={busy || phase.name === 'installing'}>
        {phase.name === 'checking' ? 'جارٍ البحث…' : 'البحث عن تحديثات'}
      </button>
      <button className="btn btn-outline" type="button" onClick={onBack}>رجوع</button>
    </main>
  );
}

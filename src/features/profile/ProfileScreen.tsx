import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { isNativeApp } from '../updates/updater';

export default function ProfileScreen({ onBack, onSound, onUpdates }: { onBack: () => void; onSound: () => void; onUpdates?: () => void }) {
  const { profile, session, refreshProfile, signOut } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile?.display_name ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // تحديث الإحصائيات كل ما تتفتح الشاشة (بعد المباريات)
  useEffect(() => { void refreshProfile(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!profile || !session) {
    return <main className="screen"><p className="muted">تعذّر تحميل الملف الشخصي. أعد تحميل الصفحة.</p></main>;
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    const next = name.trim();
    if (next.length < 2 || next.length > 20) {
      setError('الاسم من ٢ إلى ٢٠ حرفاً');
      return;
    }
    setBusy(true);
    setError('');
    const { error: err } = await supabase!.from('profiles').update({ display_name: next }).eq('id', session!.user.id);
    setBusy(false);
    if (err) {
      setError('تعذّر حفظ الاسم');
      return;
    }
    await refreshProfile();
    setEditing(false);
  }

  const stats = [
    { label: 'مباريات', value: profile.games_played, color: 'var(--butter)' },
    { label: 'انتصارات', value: profile.wins, color: 'var(--flame)' },
    { label: 'النقاط', value: profile.total_points, color: 'var(--olive)' },
    { label: 'متوسط النجوم', value: profile.stars_rounds > 0 ? (Number(profile.stars_sum) / profile.stars_rounds).toFixed(1) : '—', color: 'var(--butter)' },
  ];

  return (
    <main className="screen center">
      <div className="avatar display" aria-hidden="true">{profile.display_name.charAt(0)}</div>
      {editing ? (
        <form onSubmit={save} className="form" style={{ width: '100%' }}>
          <label htmlFor="dn">اسم اللاعب</label>
          <input id="dn" className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={20} />
          {error && <p className="msg err" role="alert">{error}</p>}
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-gold" style={{ flex: 1 }} type="submit" disabled={busy}>حفظ</button>
            <button className="btn btn-outline" style={{ flex: 1 }} type="button" onClick={() => { setEditing(false); setName(profile.display_name); setError(''); }}>إلغاء</button>
          </div>
        </form>
      ) : (
        <>
          <h2 className="display" style={{ fontSize: 36, margin: 0 }}>{profile.display_name}</h2>
          <button className="btn btn-outline small" type="button" onClick={() => setEditing(true)}>تعديل الاسم</button>
        </>
      )}
      <div className="stats4">
        {stats.map((s) => (
          <div key={s.label} className="card">
            <div className="display" style={{ fontSize: 36, color: s.color }}>{s.value}</div>
            <div className="muted">{s.label}</div>
          </div>
        ))}
      </div>
      <button className="btn btn-outline" type="button" onClick={onSound}>ضبط الصوت والتزامن</button>
      {isNativeApp() && onUpdates && <button className="btn btn-outline" type="button" onClick={onUpdates}>التحديثات</button>}
      <button className="btn btn-outline" type="button" onClick={onBack}>رجوع</button>
      <button className="btn btn-outline" type="button" onClick={() => void signOut()}>تسجيل الخروج</button>
    </main>
  );
}

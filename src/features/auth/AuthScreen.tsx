import { useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';

type Mode = 'login' | 'signup';

function arabicError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'البريد أو كلمة المرور غير صحيحة';
  if (m.includes('already registered')) return 'هذا البريد مسجّل بالفعل';
  if (m.includes('email not confirmed')) return 'فعّل بريدك أولاً من رسالة التأكيد';
  if (m.includes('at least 6')) return 'كلمة المرور لا تقل عن ٦ أحرف';
  if (m.includes('rate limit')) return 'محاولات كثيرة، انتظر قليلاً ثم أعد المحاولة';
  if (m.includes('valid email') || m.includes('invalid email')) return 'صيغة البريد غير صحيحة';
  return 'حدث خطأ، حاول مرة أخرى';
}

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setError('');
    setNotice('');
    if (mode === 'signup' && (name.trim().length < 2 || name.trim().length > 20)) {
      setError('الاسم من ٢ إلى ٢٠ حرفاً');
      return;
    }
    if (password.length < 6) {
      setError('كلمة المرور لا تقل عن ٦ أحرف');
      return;
    }
    setBusy(true);
    if (mode === 'login') {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) setError(arabicError(err.message));
    } else {
      const { data, error: err } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: name.trim() } },
      });
      if (err) setError(arabicError(err.message));
      else if (!data.session) setNotice('تم إنشاء الحساب. افتح بريدك وفعّل الحساب ثم سجّل الدخول.');
    }
    setBusy(false);
  }

  return (
    <main className="screen">
      <h1 className="display logo">
        SING <span style={{ color: 'var(--flame)' }}>&amp;</span> <span style={{ color: 'var(--butter)' }}>PLAY</span>
      </h1>
      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'login'} className={`tab ${mode === 'login' ? 'on' : ''}`} onClick={() => setMode('login')}>دخول</button>
        <button type="button" role="tab" aria-selected={mode === 'signup'} className={`tab ${mode === 'signup' ? 'on' : ''}`} onClick={() => setMode('signup')}>حساب جديد</button>
      </div>
      <form onSubmit={onSubmit} className="form">
        {mode === 'signup' && (
          <>
            <label htmlFor="name">اسم اللاعب</label>
            <input id="name" className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={20} autoComplete="nickname" required />
          </>
        )}
        <label htmlFor="email">البريد الإلكتروني</label>
        <input id="email" className="field" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        <label htmlFor="password">كلمة المرور</label>
        <input id="password" className="field" type="password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required />
        {error && <p className="msg err" role="alert">{error}</p>}
        {notice && <p className="msg ok" role="status">{notice}</p>}
        <button className="btn btn-gold submit" type="submit" disabled={busy}>
          {busy ? '...' : mode === 'login' ? 'ادخل' : 'أنشئ الحساب'}
        </button>
      </form>
    </main>
  );
}

export default function SplashScreen({ onStart }: { onStart: () => void }) {
  return (
    <main className="screen center splash" style={{ gap: 30 }}>
      <div className="splash-disc-wrap" aria-hidden="true">
        <span className="splash-ring" />
        <span className="splash-ring r2" />
        <div className="disc-splash" />
      </div>
      <h1 className="display logo-big splash-logo">
        <span className="sl sl1">SING</span>
        <span className="sl sl2"><span style={{ color: 'var(--flame)' }}>&amp;</span> <span style={{ color: 'var(--butter)' }}>PLAY</span></span>
      </h1>
      <button className="btn btn-gold submit splash-btn" type="button" style={{ fontSize: 28, minHeight: 60 }} onClick={onStart}>ابدأ</button>
    </main>
  );
}

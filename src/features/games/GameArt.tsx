// رسومات الألعاب (SVG بألوان هوية SING & PLAY). الحركة (دوران/طفو/نبض) من CSS في global.css.
const FONT = "Lalezar, Tajawal, sans-serif";

function Note({ x, y, color, delay, scale = 1 }: { x: number; y: number; color: string; delay: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <g className="art-float" style={{ animationDelay: `${delay}s` }}>
        <ellipse cx="0" cy="16" rx="8" ry="6" fill={color} transform="rotate(-20 0 16)" />
        <path d="M7 14 V-14 Q7 -8 18 -4 V-10 Q10 -12 7 -18" fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </g>
  );
}

function Spark({ x, y, delay }: { x: number; y: number; delay: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="art-pulse" style={{ animationDelay: `${delay}s` }}>
        <path d="M0 -7 L2 -2 L7 0 L2 2 L0 7 L-2 2 L-7 0 L-2 -2 Z" fill="#f4ebd9" opacity=".9" />
      </g>
    </g>
  );
}

function SingArt({ wide }: { wide?: boolean }) {
  return (
    <svg className="gart" viewBox={wide ? '-50 36 300 125' : '0 0 200 260'} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="g-sing" gradientUnits="userSpaceOnUse" cx="100" cy="100" r="200">
          <stop offset="0%" stopColor="#f26a2e" />
          <stop offset="55%" stopColor="#b5391f" />
          <stop offset="100%" stopColor="#1b2220" />
        </radialGradient>
      </defs>
      <rect x="-200" y="-100" width="600" height="500" fill="url(#g-sing)" />
      <g transform="translate(100 102)">
        <g className="art-spin">
          <circle r="80" fill="#101412" />
          <circle r="70" fill="none" stroke="#f4ebd9" strokeOpacity=".09" strokeWidth="1.5" />
          <circle r="60" fill="none" stroke="#f4ebd9" strokeOpacity=".09" strokeWidth="1.5" />
          <circle r="50" fill="none" stroke="#f4ebd9" strokeOpacity=".09" strokeWidth="1.5" />
          <path d="M-60 -52 A80 80 0 0 1 20 -78" fill="none" stroke="#f4ebd9" strokeOpacity=".22" strokeWidth="5" strokeLinecap="round" />
          <circle r="32" fill="#f2b93b" />
          <circle r="27" fill="#f26a2e" />
          <circle r="5" fill="#101412" />
        </g>
      </g>
      <g transform="translate(100 112)">
        <rect x="-17" y="-34" width="34" height="58" rx="17" fill="#f4ebd9" />
        <path d="M-17 -8 H17 M-17 4 H17 M-17 16 H17" stroke="#101412" strokeOpacity=".25" strokeWidth="2.5" />
        <path d="M-27 6 V8 Q-27 38 0 38 Q27 38 27 8 V6" fill="none" stroke="#f2b93b" strokeWidth="5" strokeLinecap="round" />
        <rect x="-5" y="38" width="10" height="26" rx="3" fill="#f2b93b" />
        <rect x="-22" y="62" width="44" height="7" rx="3.5" fill="#f2b93b" />
      </g>
      <Note x={34} y={60} color="#f2b93b" delay={0} />
      <Note x={168} y={96} color="#f4ebd9" delay={1.1} scale={0.85} />
      <Note x={150} y={34} color="#f2b93b" delay={2.1} scale={0.7} />
      <Spark x={26} y={150} delay={0.4} />
      <Spark x={176} y={160} delay={1.2} />
      <Note x={-14} y={100} color="#f4ebd9" delay={0.7} scale={0.9} />
      <Note x={216} y={60} color="#f2b93b" delay={1.6} />
      <Spark x={-30} y={40} delay={0.9} />
      <Spark x={232} y={130} delay={0.2} />
    </svg>
  );
}

function WhoArt({ wide }: { wide?: boolean }) {
  return (
    <svg className="gart" viewBox={wide ? '-50 30 300 125' : '0 0 200 260'} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="g-who" gradientUnits="userSpaceOnUse" cx="100" cy="92" r="200">
          <stop offset="0%" stopColor="#f2b93b" />
          <stop offset="52%" stopColor="#8a9145" />
          <stop offset="100%" stopColor="#1b2220" />
        </radialGradient>
      </defs>
      <rect x="-200" y="-100" width="600" height="500" fill="url(#g-who)" />
      <g opacity=".95">
        <path d="M24 262 Q24 178 100 172 Q176 178 176 262 Z" fill="#101412" />
        <circle cx="100" cy="116" r="50" fill="#101412" stroke="#f4ebd9" strokeWidth="4" />
        <circle cx="82" cy="126" r="6" fill="#f4ebd9" />
        <circle cx="118" cy="126" r="6" fill="#f4ebd9" />
        <path d="M84 148 Q100 158 116 148" fill="none" stroke="#f4ebd9" strokeWidth="4" strokeLinecap="round" />
      </g>
      <g transform="translate(100 84) rotate(-7)">
        <g className="art-pulse">
          <rect x="-44" y="-26" width="88" height="52" rx="10" fill="#f4ebd9" stroke="#f26a2e" strokeWidth="4" />
          <text x="0" y="17" textAnchor="middle" fontFamily={FONT} fontSize="52" fill="#f26a2e">؟</text>
        </g>
      </g>
      <g transform="translate(30 70)"><g className="art-float"><text textAnchor="middle" fontFamily={FONT} fontSize="30" fill="#f4ebd9" opacity=".85">؟</text></g></g>
      <g transform="translate(172 60)"><g className="art-float" style={{ animationDelay: "1.2s" }}><text textAnchor="middle" fontFamily={FONT} fontSize="24" fill="#f2b93b">؟</text></g></g>
      <g transform="translate(168 150)"><g className="art-float" style={{ animationDelay: "2.2s" }}><text textAnchor="middle" fontFamily={FONT} fontSize="20" fill="#f4ebd9" opacity=".8">؟</text></g></g>
      <Spark x={24} y={140} delay={0.3} />
      <Spark x={178} y={104} delay={1.4} />
      <g transform="translate(-14 96)"><g className="art-float" style={{ animationDelay: "0.8s" }}><text textAnchor="middle" fontFamily={FONT} fontSize="34" fill="#f2b93b">؟</text></g></g>
      <g transform="translate(216 90)"><g className="art-float" style={{ animationDelay: "1.9s" }}><text textAnchor="middle" fontFamily={FONT} fontSize="30" fill="#f4ebd9" opacity=".85">؟</text></g></g>
      <Spark x={-30} y={50} delay={0.5} />
      <Spark x={232} y={40} delay={1.1} />
    </svg>
  );
}

function Letter({ x, y, ch, color, size, delay, opacity = 1 }: { x: number; y: number; ch: string; color: string; size: number; delay: number; opacity?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="art-float" style={{ animationDelay: `${delay}s` }}>
        <text textAnchor="middle" fontFamily={FONT} fontSize={size} fill={color} opacity={opacity}>{ch}</text>
      </g>
    </g>
  );
}

function BusArt({ wide }: { wide?: boolean }) {
  return (
    <svg className="gart" viewBox={wide ? '-50 36 300 125' : '0 0 200 260'} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="g-bus" gradientUnits="userSpaceOnUse" cx="100" cy="100" r="200">
          <stop offset="0%" stopColor="#37413d" />
          <stop offset="100%" stopColor="#101412" />
        </radialGradient>
      </defs>
      <rect x="-200" y="-100" width="600" height="500" fill="url(#g-bus)" />
      <g transform="translate(100 96)">
        <g className="art-pulse">
          <circle r="66" fill="#f26a2e" />
          <circle r="52" fill="none" stroke="#f4ebd9" strokeOpacity=".18" strokeWidth="2" />
        </g>
      </g>
      <rect x="-200" y="154" width="600" height="300" fill="#101412" opacity=".6" />
      <path d="M-60 184 H260" stroke="#f4ebd9" strokeOpacity=".3" strokeWidth="4" strokeDasharray="16 14" />
      <rect x="22" y="63" width="156" height="74" rx="18" fill="#f2b93b" stroke="#101412" strokeWidth="4" />
      <rect x="30" y="75" width="30" height="34" rx="8" fill="#101412" />
      <rect x="68" y="75" width="26" height="28" rx="7" fill="#101412" />
      <rect x="100" y="75" width="26" height="28" rx="7" fill="#101412" />
      <rect x="132" y="75" width="26" height="28" rx="7" fill="#101412" />
      <text x="145" y="97" textAnchor="middle" fontFamily={FONT} fontSize="26" fill="#f4ebd9">ح</text>
      <text x="113" y="97" textAnchor="middle" fontFamily={FONT} fontSize="26" fill="#f4ebd9">ر</text>
      <text x="81" y="97" textAnchor="middle" fontFamily={FONT} fontSize="26" fill="#f4ebd9">ف</text>
      <rect x="24" y="115" width="152" height="9" fill="#f26a2e" />
      <circle cx="26" cy="106" r="5" fill="#f4ebd9" />
      <circle cx="174" cy="106" r="4" fill="#b5391f" />
      {[58, 142].map((cx) => (
        <g key={cx} transform={`translate(${cx} 138)`}>
          <circle r="16" fill="#101412" stroke="#f4ebd9" strokeWidth="5" />
          <g className="art-spin">
            <circle r="7" fill="#f2b93b" />
            <path d="M-7 0 H7 M0 -7 V7" stroke="#101412" strokeWidth="2.5" />
          </g>
        </g>
      ))}
      <Letter x={8} y={68} ch="أ" color="#f2b93b" size={26} delay={0} />
      <Letter x={190} y={130} ch="ب" color="#f4ebd9" size={26} delay={1.2} opacity={0.9} />
      <Letter x={-16} y={92} ch="م" color="#f4ebd9" size={34} delay={0.7} opacity={0.85} />
      <Letter x={218} y={84} ch="س" color="#f2b93b" size={30} delay={1.8} />
      <Letter x={30} y={214} ch="ك" color="#f2b93b" size={30} delay={0.4} />
      <Letter x={172} y={222} ch="ل" color="#f4ebd9" size={26} delay={1.5} opacity={0.9} />
      <Spark x={-30} y={60} delay={0.5} />
      <Spark x={232} y={140} delay={1.1} />
      <Spark x={26} y={176} delay={0.3} />
      <Spark x={176} y={188} delay={1.3} />
    </svg>
  );
}

function GenericArt({ wide }: { wide?: boolean }) {
  return (
    <svg className="gart" viewBox={wide ? '0 40 200 140' : '0 0 200 260'} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <rect width="200" height="260" fill="#1b2220" />
      <g transform="translate(100 110)">
        <g className="art-spin">
          <circle r="70" fill="#101412" stroke="#37413d" strokeWidth="3" />
          <circle r="28" fill="#f26a2e" />
          <circle r="5" fill="#101412" />
        </g>
      </g>
    </svg>
  );
}

// wide = للبانر العريض (صفحة اللعبة ونافذة الشرح)
export default function GameArt({ id, wide }: { id: string; wide?: boolean }) {
  if (id === 'sing') return <SingArt wide={wide} />;
  if (id === 'who_am_i') return <WhoArt wide={wide} />;
  if (id === 'bus_complete') return <BusArt wide={wide} />;
  return <GenericArt wide={wide} />;
}

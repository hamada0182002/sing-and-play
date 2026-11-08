const PALETTE = [
  { bg: 'var(--flame)', fg: 'var(--ground)' },
  { bg: 'var(--olive)', fg: 'var(--ground)' },
  { bg: 'var(--butter)', fg: 'var(--ground)' },
  { bg: 'var(--brick)', fg: 'var(--ivory)' },
  { bg: 'var(--ivory)', fg: 'var(--ground)' },
];

function pick(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export default function Avatar({ id, name, size = 44, ring = false }: { id: string; name: string; size?: number; ring?: boolean }) {
  const c = pick(id);
  return (
    <div className="display" aria-hidden="true" style={{ width: size, height: size, flex: '0 0 auto', borderRadius: '50%', background: c.bg, color: c.fg, fontSize: size * 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: ring ? '0 0 0 3px var(--ivory)' : undefined }}>
      {(name || '?').charAt(0)}
    </div>
  );
}

// مؤثرات صوتية مولَّدة بالكود (Web Audio) بدون ملفات صوت
export const EFFECTS = [
  { id: 'kick', label: 'طبلة' },
  { id: 'snare', label: 'دُف' },
  { id: 'clap', label: 'تصفيق' },
  { id: 'whistle', label: 'صفّارة' },
  { id: 'bell', label: 'جرس' },
] as const;
export type EffectId = (typeof EFFECTS)[number]['id'];

let ctx: AudioContext | null = null;
function audio(): AudioContext {
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function noise(c: AudioContext, seconds: number): AudioBufferSourceNode {
  const buffer = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buffer;
  return src;
}

export function playEffect(id: EffectId, volume = 0.8): void {
  const c = audio();
  const t = c.currentTime;
  const g = c.createGain();
  g.connect(c.destination);
  switch (id) {
    case 'kick': {
      const o = c.createOscillator();
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.25);
      g.gain.setValueAtTime(volume, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      o.connect(g);
      o.start(t);
      o.stop(t + 0.3);
      break;
    }
    case 'snare': {
      const n = noise(c, 0.2);
      const f = c.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 1200;
      g.gain.setValueAtTime(volume * 0.8, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      n.connect(f);
      f.connect(g);
      n.start(t);
      break;
    }
    case 'clap': {
      for (let k = 0; k < 3; k++) {
        const n = noise(c, 0.06);
        const f = c.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = 1800;
        const gg = c.createGain();
        gg.connect(c.destination);
        const st = t + k * 0.025;
        gg.gain.setValueAtTime(volume * 0.7, st);
        gg.gain.exponentialRampToValueAtTime(0.001, st + 0.08);
        n.connect(f);
        f.connect(gg);
        n.start(st);
      }
      break;
    }
    case 'whistle': {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(1800, t);
      o.frequency.linearRampToValueAtTime(2600, t + 0.25);
      g.gain.setValueAtTime(volume * 0.4, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      o.connect(g);
      o.start(t);
      o.stop(t + 0.4);
      break;
    }
    case 'bell': {
      g.gain.setValueAtTime(volume * 0.5, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
      [880, 1320].forEach((freq) => {
        const o = c.createOscillator();
        o.type = 'triangle';
        o.frequency.value = freq;
        o.connect(g);
        o.start(t);
        o.stop(t + 0.8);
      });
      break;
    }
  }
}

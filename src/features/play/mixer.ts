import { BEATS, type BeatId } from './beats';

let ctx: AudioContext | null = null;
const cache = new Map<BeatId, AudioBuffer>();

export function getContext(): AudioContext {
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
  }
  return ctx;
}

export async function resumeAudio(): Promise<void> {
  const c = getContext();
  if (c.state === 'suspended') await c.resume();
}

// تحميل التراك وفك ترميزه مرة واحدة (يُخزَّن للاستخدام السريع وقت التسجيل)
export async function loadBeat(id: BeatId): Promise<AudioBuffer> {
  const hit = cache.get(id);
  if (hit) return hit;
  const beat = BEATS.find((b) => b.id === id);
  if (!beat) throw new Error('beat_unknown');
  const res = await fetch(beat.url);
  if (!res.ok) throw new Error('beat_missing');
  const data = await res.arrayBuffer();
  const buffer = await getContext().decodeAudioData(data); // يفشل لو الملف غير موجود أو تالف
  cache.set(id, buffer);
  return buffer;
}

// ---- المعاينة ----
let preview: { src: AudioBufferSourceNode; gain: GainNode; id: BeatId } | null = null;

export function previewingId(): BeatId | null {
  return preview?.id ?? null;
}

export async function previewBeat(id: BeatId, volumePercent: number): Promise<void> {
  stopPreview();
  await resumeAudio();
  const buffer = await loadBeat(id);
  const c = getContext();
  const src = c.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  const gain = c.createGain();
  gain.gain.value = volumePercent / 100;
  src.connect(gain);
  gain.connect(c.destination);
  src.start();
  preview = { src, gain, id };
}

export function setPreviewVolume(volumePercent: number): void {
  if (preview) preview.gain.gain.value = volumePercent / 100;
}

export function stopPreview(): void {
  try {
    preview?.src.stop();
  } catch {
    /* متوقف بالفعل */
  }
  preview?.src.disconnect();
  preview?.gain.disconnect();
  preview = null;
}

// ---- الدمج وقت التسجيل: ميكروفون + طبلة في مجرى واحد ----
// وقت التسجيل صوت الطبلة بيوطي لوحده (نسبة من المستوى اللي المغني اختاره) عشان ما يغطّيش على الميكروفون، خصوصاً في الأندرويد
export const REC_DUCK = 0.35;

export interface MixSession {
  stream: MediaStream; // المجرى المدموج اللي يسجّله MediaRecorder
  start: () => void; // يبدأ الطبلة (يُستدعى مع بداية التسجيل مباشرة)
  setVolumes: (micPercent: number, beatPercent: number) => void;
  stop: () => void;
}

export async function createMix(mic: MediaStream, beatId: BeatId, micPercent: number, beatPercent: number, syncMs: number): Promise<MixSession> {
  stopPreview();
  await resumeAudio();
  const c = getContext();
  if (c.state !== 'running') throw new Error('audio_suspended');
  const buffer = await loadBeat(beatId);

  const dest = c.createMediaStreamDestination();
  const micSource = c.createMediaStreamSource(mic);
  const micGain = c.createGain();
  micGain.gain.value = micPercent / 100;
  // تعويض التزامن: لو syncMs سالب نؤخّر الصوت، ولو موجب نؤخّر الطبلة (في التسجيل فقط)
  const micDelay = c.createDelay(1);
  micDelay.delayTime.value = syncMs < 0 ? -syncMs / 1000 : 0;
  micSource.connect(micGain);
  micGain.connect(micDelay);
  micDelay.connect(dest);

  const beatGain = c.createGain();
  beatGain.gain.value = (beatPercent / 100) * REC_DUCK;
  const beatDelay = c.createDelay(1);
  beatDelay.delayTime.value = syncMs > 0 ? syncMs / 1000 : 0;
  beatGain.connect(beatDelay);
  beatDelay.connect(dest); // يدخل التسجيل (مع تعويض التزامن)
  beatGain.connect(c.destination); // ويسمعه المغني

  let src: AudioBufferSourceNode | null = null;
  return {
    stream: dest.stream,
    start() {
      src = c.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.connect(beatGain);
      src.start();
    },
    setVolumes(m, b) {
      micGain.gain.value = m / 100;
      beatGain.gain.value = (b / 100) * REC_DUCK;
    },
    stop() {
      try {
        src?.stop();
      } catch {
        /* متوقف بالفعل */
      }
      src?.disconnect();
      micSource.disconnect();
      micGain.disconnect();
      micDelay.disconnect();
      beatGain.disconnect();
      beatDelay.disconnect();
    },
  };
}

// تجربة تزامن سريعة (محلية بدون رفع): تسجّل ثواني قليلة بنفس طريقة الدمج الحقيقية
export async function recordSyncTest(mic: MediaStream, beatId: BeatId, micPercent: number, beatPercent: number, syncMs: number, seconds: number): Promise<Blob> {
  const session = await createMix(mic, beatId, micPercent, beatPercent, syncMs);
  const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
  const rec = new MediaRecorder(session.stream, mime ? { mimeType: mime } : undefined);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  const done = new Promise<Blob>((resolve) => {
    rec.onstop = () => {
      session.stop();
      resolve(new Blob(chunks, { type: rec.mimeType || mime || 'audio/webm' }));
    };
  });
  session.start();
  rec.start();
  setTimeout(() => {
    if (rec.state === 'recording') rec.stop();
  }, seconds * 1000);
  return done;
}

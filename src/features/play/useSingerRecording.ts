import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { finishRecording, type RoundRow } from './api';
import type { MixSettings } from './beats';
import { createMix, stopPreview, type MixSession } from './mixer';

const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];

function pickMime(): string {
  return MIME_CANDIDATES.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) ?? '';
}

async function upload(roomId: string, roundId: string, attempt: number, mime: string, chunks: Blob[]) {
  const type = mime.startsWith('audio/mp4') ? 'audio/mp4' : 'audio/webm';
  const ext = type === 'audio/mp4' ? 'mp4' : 'webm';
  const blob = new Blob(chunks, { type });
  if (blob.size < 1000) {
    await finishRecording(roundId, null, false);
    return;
  }
  const path = `${roomId}/${roundId}-${attempt}.${ext}`;
  const { error } = await supabase!.storage.from('recordings').upload(path, blob, { contentType: type });
  await finishRecording(roundId, error ? null : path, !error);
}

// يشتغل عند المغني فقط: يجهّز الميكروفون وقت التفكير، يسجّل وقت الغناء (ميكروفون أو ميكروفون + طبلة)، ويرفع التسجيل
export function useSingerRecording(round: RoundRow | null, isSinger: boolean, mix: MixSettings): { micError: string } {
  const [micError, setMicError] = useState('');
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const sessionRef = useRef<MixSession | null>(null);
  const startedFor = useRef('');
  const mixRef = useRef(mix);
  mixRef.current = mix;
  const roundId = round?.id;
  const roomId = round?.room_id;
  const phase = round?.phase;
  const attempt = round?.attempt ?? 1;

  // تعديل مستوى الصوت لحظياً أثناء الغناء
  useEffect(() => {
    sessionRef.current?.setVolumes(mix.micVol, mix.beatVol);
  }, [mix.micVol, mix.beatVol]);

  useEffect(() => {
    if (!isSinger || !roundId || !roomId) return;

    if (phase === 'thinking' && !streamRef.current) {
      navigator.mediaDevices
        ?.getUserMedia({ audio: true })
        .then((s) => { streamRef.current = s; })
        .catch(() => setMicError('اسمح باستخدام الميكروفون عشان يتسجل غناؤك'));
    }

    if (phase === 'singing' && startedFor.current !== `${roundId}-${attempt}`) {
      startedFor.current = `${roundId}-${attempt}`;
      void (async () => {
        try {
          const stream = streamRef.current ?? (await navigator.mediaDevices.getUserMedia({ audio: true }));
          streamRef.current = stream;
          stopPreview();

          let source: MediaStream = stream;
          let session: MixSession | null = null;
          const m = mixRef.current;
          if (m.beatId) {
            try {
              session = await createMix(stream, m.beatId, m.micVol, m.beatVol, m.syncMs);
              source = session.stream;
            } catch {
              setMicError('تعذّر تشغيل الطبلة، سيُسجَّل صوتك فقط');
            }
          }

          const mime = pickMime();
          const rec = new MediaRecorder(source, mime ? { mimeType: mime } : undefined);
          const chunks: Blob[] = [];
          rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
          rec.onstop = () => {
            session?.stop();
            sessionRef.current = null;
            stream.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
            void upload(roomId, roundId, attempt, rec.mimeType || mime, chunks).catch(() => finishRecording(roundId, null, false).catch(() => undefined));
          };
          session?.start(); // الطبلة والتسجيل يبدأن معاً
          rec.start();
          sessionRef.current = session;
          recRef.current = rec;
          setTimeout(() => { if (rec.state === 'recording') rec.stop(); }, 25000);
        } catch {
          setMicError('تعذّر تشغيل الميكروفون');
          void finishRecording(roundId, null, false).catch(() => undefined);
        }
      })();
    }

    // انتهى الغناء أو الدور: أوقف التسجيل والطبلة معاً
    if (phase !== 'thinking' && phase !== 'singing' && recRef.current?.state === 'recording') recRef.current.stop();
  }, [isSinger, roundId, roomId, phase, attempt]);

  useEffect(() => () => {
    if (recRef.current?.state === 'recording') recRef.current.stop();
    sessionRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  return { micError };
}

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { finishRecording, type RoundRow } from './api';
import type { MixSettings } from './beats';
import { createMix, stopPreview, type MixSession } from './mixer';

const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];

function pickMime(): string {
  return MIME_CANDIDATES.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) ?? '';
}

async function upload(roomId: string, roundId: string, attempt: number, mime: string, blob: Blob) {
  const type = mime.startsWith('audio/mp4') ? 'audio/mp4' : 'audio/webm';
  const ext = type === 'audio/mp4' ? 'mp4' : 'webm';
  const file = new Blob([blob], { type });
  if (file.size < 1000) {
    await finishRecording(roundId, null, false);
    return;
  }
  const path = `${roomId}/${roundId}-${attempt}.${ext}`;
  const { error } = await supabase!.storage.from('recordings').upload(path, file, { contentType: type });
  await finishRecording(roundId, error ? null : path, !error);
}

export type RecState = 'idle' | 'recording' | 'stopped';

// عند المغني فقط: خلال وقت الدور (90 ثانية) يقدر يسجّل ويوقف ويعيد. آخر مقطع هو اللي يترفع لما الدور ينتهي.
export function useTurnRecorder(round: RoundRow | null, isSinger: boolean, mix: MixSettings, timeUp: boolean) {
  const [state, setState] = useState<RecState>('idle');
  const [seconds, setSeconds] = useState(0);
  const [micError, setMicError] = useState('');
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const sessionRef = useRef<MixSession | null>(null);
  const takeRef = useRef<{ blob: Blob; mime: string } | null>(null);
  const startAt = useRef(0);
  const finalized = useRef(false);
  const finalizeRequested = useRef(false);
  const mixRef = useRef(mix);
  mixRef.current = mix;

  const roundId = round?.id;
  const roomId = round?.room_id;
  const phase = round?.phase;
  const attempt = round?.attempt ?? 1;
  const turnKey = `${roundId}-${attempt}`;

  const releaseStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };
  const stopRecorder = () => {
    if (recRef.current?.state === 'recording') recRef.current.stop();
  };

  useEffect(() => {
    sessionRef.current?.setVolumes(mix.micVol, mix.beatVol);
  }, [mix.micVol, mix.beatVol]);

  // دور جديد أو محاولة جديدة: ابدأ من الصفر
  useEffect(() => {
    stopRecorder();
    sessionRef.current?.stop();
    sessionRef.current = null;
    releaseStream();
    takeRef.current = null;
    finalized.current = false;
    finalizeRequested.current = false;
    setState('idle');
    setSeconds(0);
    setMicError('');
  }, [turnKey]);

  async function doFinalize() {
    if (finalized.current || !roundId || !roomId) return;
    finalized.current = true;
    const take = takeRef.current;
    try {
      if (take) await upload(roomId, roundId, attempt, take.mime, take.blob);
      else await finishRecording(roundId, null, false);
    } catch {
      await finishRecording(roundId, null, false).catch(() => undefined);
    }
    releaseStream();
  }

  // تسجيل مقطع جديد (لو في مقطع قديم يتمسح = إعادة)
  async function start() {
    if (!isSinger || !roundId || phase !== 'singing') return;
    setMicError('');
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
        if (sessionRef.current === session) sessionRef.current = null;
        const type = rec.mimeType || mime;
        takeRef.current = chunks.length ? { blob: new Blob(chunks, { type }), mime: type } : null;
        setSeconds(Math.round((Date.now() - startAt.current) / 1000));
        setState('stopped');
        if (finalizeRequested.current) void doFinalize();
      };
      takeRef.current = null;
      session?.start(); // الطبلة والتسجيل يبدأن معاً
      startAt.current = Date.now();
      rec.start();
      recRef.current = rec;
      sessionRef.current = session;
      setSeconds(0);
      setState('recording');
    } catch {
      setMicError('تعذّر تشغيل الميكروفون. اسمح باستخدامه من المتصفح.');
    }
  }

  // الدور انتقل للاستماع: ارفع آخر مقطع. لو الدور اتخطّى: امسح كل حاجة.
  useEffect(() => {
    if (!isSinger || !roundId) return;
    if (phase === 'listening') {
      finalizeRequested.current = true;
      if (recRef.current?.state === 'recording') recRef.current.stop();
      else void doFinalize();
    } else if (phase === 'result' || phase === 'voting') {
      finalized.current = true;
      takeRef.current = null;
      stopRecorder();
      releaseStream();
    }
  }, [isSinger, roundId, phase, attempt]);

  // انتهى الوقت: أوقف التسجيل فوراً
  useEffect(() => {
    if (timeUp && phase === 'singing') stopRecorder();
  }, [timeUp, phase]);

  // عدّاد مدة المقطع أثناء التسجيل
  useEffect(() => {
    if (state !== 'recording') return;
    const t = setInterval(() => setSeconds(Math.floor((Date.now() - startAt.current) / 1000)), 500);
    return () => clearInterval(t);
  }, [state]);

  useEffect(() => () => {
    stopRecorder();
    sessionRef.current?.stop();
    releaseStream();
  }, []);

  return { state, seconds, micError, start, stop: stopRecorder };
}

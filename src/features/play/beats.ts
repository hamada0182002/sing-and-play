// تراكات الطبلة المدمجة في المشروع (الملفات في public/beats)
const base = import.meta.env.BASE_URL;

export const BEATS = [
  { id: 'shaabi', label: 'شعبي', url: `${base}beats/shaabi.mp3` },
  { id: 'oriental', label: 'شرقي', url: `${base}beats/oriental.mp3` },
  { id: 'fast', label: 'سريعة', url: `${base}beats/fast.mp3` },
] as const;

export type BeatId = (typeof BEATS)[number]['id'];

export interface MixSettings {
  beatId: BeatId | null; // null = بدون طبلة
  micVol: number; // 0 إلى 150 (%)
  beatVol: number; // 0 إلى 100 (%)
  syncMs: number; // تعويض التزامن: موجب = تتأخر الطبلة في التسجيل، سالب = يتأخر الصوت
}

export const DEFAULT_SYNC_MS = 180;
export const DEFAULT_MIX: MixSettings = { beatId: null, micVol: 100, beatVol: 60, syncMs: DEFAULT_SYNC_MS };

// ضبط التزامن يتحفظ على الجهاز (يختلف حسب السماعة والجهاز)
const SYNC_KEY = 'sp_sync_ms';
export function loadSyncMs(): number {
  try {
    const raw = localStorage.getItem(SYNC_KEY);
    if (raw === null) return DEFAULT_SYNC_MS;
    const v = Number(raw);
    return Number.isFinite(v) ? Math.max(-400, Math.min(600, v)) : DEFAULT_SYNC_MS;
  } catch {
    return DEFAULT_SYNC_MS;
  }
}
export function saveSyncMs(v: number): void {
  try {
    localStorage.setItem(SYNC_KEY, String(v));
  } catch {
    /* التخزين غير متاح */
  }
}

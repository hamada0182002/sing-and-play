import { App } from '@capacitor/app';
import { Capacitor, CapacitorHttp, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

// رابط ملف الإصدار المركزي (version.json) على GitHub Releases — يتحدد وقت بناء الـAPK
const UPDATE_URL = (import.meta.env.VITE_UPDATE_URL as string | undefined) ?? '';

export interface VersionInfo {
  versionName: string; // الإصدار الأحدث (مثل 1.0.1)
  versionCode: number; // رقم يزيد مع كل إصدار — هو أساس المقارنة
  apkUrl: string; // رابط تحميل الـAPK
  sha256: string; // بصمة الملف للتحقق قبل التثبيت
  notes: string[]; // ملاحظات التحديث
  minVersionCode?: number;
}

export interface InstalledInfo {
  versionName: string;
  versionCode: number;
}

export type CheckResult =
  | { kind: 'uptodate'; installed: InstalledInfo }
  | { kind: 'available'; installed: InstalledInfo; latest: VersionInfo };

interface ApkInstallerPlugin {
  canInstall(): Promise<{ allowed: boolean }>;
  openInstallSettings(): Promise<void>;
  download(opts: { url: string; sha256: string; fileName: string }): Promise<{ path: string }>;
  install(opts: { path: string }): Promise<void>;
  addListener(event: 'progress', cb: (p: { received: number; total: number }) => void): Promise<PluginListenerHandle>;
}

const ApkInstaller = registerPlugin<ApkInstallerPlugin>('ApkInstaller');

export const isNativeApp = (): boolean => Capacitor.isNativePlatform();

export class UpdateError extends Error {}

export async function getInstalled(): Promise<InstalledInfo> {
  const info = await App.getInfo();
  return { versionName: info.version, versionCode: Number(info.build) || 0 };
}

function parseVersionInfo(raw: unknown): VersionInfo {
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const v = data as Partial<VersionInfo> | null;
  if (!v || typeof v.versionCode !== 'number' || !v.versionName || !v.apkUrl || !v.sha256) {
    throw new UpdateError('ملف معلومات الإصدار غير صالح');
  }
  return {
    versionName: String(v.versionName),
    versionCode: v.versionCode,
    apkUrl: String(v.apkUrl),
    sha256: String(v.sha256).toLowerCase(),
    notes: Array.isArray(v.notes) ? v.notes.map(String) : [],
    minVersionCode: typeof v.minVersionCode === 'number' ? v.minVersionCode : undefined,
  };
}

export async function checkForUpdate(): Promise<CheckResult> {
  if (!UPDATE_URL) throw new UpdateError('رابط التحديثات غير مضبوط في هذه النسخة');
  const installed = await getInstalled();
  let latest: VersionInfo;
  try {
    // CapacitorHttp (طلب أصلي من أندرويد) بدل fetch لتجنّب مشاكل CORS مع روابط GitHub
    const res = await CapacitorHttp.get({
      url: `${UPDATE_URL}?t=${Date.now()}`,
      headers: { 'Cache-Control': 'no-cache' },
      connectTimeout: 15000,
      readTimeout: 15000,
    });
    if (res.status === 404) throw new UpdateError('لا توجد إصدارات منشورة بعد');
    if (res.status < 200 || res.status >= 300) throw new UpdateError(`تعذّر الوصول لخادم التحديثات (رمز ${res.status})`);
    latest = parseVersionInfo(res.data);
  } catch (e) {
    if (e instanceof UpdateError) throw e;
    if (e instanceof SyntaxError) throw new UpdateError('ملف معلومات الإصدار غير صالح');
    throw new UpdateError('تعذّر الاتصال بالإنترنت. تأكد من الشبكة وحاول مرة أخرى');
  }
  return latest.versionCode > installed.versionCode ? { kind: 'available', installed, latest } : { kind: 'uptodate', installed };
}

export async function canInstallPackages(): Promise<boolean> {
  return (await ApkInstaller.canInstall()).allowed;
}

export function openInstallSettings(): Promise<void> {
  return ApkInstaller.openInstallSettings();
}

// تنزيل الـAPK مع نسبة التقدم (0..1، أو -1 لو الحجم غير معروف) ثم التحقق من البصمة
export async function downloadUpdate(info: VersionInfo, onProgress: (ratio: number) => void): Promise<string> {
  const handle = await ApkInstaller.addListener('progress', ({ received, total }) => onProgress(total > 0 ? received / total : -1));
  try {
    const { path } = await ApkInstaller.download({ url: info.apkUrl, sha256: info.sha256, fileName: `SingAndPlay-${info.versionName}.apk` });
    return path;
  } catch (e) {
    throw new UpdateError(friendlyDownloadError(e));
  } finally {
    await handle.remove();
  }
}

export async function installUpdate(path: string): Promise<void> {
  try {
    await ApkInstaller.install({ path });
  } catch {
    throw new UpdateError('تعذّر فتح مثبّت التطبيقات');
  }
}

function friendlyDownloadError(e: unknown): string {
  const msg = String((e as { message?: string })?.message ?? e);
  if (msg.includes('CHECKSUM')) return 'الملف الذي تم تنزيله تالف أو غير مطابق، لم يتم التثبيت. حاول مرة أخرى';
  if (msg.includes('SPACE')) return 'لا توجد مساحة كافية على الجهاز لتنزيل التحديث';
  if (msg.includes('HTTP')) return 'تعذّر تنزيل ملف التحديث من الخادم. حاول لاحقًا';
  return 'انقطع التنزيل. تأكد من الإنترنت وحاول مرة أخرى';
}

package com.singandplay.app;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;

/**
 * تنزيل APK جديد من رابط (GitHub Releases) والتحقق من بصمته ثم فتح مثبّت أندرويد.
 * لا يعدّل أي شيء في اللعبة أو البيانات.
 */
@CapacitorPlugin(name = "ApkInstaller")
public class ApkInstallerPlugin extends Plugin {

    private static final String DIR = "updates";

    @PluginMethod
    public void canInstall(PluginCall call) {
        boolean allowed = Build.VERSION.SDK_INT < Build.VERSION_CODES.O
                || getContext().getPackageManager().canRequestPackageInstalls();
        JSObject ret = new JSObject();
        ret.put("allowed", allowed);
        call.resolve(ret);
    }

    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("SETTINGS: " + e.getMessage());
        }
    }

    @PluginMethod
    public void download(final PluginCall call) {
        final String url = call.getString("url");
        final String sha256 = call.getString("sha256");
        final String fileName = call.getString("fileName", "update.apk");
        if (url == null || sha256 == null || !url.startsWith("https://") || fileName.contains("/") || fileName.contains("..")) {
            call.reject("HTTP: bad arguments");
            return;
        }
        new Thread(new Runnable() {
            @Override
            public void run() {
                File dir = new File(getContext().getCacheDir(), DIR);
                File out = new File(dir, fileName);
                File tmp = new File(dir, fileName + ".part");
                try {
                    if (!dir.exists() && !dir.mkdirs()) throw new Exception("SPACE: cannot create dir");
                    // امسح أي تنزيلات قديمة
                    File[] old = dir.listFiles();
                    if (old != null) for (File f : old) f.delete();

                    HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
                    conn.setConnectTimeout(20000);
                    conn.setReadTimeout(30000);
                    conn.setInstanceFollowRedirects(true);
                    int code = conn.getResponseCode();
                    if (code != 200) throw new Exception("HTTP: status " + code);
                    long total = conn.getContentLengthLong();
                    if (total > 0 && dir.getUsableSpace() < total + 1024 * 1024) throw new Exception("SPACE: low");

                    MessageDigest md = MessageDigest.getInstance("SHA-256");
                    long received = 0;
                    long lastNotify = 0;
                    try (InputStream in = conn.getInputStream(); FileOutputStream fos = new FileOutputStream(tmp)) {
                        byte[] buf = new byte[32 * 1024];
                        int n;
                        while ((n = in.read(buf)) != -1) {
                            fos.write(buf, 0, n);
                            md.update(buf, 0, n);
                            received += n;
                            long now = System.currentTimeMillis();
                            if (now - lastNotify > 150) {
                                lastNotify = now;
                                notifyProgress(received, total);
                            }
                        }
                    }
                    notifyProgress(received, total > 0 ? total : received);
                    if (total > 0 && received != total) throw new Exception("HTTP: incomplete");

                    StringBuilder hex = new StringBuilder();
                    for (byte b : md.digest()) hex.append(String.format("%02x", b));
                    if (!hex.toString().equalsIgnoreCase(sha256.trim())) throw new Exception("CHECKSUM: mismatch");

                    if (!tmp.renameTo(out)) throw new Exception("SPACE: rename failed");
                    JSObject ret = new JSObject();
                    ret.put("path", out.getAbsolutePath());
                    call.resolve(ret);
                } catch (Exception e) {
                    tmp.delete();
                    call.reject(String.valueOf(e.getMessage()));
                }
            }
        }).start();
    }

    private void notifyProgress(long received, long total) {
        JSObject p = new JSObject();
        p.put("received", received);
        p.put("total", total);
        notifyListeners("progress", p);
    }

    @PluginMethod
    public void install(PluginCall call) {
        String path = call.getString("path");
        if (path == null) {
            call.reject("bad path");
            return;
        }
        try {
            Context ctx = getContext();
            File file = new File(path);
            File base = new File(ctx.getCacheDir(), DIR);
            // أمان: ثبّت فقط ملفات من مجلد التحديثات الخاص بالتطبيق
            if (!file.getCanonicalPath().startsWith(base.getCanonicalPath() + File.separator) || !file.exists()) {
                call.reject("file not found");
                return;
            }
            Uri uri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", file);
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }
}

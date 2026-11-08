import type { CapacitorConfig } from '@capacitor/cli';

// ملاحظة: هذا الملف خاص بتطبيق الأندرويد فقط ولا يؤثر على نسخة الويب
const config: CapacitorConfig = {
  appId: 'com.singandplay.app',
  appName: 'SING & PLAY',
  webDir: 'dist',
  backgroundColor: '#101412',
  server: { androidScheme: 'https' },
};

export default config;

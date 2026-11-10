// يبني نسخة تجريبية في ملف HTML واحد (بدون خادم، الخطوط والأنماط والكود جواه): dist/bus-complete-demo.html
// التشغيل:  node scripts/build-demo.mjs   (محتاج esbuild)
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const js = await build({ entryPoints: [resolve(ROOT, 'demo/lab.js')], bundle: true, write: false, format: 'iife', target: 'es2022', charset: 'utf8', minify: true });
let css = readFileSync(resolve(ROOT, 'styles/fonts.css'), 'utf8') + readFileSync(resolve(ROOT, 'styles/bus-complete.css'), 'utf8').replace(/^@import.*$/gm, '');
css = css.replace(/url\('fonts\/([^']+)'\)/g, (_, f) => `url(data:font/woff2;base64,${readFileSync(resolve(ROOT, 'styles/fonts', f)).toString('base64')})`);
let html = readFileSync(resolve(ROOT, 'demo/index.html'), 'utf8');
const inlineStyle = readFileSync(resolve(ROOT, 'demo/index.html'), 'utf8').match(/<style>[\s\S]*?<\/style>/)[0];
html = html.replace(/<link rel="stylesheet"[^>]*>/, `<style>${css}</style>`).replace('<script type="module" src="./lab.js"></script>', () => `<script>${js.outputFiles[0].text.replace(/<\/script>/g, '<\\/script>')}</script>`);
mkdirSync(resolve(ROOT, 'dist'), { recursive: true });
writeFileSync(resolve(ROOT, 'dist/bus-complete-demo.html'), html);
console.log('تم: dist/bus-complete-demo.html', (html.length / 1024).toFixed(0) + 'KB');

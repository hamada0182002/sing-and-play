// أمان: الكود اللي بيوصل لمتصفح اللاعب (index.js وكل اللي بيستورده) ما يلمسش القاموس ولا المحرك ولا الخادم.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
function graph(entry) {
  const seen = new Set(); const stack = [resolve(ROOT, entry)];
  while (stack.length) {
    const f = stack.pop(); if (seen.has(f)) continue; seen.add(f);
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/(?:import|export)\s[^'"]*?from\s+['"](\.[^'"]+)['"]|import\s+['"](\.[^'"]+)['"]/g)) stack.push(resolve(dirname(f), m[1] || m[2]));
  }
  return [...seen].map((f) => relative(ROOT, f));
}

test('حزمة العميل (index.js) لا تحتوي القاموس ولا المحرك ولا الخادم', () => {
  const files = graph('index.js');
  for (const bad of ['data/lexicon', 'game-engine/engine', 'game-engine/grading', 'validation/', 'server/', 'LocalAdapter']) {
    assert.equal(files.some((f) => f.includes(bad)), false, `لا يجب أن يصل للعميل: ${bad}`);
  }
  assert.ok(files.includes('screens/QuestionScreen.js'));
});

test('الواجهة لا تستخدم innerHTML أبدًا (حماية XSS من أسماء/إجابات اللاعبين)', () => {
  for (const f of graph('index.js')) {
    const src = readFileSync(resolve(ROOT, f), 'utf8');
    assert.equal(/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')), false, f);
  }
});

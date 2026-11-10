// 2) انتظار اللاعبين · 3) إعدادات الأدمن · 4) تأكيد الإعدادات (قبل البدء، للكل)
import { h, icon, ar, secs } from '../components/dom.js';
import { Button, Avatar, Chip, Header, Segmented, Sheet, Countdown, Vinyl } from '../components/ui.js';
import { OPTIONS } from '../game-engine/settings.js';
import { ARABIC_LETTERS, HARD_LETTERS, letterLabel } from '../data/letters.js';
import { POLICY_LABEL, GAME_NAME } from '../data/copy.js';
import { MAX_CATEGORY_NAME, MAX_CATEGORIES } from '../data/categories.js';

function PlayersGrid(view) {
  const max = view.settings.maxPlayers;
  const cells = view.players.filter((p) => !p.left).map((p, i) => h('div', { class: `bc-lobbyp${p.id === view.viewerId ? ' is-me' : ''}` },
    Avatar(p, i, { size: 48 }), h('span', { class: 'n' }, p.id === view.viewerId ? `${p.name} (أنا)` : p.name), p.isHost && h('small', null, 'الأدمن')));
  const empties = Math.max(0, Math.min(max, Math.max(view.settings.minPlayers, cells.length)) - cells.length);
  for (let i = 0; i < empties; i++) cells.push(h('div', { class: 'bc-lobbyp is-empty' }, h('small', null, 'مكان فاضي')));
  return h('div', { class: 'bc-players', 'aria-label': 'اللاعبون في الغرفة' }, cells);
}

export function SettingsSummary(view) {
  const s = view.settings;
  const cats = s.categories.filter((x) => x.enabled);
  return h('div', { class: 'bc-card' },
    h('div', { class: 'bc-card__title' }, 'إعدادات الجولة'),
    h('dl', { class: 'bc-kv' },
      h('dt', null, 'عدد الأسئلة'), h('dd', null, `${ar(s.questionCount)} + سؤال نهائي`),
      h('dt', null, 'وقت السؤال'), h('dd', null, `${ar(s.questionSeconds)} ثانية`),
      h('dt', null, 'السؤال النهائي'), h('dd', null, `${ar(s.finalSeconds)} ثانية`),
      h('dt', null, 'الإجابات المكررة'), h('dd', null, POLICY_LABEL[s.duplicatePolicy])),
    h('div', { class: 'bc-cats' }, cats.map((x) => h('span', { class: 'bc-chip bc-chip--line' }, x.name))));
}

export function WaitingScreen(c) {
  const v = c.view; const n = v.players.filter((p) => !p.left).length;
  return h('div', { class: 'bc-screen' },
    Header({ left: GAME_NAME, right: `${ar(n)} / ${ar(v.settings.maxPlayers)} لاعبين` }),
    h('div', { class: 'bc-center bc-stack', style: { marginTop: '10px' } },
      Vinyl({ letter: 'ا', size: 'md', spin: true }),
      h('div', { class: 'bc-title' }, 'في انتظار الأدمن'),
      h('div', { class: 'bc-lead' }, 'الأدمن بيظبّط الإعدادات وهيبدأ الجولة قريب.')),
    PlayersGrid(v), SettingsSummary(v));
}

function Field(label, hint, body) { return h('div', { class: 'bc-field' }, h('div', { class: 'bc-field__label' }, label, hint && h('small', null, hint)), body); }
function seg(c, key, label, options, fmt) {
  return Field(label, null, Segmented({ label, value: c.view.settings[key], options: options.map((o) => ({ value: o, label: fmt(o) })), onChange: (val) => c.act('updateSettings', { [key]: val }) }));
}

function Categories(c) {
  const v = c.view; const cats = v.settings.categories; const ui = c.ui;
  const add = () => {
    const name = (ui.newCat || '').trim(); if (!name) return;
    c.act('addCategory', name).then((r) => { if (r && r.ok) { ui.newCat = ''; c.render(); } });
  };
  const rename = (cat) => {
    const input = h('input', { class: 'bc-input', value: cat.name, maxlength: MAX_CATEGORY_NAME, 'data-bc-key': 'rename', 'aria-label': 'اسم التصنيف' });
    c.openSheet(Sheet({ title: 'تعديل التصنيف', onClose: () => c.closeSheet(), children: [input,
      h('div', { class: 'bc-row' }, Button('حفظ', { block: true, onClick: () => { c.act('updateCategory', { id: cat.id, name: input.value }); c.closeSheet(); } }),
        Button('إلغاء', { variant: 'dark', onClick: () => c.closeSheet() }))] }));
    setTimeout(() => input.focus(), 30);
  };
  return h('div', { class: 'bc-card' },
    h('div', { class: 'bc-card__title' }, 'التصنيفات', h('small', null, `${ar(cats.filter((x) => x.enabled).length)} شغّالة`)),
    h('div', { class: 'bc-cats' }, cats.map((cat) => h('span', { class: `bc-cat${cat.enabled ? '' : ' is-off'}${cat.builtin ? '' : ' is-custom'}` },
      h('button', { class: 'bc-cat__name', type: 'button', 'aria-pressed': String(cat.enabled), title: 'تشغيل/إيقاف', onClick: () => c.act('updateCategory', { id: cat.id, enabled: !cat.enabled }) }, cat.name),
      h('button', { type: 'button', 'aria-label': `تعديل ${cat.name}`, onClick: () => rename(cat) }, icon('pencil', 16)),
      h('button', { type: 'button', 'aria-label': `حذف ${cat.name}`, onClick: () => c.act('removeCategory', cat.id) }, icon('trash', 16))))),
    h('div', { class: 'bc-row' },
      h('input', { class: 'bc-input', placeholder: 'تصنيف جديد (مثال: ماركة)', maxlength: MAX_CATEGORY_NAME, value: ui.newCat || '', 'data-bc-key': 'newcat', 'aria-label': 'تصنيف جديد',
        onInput: (e) => { ui.newCat = e.target.value; }, onKeydown: (e) => { if (e.key === 'Enter') add(); } }),
      Button(null, { variant: 'butter', size: 'sm', iconName: 'plus', ariaLabel: 'إضافة تصنيف', onClick: add, disabled: cats.length >= MAX_CATEGORIES })),
    h('button', { class: 'bc-link', type: 'button', onClick: () => c.act('resetCategories') }, 'رجّع التصنيفات الافتراضية'));
}

function Letters(c) {
  const sel = new Set(c.view.settings.letters);
  const toggle = (l) => { const next = new Set(sel); next.has(l) ? next.delete(l) : next.add(l); c.act('updateSettings', { letters: [...next] }); };
  return h('div', { class: 'bc-card' },
    h('div', { class: 'bc-card__title' }, 'الحروف', h('small', null, `${ar(sel.size)} حرف · الصعبة مستبعدة افتراضيًا`)),
    h('div', { class: 'bc-letters' }, ARABIC_LETTERS.map((l) => h('button', { type: 'button', class: `bc-letter${sel.has(l) ? ' is-on' : ''}${HARD_LETTERS.includes(l) ? ' is-hard' : ''}`, 'aria-pressed': String(sel.has(l)), onClick: () => toggle(l) }, letterLabel(l)))),
    h('div', { class: 'bc-small' }, 'الحرف بيتسحب عشوائيًا من المختار، من غير تكرار نفس التصنيف+الحرف. تقدر تغيّر حرف أي سؤال جاي من شاشة النتائج.'));
}

/** 3) إعدادات الأدمن */
export function AdminSettingsScreen(c) {
  const v = c.view; const s = v.settings; const n = v.players.filter((p) => !p.left).length;
  const ready = n >= s.minPlayers && n <= s.maxPlayers && s.categories.some((x) => x.enabled);
  const confirmSheet = () => c.openSheet(Sheet({ title: 'تأكيد بدء الجولة', onClose: () => c.closeSheet(), children: [
    SettingsSummary(v),
    h('div', { class: 'bc-note' }, `هيبدأ الأسئلة بـ${ar(n)} لاعبين. الإعدادات هتظهر للكل قبل أول سؤال ومش هتتغير بعد كده.`),
    h('div', { class: 'bc-row' }, Button('ابدأ الجولة', { variant: 'flame', block: true, size: 'lg', iconName: 'next', onClick: () => { c.closeSheet(); c.act('startRound'); } }),
      Button('رجوع', { variant: 'dark', onClick: () => c.closeSheet() }))] }));
  return h('div', { class: 'bc-screen bc-screen--wide' },
    Header({ left: `${GAME_NAME} · الأدمن`, right: `${ar(n)} / ${ar(s.maxPlayers)} لاعبين` }),
    h('div', { class: 'bc-title bc-title--sm' }, 'إعدادات الجولة'),
    h('div', { class: 'bc-grid2' },
      h('div', { class: 'bc-stack' },
        h('div', { class: 'bc-card' },
          seg(c, 'questionCount', 'عدد الأسئلة', OPTIONS.questionCount, ar),
          seg(c, 'questionSeconds', 'وقت كل سؤال (ثانية)', OPTIONS.questionSeconds, ar),
          h('details', { class: 'bc-adv' }, h('summary', null, 'خيارات متقدمة', icon('next', 18)),
            h('div', { class: 'bc-stack' },
              seg(c, 'finalSeconds', 'وقت السؤال النهائي (ثانية)', OPTIONS.finalSeconds, ar),
              seg(c, 'wagerSeconds', 'وقت الرهان (ثانية)', OPTIONS.wagerSeconds, ar),
              seg(c, 'resultsSeconds', 'عرض النتائج (ثانية، ٠ = يدوي)', OPTIONS.resultsSeconds, ar),
              Field('الإجابات المكررة', null, h('div', { class: 'bc-stack', style: { gap: '8px' } }, OPTIONS.duplicatePolicy.map((p) =>
                h('button', { type: 'button', class: `bc-btn bc-btn--sm ${s.duplicatePolicy === p ? 'bc-btn--butter' : 'bc-btn--dark'}`, style: { justifyContent: 'flex-start', fontFamily: 'var(--bc-font-body)', fontSize: '15px', fontWeight: 800 }, onClick: () => c.act('updateSettings', { duplicatePolicy: p }) }, POLICY_LABEL[p])))),
              h('button', { type: 'button', class: `bc-switch${s.autoApprove ? ' is-on' : ''}`, 'aria-pressed': String(s.autoApprove), onClick: () => c.act('updateSettings', { autoApprove: !s.autoApprove }) },
                h('span', null, 'اعتماد تلقائي لو مفيش إجابة محتاجة مراجعة'), h('span', { class: 'bc-switch__t' }))))),
        Categories(c)),
      h('div', { class: 'bc-stack' }, h('div', { class: 'bc-card' }, h('div', { class: 'bc-card__title' }, 'اللاعبون', h('small', null, 'ينضموا من الغرفة')), PlayersGrid(v),
        h('div', { class: 'bc-meter' }, h('i', { style: { width: `${Math.min(100, (n / s.maxPlayers) * 100)}%` } })),
        !ready && h('div', { class: 'bc-note bc-note--warn' }, n < s.minPlayers ? `محتاجين ${ar(s.minPlayers - n)} لاعبين كمان على الأقل` : 'فعّل تصنيف واحد على الأقل')),
        Letters(c))),
    h('div', { class: 'bc-footer bc-footer--sticky' }, Button('بدء الجولة', { size: 'lg', block: true, variant: 'flame', iconName: 'next', disabled: !ready, onClick: confirmSheet })));
}

/** 4) تأكيد الإعدادات للكل + عدّ تنازلي لأول سؤال */
export function ConfirmScreen(c) {
  const v = c.view;
  return h('div', { class: 'bc-screen' },
    Header({ left: GAME_NAME, right: v.isAdmin ? 'أدمن' : null, rightTone: 'bc-pill--flame' }),
    h('div', { class: 'bc-center bc-stack', style: { marginTop: '12px' } },
      h('div', { class: 'bc-eyebrow' }, 'استعدوا'), h('div', { class: 'bc-title bc-title--xl' }, 'الجولة هتبدأ!'),
      v.phaseEndsAt && h('div', { class: 'bc-vinyl bc-vinyl--sm', style: { display: 'flex', alignItems: 'center', justifyContent: 'center' } }, Countdown(v.phaseEndsAt, { label: '' }))),
    SettingsSummary(v),
    h('div', { class: 'bc-note' }, 'كل سؤال بتصنيف واحد وحرف واحد، وإجابة واحدة بس. اختار نقاطك الأول وبعدين اكتب.'),
    v.isAdmin && h('div', { class: 'bc-footer' }, Button('ابدأ السؤال الأول الآن', { size: 'lg', block: true, variant: 'flame', iconName: 'next', onClick: () => c.act('advance') })));
}

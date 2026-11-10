import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../logic/engine.js';
import { CHARACTER_BY_ID } from '../data/characters.js';

const players = ['a', 'b', 'c', 'd'].map((id, i) => ({ id, name: id.toUpperCase(), isHost: i === 0 }));
const mk = () => E.createGame({ roomId: 'r1', players, gameSettings: { turnSeconds: 180 } });
let T = 1_000_000;
const ctx = (seed = 7, now = T) => ({ rng: E.seededRng(seed), now });
const start = (seed = 7) => E.startRound(mk(), 'a', ctx(seed));
const code = (fn) => { try { fn(); } catch (e) { return e.code; } return null; };

test('only host starts; 3-10 players enforced', () => {
  assert.equal(code(() => E.startRound(mk(), 'b', ctx())), 'NOT_HOST');
  const two = E.createGame({ roomId: 'r', players: players.slice(0, 2) });
  assert.equal(code(() => E.startRound(two, 'a', ctx())), 'TOO_FEW');
  const eleven = E.createGame({ roomId: 'r', players: Array.from({ length: 11 }, (_, i) => ({ id: 'p' + i, name: 'x', isHost: i === 0 })) });
  assert.equal(code(() => E.startRound(eleven, 'p0', ctx())), 'TOO_MANY');
});

test('start emits gameStarted + turnStarted, 3-minute timer, one active turn', () => {
  const { state, events } = start();
  assert.deepEqual(events.map((e) => e.type), ['gameStarted', 'turnStarted']);
  assert.equal(state.turn.endsAt - state.turn.startedAt, 180000);
  assert.equal(state.phase, 'turn');
  assert.equal(code(() => E.startRound(state, 'a', ctx())), 'BAD_PHASE');
});

test('SECRET: active player never receives the character; others do', () => {
  const { state } = start();
  const me = state.turn.playerId;
  const secretId = state.secret.characterId;
  const mine = JSON.stringify(E.projectFor(state, me, T));
  assert.ok(!mine.includes(secretId) || !mine.includes(`"id":"${secretId}"`), 'id leaked');
  assert.ok(!mine.includes(CHARACTER_BY_ID[secretId].name), 'name leaked');
  assert.equal(E.projectFor(state, me, T).secret, undefined);
  const other = players.find((p) => p.id !== me).id;
  assert.equal(E.projectFor(state, other, T).turn.character.name, CHARACTER_BY_ID[secretId].name);
});

test('SECRET: guess options for active player contain no extra leak before request; options include correct once', () => {
  let { state } = start();
  const me = state.turn.playerId;
  assert.equal(E.projectFor(state, me, T).turn.guessOptions, null);
  ({ state } = E.requestGuess(state, me, ctx()));
  const opts = E.projectFor(state, me, T).turn.guessOptions;
  assert.equal(opts.length, 4);
  assert.equal(new Set(opts.map((o) => o.id)).size, 4);
  assert.ok(opts.some((o) => o.id === state.secret.characterId));
  const other = players.find((p) => p.id !== me).id;
  assert.equal(E.projectFor(state, other, T).turn.guessOptions, null);
});

test('guess options: same category preferred and correct position varies', () => {
  const positions = new Set();
  for (let s = 1; s <= 60; s++) {
    const o = E.buildGuessOptions('f1', [], E.seededRng(s));
    positions.add(o.indexOf('f1'));
    assert.ok(o.every((id) => id.startsWith('f')), 'football has ≥4 so all same category');
  }
  assert.equal(positions.size, 4);
});

test('questions: only active player, target ≠ self, one pending, only target answers once', () => {
  let { state } = start();
  const me = state.turn.playerId;
  const [t1, t2] = players.filter((p) => p.id !== me).map((p) => p.id);
  assert.equal(code(() => E.submitQuestion(state, t1, { targetId: t2, text: 'هل هو لاعب؟' }, ctx())), 'NOT_YOUR_TURN');
  assert.equal(code(() => E.submitQuestion(state, me, { targetId: me, text: 'هل هو لاعب؟' }, ctx())), 'SELF_TARGET');
  assert.equal(code(() => E.submitQuestion(state, me, { targetId: t1, text: ' ' }, ctx())), 'EMPTY_QUESTION');
  ({ state } = E.submitQuestion(state, me, { targetId: t1, text: 'هل هو لاعب؟' }, ctx()));
  assert.equal(code(() => E.submitQuestion(state, me, { targetId: t2, text: 'سؤال ثاني' }, ctx())), 'PENDING_QUESTION');
  const qid = state.turn.questions[0].id;
  assert.equal(code(() => E.submitAnswer(state, t2, { questionId: qid, answer: 'yes' }, ctx())), 'NOT_TARGET');
  assert.equal(code(() => E.submitAnswer(state, me, { questionId: qid, answer: 'yes' }, ctx())), 'NOT_TARGET');
  assert.equal(code(() => E.submitAnswer(state, t1, { questionId: qid, answer: 'banana' }, ctx())), 'BAD_ANSWER');
  let r = E.submitAnswer(state, t1, { questionId: qid, answer: 'maybe' }, ctx());
  assert.equal(r.events[0].type, 'answerSubmitted');
  state = r.state;
  assert.equal(code(() => E.submitAnswer(state, t1, { questionId: qid, answer: 'no' }, ctx())), 'ALREADY_ANSWERED');
  assert.equal(state.turn.questions[0].answer, 'maybe');
  // can ask same person again, and a different person
  ({ state } = E.submitQuestion(state, me, { targetId: t1, text: 'طيب مصري؟' }, ctx()));
  const q2 = state.turn.questions[1].id;
  ({ state } = E.cancelQuestion(state, me, { questionId: q2 }, ctx()));
  assert.equal(code(() => E.submitAnswer(state, t1, { questionId: q2, answer: 'yes' }, ctx())), 'ALREADY_ANSWERED');
  ({ state } = E.submitQuestion(state, me, { targetId: t2, text: 'عايش؟' }, ctx()));
  assert.equal(state.turn.questions.length, 3);
});

test('scoring 100/70/40 and no double scoring', () => {
  for (const [wrongs, pts] of [[0, 100], [1, 70], [2, 40]]) {
    let { state } = start(11);
    const me = state.turn.playerId;
    for (let i = 0; i < wrongs; i++) {
      ({ state } = E.requestGuess(state, me, ctx(i + 1)));
      const wrong = state.turn.guessOptions.find((id) => id !== state.secret.characterId);
      ({ state } = E.submitGuess(state, me, { choiceId: wrong }, ctx()));
      assert.equal(state.phase, 'turn');
    }
    ({ state } = E.requestGuess(state, me, ctx(9)));
    const r = E.submitGuess(state, me, { choiceId: state.secret.characterId }, ctx());
    assert.equal(r.state.scores[me], pts);
    assert.equal(r.state.phase, 'reveal');
    assert.deepEqual(r.events.map((e) => e.type), ['guessSubmitted', 'scoreUpdated', 'turnCompleted']);
    // a replay of the same guess is rejected, score unchanged
    assert.equal(code(() => E.submitGuess(r.state, me, { choiceId: state.secret.characterId }, ctx())), 'NO_ACTIVE_TURN');
    assert.equal(r.state.scores[me], pts);
  }
});

test('wrong options are not offered again; 3 wrong → exhausted, 0 points', () => {
  let { state } = start(5);
  const me = state.turn.playerId;
  const seen = [];
  for (let i = 0; i < 3; i++) {
    ({ state } = E.requestGuess(state, me, ctx(i + 3)));
    assert.ok(!state.turn.guessOptions.some((id) => seen.includes(id)));
    const wrong = state.turn.guessOptions.find((id) => id !== state.secret.characterId);
    seen.push(wrong);
    ({ state } = E.submitGuess(state, me, { choiceId: wrong }, ctx()));
  }
  assert.equal(state.phase, 'reveal');
  assert.equal(state.turn.outcome, 'exhausted');
  assert.equal(state.scores[me], 0);
  assert.equal(code(() => E.requestGuess(state, me, ctx())), 'NO_ACTIVE_TURN');
});

test('bad choice not in offered options is rejected', () => {
  let { state } = start();
  const me = state.turn.playerId;
  assert.equal(code(() => E.submitGuess(state, me, { choiceId: state.secret.characterId }, ctx())), 'BAD_CHOICE');
  ({ state } = E.requestGuess(state, me, ctx()));
  assert.equal(code(() => E.submitGuess(state, me, { choiceId: 'zzz' }, ctx())), 'BAD_CHOICE');
});

test('انتهاء الوقت: بتظهر اختيارات التخمين ومهلة ١٠ ثواني، ولو ما اختارش الدور بيخلص بصفر مرة واحدة', () => {
  const { state } = start();
  const me = state.turn.playerId;
  const late = state.turn.endsAt + 1;
  assert.equal(code(() => E.requestGuess(state, me, { now: late })), 'TIME_UP');
  const r1 = E.tick(state, { now: late });
  assert.equal(r1.state.phase, 'turn');                       // مش خلص: في مهلة تخمين
  assert.equal(r1.state.turn.finalGuess, true);
  assert.equal(r1.state.turn.guessOptions.length, 4);
  assert.equal(r1.state.turn.endsAt, late + 10000);
  assert.equal(r1.events.length, 0);
  assert.equal(E.projectFor(r1.state, me, late).turn.guessOptions.length, 4);       // صاحب الدور شايف الاختيارات
  assert.equal(E.projectFor(r1.state, 'b', late).turn.guessOptions, null);          // الباقي لأ
  assert.equal(E.projectFor(r1.state, 'b', late).turn.guessing, true);
  // أثناء المهلة: مفيش أسئلة جديدة ولا رجوع للأسئلة
  assert.equal(code(() => E.submitQuestion(r1.state, me, { targetId: 'b', text: 'هل هو لاعب؟' }, { now: late + 1 })), 'FINAL_GUESS');
  assert.equal(code(() => E.cancelGuess(r1.state, me, { now: late + 1 })), 'NO_RETURN');
  // tick قبل انتهاء المهلة ما بيعملش حاجة
  assert.equal(E.tick(r1.state, { now: late + 5000 }).state, r1.state);
  // بعد المهلة: الدور يخلص بصفر
  const r2 = E.tick(r1.state, { now: late + 10001 });
  assert.equal(r2.state.phase, 'reveal');
  assert.equal(r2.state.turn.outcome, 'timeout');
  assert.deepEqual(r2.events.map((e) => e.type), ['scoreUpdated', 'turnCompleted']);
  const r3 = E.tick(r2.state, { now: late + 10010 });
  assert.equal(r3.events.length, 0);
  assert.equal(r3.state.results.length, 1);
});

test('التخمين في مهلة الوقت الإضافي: الصح بيتحسب بنقطه، والغلط بيجيب اختيارات جديدة بنفس المهلة', () => {
  const { state } = start();
  const me = state.turn.playerId;
  const late = state.turn.endsAt + 1;
  let r = E.tick(state, { now: late });
  const deadline = r.state.turn.endsAt;
  const wrongId = r.state.turn.guessOptions.find((id) => id !== r.state.secret.characterId);
  r = E.submitGuess(r.state, me, { choiceId: wrongId }, { now: late + 2000 });
  assert.equal(r.state.phase, 'turn');
  assert.equal(r.state.turn.endsAt, deadline);                                       // المهلة ما اتجدّدتش
  assert.equal(r.state.turn.guessOptions.length, 4);
  assert.ok(!r.state.turn.guessOptions.includes(wrongId));                           // الغلط ما بيتعرضش تاني
  r = E.submitGuess(r.state, me, { choiceId: r.state.secret.characterId }, { now: late + 4000 });
  assert.equal(r.state.phase, 'reveal');
  assert.equal(r.state.turn.outcome, 'correct');
  assert.equal(r.state.turn.points, 70);                                             // المحاولة التانية
});

test('لو التخمين كان مفتوح لما الوقت خلص: بياخد مهلة ١٠ ثواني كمان، ولو المحاولات خلصت الدور بيخلص علطول', () => {
  let { state } = start();
  const me = state.turn.playerId;
  ({ state } = E.requestGuess(state, me, ctx()));
  const r = E.tick(state, { now: state.turn.endsAt + 1 });
  assert.equal(r.state.phase, 'turn');
  assert.equal(r.state.turn.finalGuess, true);
  assert.equal(r.state.turn.guessOptions.length, 4);

  const s2 = start().state;
  s2.turn.attempts = [1, 2, 3].map((n) => ({ n, choiceId: 'x' + n, correct: false, at: T }));
  const r2 = E.tick(s2, { now: s2.turn.endsAt + 1 });
  assert.equal(r2.state.phase, 'reveal');
  assert.equal(r2.state.turn.outcome, 'timeout');
});

test('full round: each player plays exactly once, then final ranking; can start a new round', () => {
  const first = E.startRound(mk(), 'a', ctx(21));
  let state = first.state;
  let now = T;
  const order = [];
  const types = first.events.map((e) => e.type);
  for (let guard = 0; guard < 50 && state.phase !== 'final'; guard++) {
    if (state.phase === 'turn') {
      order.push(state.turn.playerId);
      const me = state.turn.playerId;
      let r = E.requestGuess(state, me, { rng: E.seededRng(guard), now });
      r = E.submitGuess(r.state, me, { choiceId: r.state.secret.characterId }, { now });
      state = r.state; types.push(...r.events.map((e) => e.type));
    }
    now += 8000;
    const r = E.tick(state, { rng: E.seededRng(guard + 100), now });
    state = r.state; types.push(...r.events.map((e) => e.type));
    now += 4000;
    const r2 = E.tick(state, { rng: E.seededRng(guard + 200), now });
    state = r2.state; types.push(...r2.events.map((e) => e.type));
  }
  assert.equal(state.phase, 'final');
  assert.equal(order.length, 4);
  assert.equal(new Set(order).size, 4, 'no repeated player in a round');
  assert.equal(types.filter((t) => t === 'roundCompleted').length, 1);
  assert.equal(types.filter((t) => t === 'turnStarted').length, 4);
  const rk = E.ranking(state);
  assert.equal(rk[0].score, 100);
  assert.equal(rk[0].rank, 1);
  // new round resets scores
  const n = E.startRound(state, 'a', ctx(3, now));
  assert.equal(n.state.roundNo, 2);
  assert.ok(Object.values(n.state.scores).every((x) => x === 0));
  // characters don't repeat within the round
  assert.equal(new Set(state.results.map((r) => r.characterId)).size, 4);
});

test('revealed character is public after the turn, including to the active player', () => {
  let { state } = start();
  const me = state.turn.playerId;
  state = E.tick(state, { now: state.turn.endsAt + 1 }).state;   // مهلة التخمين
  state = E.tick(state, { now: state.turn.endsAt + 1 }).state;   // وبعدها الدور يخلص
  const v = E.projectFor(state, me, T);
  assert.equal(v.turn.character.name, CHARACTER_BY_ID[state.secret.characterId].name);
});

test('بعد «أنا عرفت!» مفيش رجوع للأسئلة: الاختيارات تفضل، والرجوع مرفوض، ومفيش اختيارات جديدة بتتسحب بإعادة الطلب', () => {
  let { state } = start();
  const me = state.turn.playerId;
  ({ state } = E.requestGuess(state, me, ctx()));
  const opts = [...state.turn.guessOptions];
  assert.equal(code(() => E.cancelGuess(state, me, ctx())), 'NO_RETURN');
  assert.deepEqual(state.turn.guessOptions, opts);
  const again = E.requestGuess(state, me, ctx());
  assert.deepEqual(again.state.turn.guessOptions, opts);   // نفس الاختيارات، مش اختيارات جديدة
  assert.equal(code(() => E.submitQuestion(state, me, { targetId: 'b', text: 'هل هو لاعب؟' }, ctx())), 'GUESSING');
});

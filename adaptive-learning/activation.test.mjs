import test from 'node:test';
import assert from 'node:assert/strict';
import { createProfileCache } from './session.mjs';
import { modelReadiness } from './activation.mjs';
import { strategyPriorities } from './exploration.mjs';

const item = 'N5:preview:vocab:猫';
const start = Date.UTC(2026, 8, 1);
const session = 3600000;
function attempt(index) {
  const correct = index % 5 !== 0;
  return { id: String(index), item, skill: item, at: start + Math.floor(index / 5) * session + index,
    correct, rating: correct ? 3 : 1, difficulty: 0, guess: 0.25, slip: 0.05, seconds: 6 };
}
const attempts = n => Array.from({ length: n }, (_, index) => attempt(index));

test('cold start preserves FSRS and gates each personalized model separately', () => {
  const cache = createProfileCache();
  const initial = cache(attempts(55));
  assert.equal(initial.sessions, 11);
  assert.equal(initial.readiness.phase, 'Cold Start');
  assert.equal(initial.skills.size, 0);
  assert.ok(initial.cards.has(item));
  const collecting = cache(attempts(56));
  assert.equal(collecting.sessions, 12);
  assert.equal(collecting.readiness.mastery, true);
  assert.equal(collecting.readiness.irt, false);
  assert.equal(collecting.skillProfile(item).ability, 0);
  const accepted = cache(attempts(60));
  assert.ok(accepted.skillProfile(item).ability > 0);
  assert.equal(modelReadiness(19, 100).reminder, false);
  assert.equal(modelReadiness(20, 100).reminder, true);
});

test('an appended answer updates once, replay after backfill matches a fresh profile', () => {
  const cache = createProfileCache();
  const original = attempts(60);
  const prior = cache(original);
  assert.equal(cache([...original].reverse()), prior);
  const withoutFirst = attempts(65).slice(1);
  cache(withoutFirst);
  const backfilled = attempts(66);
  const replayed = cache([...backfilled, { ...attempt(70), difficulty: NaN }]);
  const fresh = createProfileCache()(backfilled);
  assert.deepEqual(replayed.cards, fresh.cards);
  assert.deepEqual(replayed.skills, fresh.skills);
  assert.deepEqual(replayed.skillProfile(item), fresh.skillProfile(item));
});

test('study strategy sampling stays off with no retained outcomes', () => {
  assert.equal(strategyPriorities(attempts(100), () => { throw new Error('Unexpected sampling'); }, 12).size, 0);
});

test('pacing survives cache recreation and interrupted sessions via replay', () => {
  const events = attempts(75).map((event, i) => i < 60 ? event :
    { ...event, correct: false, rating: 1 });
  const live = createProfileCache();
  assert.equal(live(events.slice(0, 55)).pacing.output, 0);
  live(events.slice(0, 70));
  const state = live(events).pacing;
  assert.ok(state.output < 0);
  assert.ok(state.output >= -0.4);
  assert.deepEqual(createProfileCache()([...events].reverse()).pacing, state);
});

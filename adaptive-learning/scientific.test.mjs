import test from 'node:test';
import assert from 'node:assert/strict';
import { fsrs, createEmptyCard } from 'ts-fsrs';
import { bkt, observeSkill, validateAbility } from './models.mjs';
import { desiredRetention, Rating, reviewCard } from './memory.mjs';
import { assessWriting } from './strokes.mjs';

test('FSRS wrapper matches upstream stability, difficulty and due times for every grade', () => {
  const reference = fsrs({request_retention: desiredRetention, enable_fuzz: false});
  const start = new Date('2026-11-01T00:00:00Z');
  const first = reviewCard(null, start, Rating.Good);
  assert.deepEqual(first, reference.next(createEmptyCard(start), start, Rating.Good).card);
  for (const grade of [1, 2, 3, 4]) {
    assert.deepEqual(reviewCard(first, first.due, grade), reference.next(first, first.due, grade).card);
  }
});

test('validation keeps only a personal Rasch fit that improves future log loss', () => {
  const established = Array.from({length: 80}, (_, i) => ({ difficulty: 0, correct: i % 5 !== 0 }));
  assert.equal(validateAbility(established.slice(0, 12)).evaluated, false);
  assert.equal(validateAbility(established).accepted, true);
  const drift = established.map((r, i) => i < 60 ? r : { ...r, correct: !r.correct });
  assert.equal(validateAbility(drift).accepted, false);
});

test('handwriting alignment separates count, order, direction, shape and placement', () => {
  const ref = [[[0.2, 0.1], [0.2, 0.8]], [[0.2, 0.4], [0.8, 0.4]]];
  assert.deepEqual(assessWriting([], ref).count, { actual: 0, expected: 2 });
  const moved = ref.map(path => path.map(([x, y]) => [0.4 + 0.5*x, 0.15 + 0.5*y]));
  const assessed = assessWriting(moved, ref);
  assert.ok(assessed.strokes.every(s => s.shape < 1e-9 && !s.reversed));
  assert.ok(Math.abs(assessed.scaleRatio - 0.5) < 1e-9);
  assert.ok(assessed.placement > 0);
  assert.equal(assessWriting([ref[0].slice().reverse(), ref[1]], ref).strokes[0].reversed, true);
  assert.equal(assessWriting([ref[1], ref[0]], ref).strokes[0].otherStroke, 2);
});

test('BKT closed-form update equals the shared HMM marginal when states are lumpable', () => {
  const prior = [0.35, 0.25, 0.2, 0.2];
  const transition = [[0.9,0,0,0.1],[0,0.9,0,0.1],[0,0,0.9,0.1],[0,0,0,1]];
  const prediction = bkt(0.2, true, { guess: 0.25, slip: 0.1, learn: 0.1 });
  assert.ok(Math.abs(prediction - (0.9 * 0.2 / 0.38 + (1 - 0.9 * 0.2 / 0.38) * 0.1)) < 1e-12);
  assert.ok(Math.abs(observeSkill(prior, true, [0.25,0.25,0.25,0.9], transition).mastery - prediction) < 1e-12);
});

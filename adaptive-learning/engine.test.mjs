import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultPrior, emissions, observeSkill, informationGain, selectQuestion, fitAbility } from './models.mjs';
import { PrerequisiteGraph } from './graph.mjs';
import { Rating, reviewCard, retentionAt } from './memory.mjs';
import { compareWriting, strokeDistance } from './strokes.mjs';
import { optimizePlan } from './planning.mjs';
import { buildProfile, dailyStudyPlan } from './session.mjs';
import { chooseReminder, fitStudySessions, updateDifficulty } from './pacing.mjs';
import { selectGrammarRules } from './mdl.mjs';
import { sampleLearningPriority } from './exploration.mjs';

const day = 86400000;
const weights = { retention: 2, mastery: 2, exam: 1, time: 0.1, load: 0.1 };
const parameters = { difficulty: 0, guess: 0.25, slip: 0.05 };

test('FSRS matches the upstream initial stability and lowers retention over time', () => {
  const card = reviewCard(null, 0, Rating.Good);
  assert.equal(card.stability, 2.3065);
  assert.equal(card.due.getTime(), 600000);
  assert.ok(retentionAt(card, day) > retentionAt(card, day * 4));
  const success = reviewCard(card, day * 4, Rating.Good);
  const failure = reviewCard(card, day * 4, Rating.Again);
  assert.ok(success.stability > failure.stability);
  assert.ok(success.due > failure.due);
});

test('BKT projection agrees with normalized four-state forward step', () => {
  const chances = emissions(0, 0, 0.25, 0.05);
  const correct = observeSkill(defaultPrior, true, chances);
  const incorrect = observeSkill(defaultPrior, false, chances);
  assert.ok(Math.abs(correct.mastery - correct.belief[3]) < 1e-12);
  assert.ok(Math.abs(incorrect.belief.reduce((a, b) => a + b, 0) - 1) < 1e-12);
  assert.ok(correct.mastery > incorrect.mastery);
  assert.equal(informationGain(defaultPrior, [0.5, 0.5, 0.5, 0.5]), 0);
  const questions = [0, 20].map(difficulty => ({ ...parameters, id: String(difficulty), skill: 's', difficulty }));
  assert.equal(selectQuestion(questions, new Map()).question.id, '0');
  assert.equal(selectQuestion(questions, new Map(), { offset: 20, radius: 1 }).question.id, '20');
  assert.ok(fitAbility(Array.from({ length: 50 }, (_, i) => ({ difficulty: 0, correct: i > 10 }))) > 0);
});

test('prerequisites are topologically sorted and cycles are rejected', () => {
  const graph = new PrerequisiteGraph(['c', 'b', 'a'], [['a', 'b'], ['b', 'c']]);
  assert.deepEqual(graph.weakPrerequisites('c', new Map(), new Set(['a', 'b', 'c']), 0.7), ['a', 'b']);
  assert.throws(() => new PrerequisiteGraph(['a', 'b'], [['a', 'b'], ['b', 'a']]), /Cycle/);
});

test('DTW tolerates sampling speed and detects reversal and incomplete glyphs', () => {
  const path = [[0.1, 0.2], [0.8, 0.2]];
  assert.ok(strokeDistance([[0.1, 0.2], [0.12, 0.2], [0.8, 0.2]], path) < 1e-12);
  assert.ok(strokeDistance([...path].reverse(), path) > 0.2);
  assert.equal(compareWriting([], [path]), null);
});

test('multi-objective plan finds the preferred combination within both constraints', () => {
  const tasks = [
    { id: 'a', retention: 0.9, seconds: 6, load: 3 },
    { id: 'b', retention: 0.65, seconds: 5, load: 2 },
    { id: 'c', retention: 0.65, seconds: 5, load: 2 },
  ].map(task => ({ mastery: 0, exam: 0, ...task }));
  assert.deepEqual(optimizePlan(tasks, 10, 4, weights).map(t => t.id), ['b', 'c']);
});

test('replay deduplicates reviews, respects access and replans after outcomes', () => {
  const event = { ...parameters, id: '1', at: 0, item: 'a', skill: 'a', correct: false, rating: Rating.Again };
  const profile = buildProfile([event, event]);
  assert.equal(profile.cards.get('a').reps, 1);
  const graph = new PrerequisiteGraph(['a', 'b', 'c'], [['a', 'c']]);
  const tasks = ['a', 'b', 'c'].map(item => ({
    ...parameters, item, skill: item, accessible: item !== 'b', examAligned: true, seconds: 20, load: 1,
  }));
  const options = { at: 4 * day, seconds: 60, maxLoad: 4, weights, masteryThreshold: 0.5 };
  assert.deepEqual(dailyStudyPlan(tasks, profile, graph, options).map(task => task.item), ['a']);
  const reviews = Array.from({ length: 13 }, (_, i) => ({
    ...event, id: String(i + 2), at: (i + 1) * 60000, correct: true, rating: Rating.Good,
  }));
  const trained = buildProfile([event, ...reviews.reverse()]);
  assert.ok(dailyStudyPlan(tasks, trained, graph, options).some(task => task.item === 'c'));
});

test('PID is smoothed, slew-limited and stops integral windup', () => {
  const settings = { target: 0.75, kp: 2, ki: 0.4, kd: 0.2, smoothing: 0.2, limit: 0.4, maxStep: 0.05 };
  let state = { accuracy: 0.75, error: 0, derivative: 0, integral: 0, output: 0 };
  for (let i = 0; i < 80; i++) {
    const next = updateDifficulty(state, true, 1, settings);
    assert.ok(Math.abs(next.output - state.output) < 0.050001);
    assert.ok(next.output <= 0.4);
    state = next;
  }
  assert.ok(Math.abs(state.integral) < 1);
  assert.ok(updateDifficulty(state, false, 1, settings).output < state.output);
});

test('Hawkes fits clustered sessions and respects notification constraints', () => {
  const hour = day / 24;
  const events = Array.from({ length: 25 }, (_, i) => (Math.floor(i / 5) * 72 + i % 5 / 4) * hour);
  const model = fitStudySessions(events, 0, 360 * hour);
  assert.ok(model.branching > 0 && model.branching < 1);
  assert.equal(fitStudySessions(events.slice(0, 8), 0, 360 * hour), null);
  const slots = [{ at: model.at, quiet: true }, { at: model.at + hour, quiet: false }];
  const state = { permitted: true, alreadyScheduled: false, asOf: model.at };
  assert.equal(chooseReminder(model, slots, slots[1].at, state), slots[1].at);
  assert.equal(chooseReminder(model, slots, slots[1].at, { ...state, alreadyScheduled: true }), null);
  assert.equal(chooseReminder(null, slots, slots[1].at, state), slots[1].at);
});

test('MDL supports an exact verified grammar rewrite when it shortens encoding', () => {
  const bases = ['食べる', '見る', '起きる', '教える', '忘れる'];
  const rule = { id: 'ichidan', description: 'Drop final る before させられませんでした', apply: base => base.slice(0, -1) + 'させられませんでした' };
  const examples = bases.map(base => ({ base, form: 'c', surface: rule.apply(base) }));
  const before = selectGrammarRules(examples, []);
  const after = selectGrammarRules(examples, [rule]);
  assert.deepEqual(after.rules, ['ichidan']);
  assert.ok(after.modelBits + after.dataBits < before.modelBits + before.dataBits);
  assert.deepEqual(selectGrammarRules([{ base: '帰る', form: 'c', surface: '帰らせられませんでした' }], [rule]).rules, []);
});

test('Thompson sampler responds to observed Bernoulli counts', () => {
  let seed = 12;
  const random = () => ((seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / 2 ** 32);
  const totals = [0, 0];
  for (let i = 0; i < 500; i++) {
    totals[0] += sampleLearningPriority({ successes: 30, failures: 6 }, random);
    totals[1] += sampleLearningPriority({ successes: 6, failures: 30 }, random);
  }
  assert.ok(totals[0] / 500 > 0.75 && totals[1] / 500 < 0.25);
});

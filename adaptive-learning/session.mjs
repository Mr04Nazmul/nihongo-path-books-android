import { initialReaderPacing, observeReaderPacing } from './pacing.mjs';
import { modelReadiness, validAttempt } from './activation.mjs';
import { defaultPrior, observeSkill, emissions, informationGain, validateAbility } from './models.mjs';
import { Rating, retentionAt, reviewCard } from './memory.mjs';
import { optimizePlan, taskScore } from './planning.mjs';

function skillScope(skill) {
  const match = /^(N[1-5]:(?:preview|full)):/.exec(skill);
  return match ? match[1] : '';
}

function createProfileAccumulator(protectColdStart) {
  const cards = new Map();
  const skills = new Map();
  const responses = new Map();
  const abilities = new Map();
  const seen = new Set();
  const counts = new Map();
  let sessions = 0;
  let answers = 0;
  let lastAnswer = -Infinity;
  let pacing = initialReaderPacing();
  function append(event) {
    if (seen.has(event.id)) return;
    seen.add(event.id);
    if (event.item && event.rating != null) {
      cards.set(event.item, reviewCard(cards.get(event.item), event.at, event.rating));
    }
    if (typeof event.correct === 'boolean') {
      if (event.at - lastAnswer >= 1800000) sessions++;
      lastAnswer = event.at;
      // Replay pacing from SQLite after restart. Exam results never enter this history.
      if (protectColdStart && modelReadiness(sessions, answers).pacing &&
          !event.item.includes(':sakura-')) pacing = observeReaderPacing(pacing, event);
      answers++;
      const scope = skillScope(event.skill);
      const previous = skills.get(event.skill) ?? { belief: defaultPrior };
      const ability = abilities.get(scope) ?? 0;
      const likelihood = emissions(ability, event.difficulty, event.guess, event.slip);
      skills.set(event.skill, observeSkill(previous.belief, event.correct, likelihood));
      const history = responses.get(scope) ?? [];
      history.push(event);
      responses.set(scope, history);
      // Estimate learner ability across questions in the same reader scope.
      // Evaluate only after each block and preserve the chronological holdout.
      if (history.length > 200) history.shift();
      const scopeCount = (counts.get(scope) ?? 0) + 1;
      counts.set(scope, scopeCount);
      if ((!protectColdStart || modelReadiness(sessions, scopeCount).irt) && scopeCount % 20 === 0) {
        abilities.set(scope, validateAbility(history).ability);
      }
    }
  }
  function skillProfile(skill) {
    return {
      ...( (!protectColdStart || modelReadiness(sessions, answers).mastery ? skills.get(skill) : null)
        ?? { belief: defaultPrior, mastery: defaultPrior[3] }),
      ability: abilities.get(skillScope(skill)) ?? 0,
    };
  }
  function current() {
    const readiness = modelReadiness(sessions, answers);
    return { cards, skills: protectColdStart && !readiness.mastery ? new Map() : skills,
      skillProfile, readiness, sessions, pacing };
  }
  return { append, current };
}

function chronological(a, b) {
  return a.at - b.at || a.id.localeCompare(b.id);
}

export function buildProfile(events) {
  const accumulator = createProfileAccumulator(false);
  for (const event of [...events].sort(chronological)) accumulator.append(event);
  return accumulator.current();
}

// The reader owns one cache per account-bound reader. A sync backfill,
// truncation or reordered history forces a full deterministic replay.
export function createProfileCache() {
  let previous = [];
  let accumulator = createProfileAccumulator(true);
  let cached;
  return events => {
    const ordered = events.filter(validAttempt).sort(chronological);
    const prefix = previous.length <= ordered.length &&
      previous.every((event, i) => event.id === ordered[i].id && event.at === ordered[i].at);
    if (!prefix) accumulator = createProfileAccumulator(true);
    if (prefix && cached && previous.length === ordered.length) return cached;
    for (let i = prefix ? previous.length : 0; i < ordered.length; i++) accumulator.append(ordered[i]);
    previous = ordered;
    cached = accumulator.current();
    return cached;
  };
}

export function dailyStudyPlan(tasks, profile, graph, options) {
  const { at, seconds, maxLoad, weights, masteryThreshold } = options;
  const mastery = new Map([...profile.skills].map(([id, skill]) => [id, skill.mastery]));
  const access = new Set(graph.order);
  const candidates = [];
  for (const task of tasks) {
    if (!task.accessible || graph.weakPrerequisites(task.skill, mastery, access, masteryThreshold).length) continue;
    const skill = profile.skillProfile(task.skill);
    const likelihood = emissions(skill.ability, task.difficulty, task.guess, task.slip);
    const correct = skill.belief.reduce((total, p, i) => total + p * likelihood[i], 0);
    const afterCorrect = observeSkill(skill.belief, true, likelihood).mastery;
    const afterIncorrect = observeSkill(skill.belief, false, likelihood).mastery;
    const card = profile.cards.get(task.item);
    const recall = retentionAt(card, at);
    let retention = 0;
    if (recall !== null && card.due.getTime() <= at) {
      const horizon = at + 86400000;
      const afterGood = retentionAt(reviewCard(card, at, Rating.Good), horizon);
      const afterAgain = retentionAt(reviewCard(card, at, Rating.Again), horizon);
      retention = Math.max(0, recall * afterGood + (1 - recall) * afterAgain - retentionAt(card, horizon));
    }
    candidates.push({
      ...task,
      retention,
      mastery: Math.max(0, correct * afterCorrect + (1 - correct) * afterIncorrect - skill.mastery),
      exam: (task.examAligned ? informationGain(skill.belief, likelihood) : 0) +
        (Number.isFinite(task.mockExamPriority) ? Math.max(0, Math.min(0.08, task.mockExamPriority)) : 0),
    });
  }
  // Bound the expensive frontier on lower-memory devices. Rank every
  // feasible item first; keep up to 240 candidates for the Daily Study plan.
  const feasible = candidates.filter(task => task.seconds <= seconds && task.load <= maxLoad);
  if (feasible.length > 240) {
    const score = task => taskScore(task, seconds, maxLoad, weights);
    feasible.sort((a, b) => score(b) - score(a));
    feasible.length = 240;
  }
  return optimizePlan(feasible, seconds, maxLoad, weights);
}

import { defaultPrior, observeSkill, emissions, informationGain, validateAbility } from './models.mjs';
import { Rating, retentionAt, reviewCard } from './memory.mjs';
import { optimizePlan, taskScore } from './planning.mjs';

function skillScope(skill) {
  const match = /^(N[1-5]:(?:preview|full)):/.exec(skill);
  return match ? match[1] : '';
}

export function buildProfile(events) {
  const cards = new Map();
  const skills = new Map();
  const responses = new Map();
  const abilities = new Map();
  const seen = new Set();
  const ordered = [...events].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  for (const event of ordered) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    if (event.item && event.rating != null) {
      cards.set(event.item, reviewCard(cards.get(event.item), event.at, event.rating));
    }
    if (typeof event.correct === 'boolean') {
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
      if (history.length % 20 === 0) abilities.set(scope, validateAbility(history.slice(-200)).ability);
    }
  }
  function skillProfile(skill) {
    return {
      ...(skills.get(skill) ?? { belief: defaultPrior, mastery: defaultPrior[3] }),
      ability: abilities.get(skillScope(skill)) ?? 0,
    };
  }
  for (const key of skills.keys()) skills.set(key, skillProfile(key));
  return { cards, skills, skillProfile };
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
      exam: task.examAligned ? informationGain(skill.belief, likelihood) : 0,
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

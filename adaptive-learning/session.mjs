import { defaultPrior, observeSkill, emissions, informationGain, fitAbility } from './models.mjs';
import { Rating, retentionAt, reviewCard } from './memory.mjs';
import { optimizePlan } from './planning.mjs';

export function buildProfile(events) {
  const cards = new Map();
  const skills = new Map();
  const responses = new Map();
  const seen = new Set();
  const ordered = [...events].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  for (const event of ordered) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    if (event.item && event.rating != null) {
      cards.set(event.item, reviewCard(cards.get(event.item), event.at, event.rating));
    }
    if (typeof event.correct === 'boolean') {
      const previous = skills.get(event.skill) ?? { belief: defaultPrior, ability: 0 };
      const likelihood = emissions(previous.ability, event.difficulty, event.guess, event.slip);
      const updated = observeSkill(previous.belief, event.correct, likelihood);
      const history = responses.get(event.skill) ?? [];
      history.push(event);
      responses.set(event.skill, history);
      // Fit on a bounded history after each block of scored opportunities.
      const ability = history.length % 20 === 0 ? fitAbility(history.slice(-200)) : previous.ability;
      skills.set(event.skill, { ...updated, ability });
    }
  }
  return { cards, skills };
}

export function dailyStudyPlan(tasks, profile, graph, options) {
  const { at, seconds, maxLoad, weights, masteryThreshold } = options;
  const mastery = new Map([...profile.skills].map(([id, skill]) => [id, skill.mastery]));
  const access = new Set(graph.order);
  const candidates = [];
  for (const task of tasks) {
    if (!task.accessible || graph.weakPrerequisites(task.skill, mastery, access, masteryThreshold).length) continue;
    const skill = profile.skills.get(task.skill) ?? { belief: defaultPrior, ability: 0, mastery: defaultPrior[3] };
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
  return optimizePlan(candidates, seconds, maxLoad, weights);
}

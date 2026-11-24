// Beta-Bernoulli Thompson sampling via two independent gamma draws.
function gamma(shape, random) {
  const offset = shape - 1 / 3;
  const scale = 1 / Math.sqrt(9 * offset);
  for (;;) {
    const normal = Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());
    const cube = (1 + scale * normal) ** 3;
    if (cube <= 0) continue;
    if (Math.log(1 - random()) < 0.5 * normal ** 2 + offset * (1 - cube + Math.log(cube))) {
      return offset * cube;
    }
  }
}

export function sampleLearningPriority({ successes, failures }, random = Math.random) {
  const success = gamma(1 + successes, random);
  const failure = gamma(1 + failures, random);
  return success / (success + failure);
}

export function studyStrategy(event) {
  if (event.item.includes(':sakura-')) return 'mock';
  if (event.difficulty === 0.35) return 'reverse';
  if (event.difficulty === 0.2) return 'reading';
  return 'meaning';
}

export function strategyPriorities(events, random = Math.random) {
  const evidence = new Map(['meaning', 'reading', 'reverse', 'mock']
    .map(strategy => [strategy, { successes: 0, failures: 0 }]));
  const previous = new Map();
  const ordered = [...events].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  for (const event of ordered) {
    const prior = previous.get(event.item);
    if (prior && event.at - prior.at >= 86400000) {
      evidence.get(studyStrategy(prior))[event.correct ? 'successes' : 'failures']++;
    }
    previous.set(event.item, event);
  }
  return new Map([...evidence].map(([strategy, counts]) => [strategy, sampleLearningPriority(counts, random)]));
}

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

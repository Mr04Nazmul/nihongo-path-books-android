const sum = values => values.reduce((total, value) => total + value, 0);
const sigmoid = value => 1 / (1 + Math.exp(-value));

export const learningStates = ['not learned', 'learning', 'partially mastered', 'mastered'];

// Explicit cold-start priors. A row describes the next state after one opportunity.
export const defaultTransition = [
  [0.85, 0.15, 0, 0],
  [0, 0.84, 0.16, 0],
  [0, 0, 0.87, 0.13],
  [0, 0, 0, 1],
];
export const defaultPrior = [0.76, 0.13, 0.07, 0.04];

export function bkt(prior, correct, { guess, slip, learn }) {
  const masteredLikelihood = correct ? 1 - slip : slip;
  const unmasteredLikelihood = correct ? guess : 1 - guess;
  const probability = prior * masteredLikelihood;
  const posterior = probability / (probability + (1 - prior) * unmasteredLikelihood);
  return posterior + (1 - posterior) * learn;
}

// Rasch IRT with explicit chance and slip floors. Latent-state ability offsets
// give the HMM its emissions and BKT its conditional guess/slip probabilities.
export function emissions(ability, difficulty, guess, slip) {
  return [-2.5, -1, 0.4, 2].map(offset =>
    guess + (1 - guess - slip) * sigmoid(ability + offset - difficulty));
}

export function forward(belief, correct, likelihood, transition = defaultTransition) {
  const evidence = belief.map((probability, i) =>
    probability * (correct ? likelihood[i] : 1 - likelihood[i]));
  const normalizer = sum(evidence);
  if (normalizer <= 0) throw new RangeError('Observation has zero probability');
  return belief.map((_, next) =>
    sum(evidence.map((value, current) => value * transition[current][next])) / normalizer);
}

export function observeSkill(prior, correct, likelihood, transition = defaultTransition) {
  const belief = forward(prior, correct, likelihood, transition);
  const mastered = prior[3];
  const unmastered = 1 - mastered;
  if (unmastered < 1e-12) return { belief, mastery: belief[3] };
  const guess = sum(prior.slice(0, 3).map((p, i) => p * likelihood[i])) / unmastered;
  const evidence = prior.slice(0, 3).map((p, i) => p * (correct ? likelihood[i] : 1 - likelihood[i]));
  const learn = sum(evidence.map((p, i) => p * transition[i][3])) / sum(evidence);
  return { belief, mastery: bkt(mastered, correct, { guess, slip: 1 - likelihood[3], learn }) };
}

export function entropy(probabilities) {
  return -sum(probabilities.filter(p => p > 0).map(p => p * Math.log2(p)));
}

export function informationGain(prior, likelihood) {
  const expectedCorrect = sum(prior.map((p, i) => p * likelihood[i]));
  // Equivalent to H(state) minus expected posterior entropy by Bayes' rule.
  return Math.max(0, entropy([expectedCorrect, 1 - expectedCorrect]) -
    sum(prior.map((p, i) => p * entropy([likelihood[i], 1 - likelihood[i]]))));
}

export function selectQuestion(questions, profiles, difficultyWindow) {
  let best;
  for (const question of questions) {
    const { belief = defaultPrior, ability = 0 } = profiles.get(question.skill) ?? {};
    if (difficultyWindow && Math.abs(question.difficulty - ability - difficultyWindow.offset) > difficultyWindow.radius) continue;
    const likelihood = emissions(ability, question.difficulty, question.guess, question.slip);
    const gain = informationGain(belief, likelihood);
    if (!best || gain > best.gain || (gain === best.gain && ((question.priority ?? 0) > (best.question.priority ?? 0) || ((question.priority ?? 0) === (best.question.priority ?? 0) && question.id < best.question.id)))) {
      best = { question, gain, likelihood };
    }
  }
  return best;
}

// Calibrate a personal Rasch ability intercept with an L2 prior. Keep the default
// until both outcomes are represented in enough scored opportunities.
export function fitAbility(rows, minimum = 40, penalty = 4) {
  if (rows.length < minimum || !rows.some(row => row.correct) || !rows.some(row => !row.correct)) return 0;
  let low = -4;
  let high = 4;
  for (let step = 0; step < 24; step++) {
    const ability = (low + high) / 2;
    const gradient = sum(rows.map(row => Number(row.correct) - sigmoid(ability - row.difficulty))) - penalty * ability;
    if (gradient > 0) low = ability;
    else high = ability;
  }
  return (low + high) / 2;
}

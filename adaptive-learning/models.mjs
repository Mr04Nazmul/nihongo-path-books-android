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
  // With an absorbing mastered state, this marginal equals the two-state
  // BKT posterior plus the transition mass from the unmastered states.
  return { belief, mastery: belief[3] };
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

export function selectQuestion(questions, profiles, difficultyWindow, explorationMargin = 0) {
  let peak = -Infinity;
  const scored = [];
  for (const question of questions) {
    const { belief = defaultPrior, ability = 0 } = profiles.get(question.skill) ?? {};
    if (difficultyWindow && Math.abs(question.difficulty - ability - difficultyWindow.offset) > difficultyWindow.radius) continue;
    const likelihood = emissions(ability, question.difficulty, question.guess, question.slip);
    const gain = informationGain(belief, likelihood);
    peak = Math.max(peak, gain);
    scored.push({ question, gain, likelihood });
  }
  let best;
  for (const candidate of scored) {
    if (candidate.gain < peak * (1 - explorationMargin)) continue;
    const priority = candidate.question.priority ?? 0;
    const current = best?.question.priority ?? 0;
    if (!best || priority > current ||
        (priority === current && (candidate.gain > best.gain ||
          (candidate.gain === best.gain && candidate.question.id < best.question.id)))) best = candidate;
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

// Approve a personal parameter only if it improves chronological holdout
// log loss. This gate is separate from fitting and stops the latest responses
// from being used both to estimate and to validate the candidate.
export function validateAbility(rows) {
  if (rows.length < 60) return { ability: 0, evaluated: false, accepted: false };
  const split = Math.floor(rows.length * 0.75);
  const train = rows.slice(0, split);
  const heldOut = rows.slice(split);
  if (!train.some(r => r.correct) || !train.some(r => !r.correct)
    || !heldOut.some(r => r.correct) || !heldOut.some(r => !r.correct)) {
    return { ability: 0, evaluated: false, accepted: false };
  }
  const candidate = fitAbility(train);
  const logLoss = ability => -sum(heldOut.map(row => {
    const p = sigmoid(ability - row.difficulty);
    return Math.log(row.correct ? p : 1 - p);
  })) / heldOut.length;
  const baselineLoss = logLoss(0);
  const candidateLoss = logLoss(candidate);
  const accepted = candidateLoss + 0.005 < baselineLoss;
  return { ability: accepted ? candidate : 0, evaluated: true, accepted, baselineLoss, candidateLoss };
}

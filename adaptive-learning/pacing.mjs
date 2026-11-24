export function updateDifficulty(previous, correct, seconds, settings) {
  const { target, kp, ki, kd, smoothing, limit, maxStep } = settings;
  if (!(seconds > 0)) throw new RangeError('Elapsed time must be positive');
  const accuracy = previous.accuracy + smoothing * (Number(correct) - previous.accuracy);
  const error = accuracy - target;
  const derivative = previous.derivative +
    smoothing * ((error - previous.error) / seconds - previous.derivative);
  const proposedIntegral = previous.integral + error * seconds;
  const command = integral => kp * error + ki * integral + kd * derivative;
  const requested = command(proposedIntegral);
  const lower = Math.max(-limit, previous.output - maxStep);
  const upper = Math.min(limit, previous.output + maxStep);
  const integral = (requested > upper && error > 0) || (requested < lower && error < 0)
    ? previous.integral : proposedIntegral;
  return { accuracy, error, derivative, integral, output: Math.max(lower, Math.min(upper, command(integral))) };
}

// Fit an exponential univariate Hawkes process by maximizing event log
// likelihood. Timestamps and decay use hours from the observation start.
export function fitStudySessions(times, start, end, decay = 1 / 6) {
  if (!(end > start && decay > 0)) throw new RangeError('Invalid interval or decay');
  const events = [...new Set(times)].filter(t => t >= start && t <= end).sort((a, b) => a - b);
  if (events.length < 20) return null;
  const offsets = events.map(time => (time - start) / 3600000);
  const duration = (end - start) / 3600000;
  let previous = 0;
  let trace = 0;
  let integratedTrace = 0;
  const history = offsets.map((time, i) => {
    trace = (trace + Number(i > 0)) * Math.exp(-decay * (time - previous));
    previous = time;
    integratedTrace += 1 - Math.exp(-decay * (duration - time));
    return trace;
  });
  const logLikelihood = (baseline, branching) =>
    history.reduce((total, value) => total + Math.log(baseline + branching * decay * value), 0) -
    baseline * duration - branching * integratedTrace;
  let baseline = events.length / duration;
  let branching = 0;
  let rateStep = baseline / 2;
  let branchStep = 0.25;
  let best = logLikelihood(baseline, branching);
  for (let round = 0; round < 24; round++) {
    for (const [rateDelta, branchDelta] of [[rateStep, 0], [-rateStep, 0], [0, branchStep], [0, -branchStep]]) {
      const rate = Math.max(1e-8, baseline + rateDelta);
      const ratio = Math.max(0, Math.min(0.95, branching + branchDelta));
      const likelihood = logLikelihood(rate, ratio);
      if (likelihood > best) {
        best = likelihood;
        baseline = rate;
        branching = ratio;
      }
    }
    rateStep *= 0.75;
    branchStep *= 0.75;
  }
  if (branching < 0.001) return null;
  return { baseline, branching, decay, at: events.at(-1), excitation: trace + 1 };
}

export function chooseReminder(model, slots, defaultSlot, { permitted, alreadyScheduled, asOf }) {
  if (!permitted || alreadyScheduled) return null;
  const available = slots.filter(slot => !slot.quiet && slot.at >= asOf);
  if (!model) return available.find(slot => slot.at === defaultSlot)?.at ?? null;
  return available.filter(slot => slot.at >= model.at).reduce((best, slot) => {
    const hours = (slot.at - model.at) / 3600000;
    const intensity = model.baseline + model.branching * model.decay * model.excitation * Math.exp(-model.decay * hours);
    return !best || intensity > best.intensity ? { at: slot.at, intensity } : best;
  }, null)?.at ?? null;
}

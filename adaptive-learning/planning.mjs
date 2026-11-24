// All benefits use dimensionless, comparable gains. Durations and maximum load
// are hard constraints. The caller supplies already-authorized, ready tasks.
export function optimizePlan(tasks, seconds, maxLoad, weights) {
  const score = task => weights.retention * task.retention +
    weights.mastery * task.mastery + weights.exam * task.exam -
    weights.time * task.seconds / Math.max(1, seconds) -
    weights.load * task.load / Math.max(1, maxLoad);

  const loads = tasks.every(task => Number.isInteger(task.load)) && Number.isInteger(maxLoad) &&
    maxLoad >= 0 && maxLoad <= 4096 ? new Float64Array(maxLoad + 2) : null;
  let frontier = [{ seconds: 0, load: 0, score: 0, task: null, previous: null }];
  for (const task of tasks) {
    const benefit = score(task);
    if (task.seconds <= 0 || task.load < 0 || benefit <= 0) continue;
    const candidates = frontier.slice();
    for (const plan of frontier) {
      const elapsed = plan.seconds + task.seconds;
      const load = plan.load + task.load;
      if (elapsed <= seconds && load <= maxLoad) {
        candidates.push({ seconds: elapsed, load, score: plan.score + benefit, task, previous: plan });
      }
    }
    candidates.sort((left, right) =>
      left.seconds - right.seconds || left.load - right.load || right.score - left.score);
    frontier = [];
    loads?.fill(-Infinity);
    for (const plan of candidates) {
      if (!loads) {
        if (!frontier.some(other => other.load <= plan.load && other.score >= plan.score)) frontier.push(plan);
        continue;
      }
      // Prefix maximum over load for the already processed time budgets.
      let best = -Infinity;
      for (let index = plan.load + 1; index > 0; index -= index & -index) best = Math.max(best, loads[index]);
      if (best >= plan.score) continue;
      for (let index = plan.load + 1; index < loads.length; index += index & -index) {
        loads[index] = Math.max(loads[index], plan.score);
      }
      frontier.push(plan);
    }
  }
  let plan = frontier.reduce((best, entry) => entry.score > best.score ? entry : best);
  const selection = [];
  while (plan.task) {
    selection.push(plan.task);
    plan = plan.previous;
  }
  return selection.reverse();
}

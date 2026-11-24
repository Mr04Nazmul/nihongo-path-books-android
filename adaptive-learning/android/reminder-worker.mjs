import { chooseReminder, fitStudySessions } from '../pacing.mjs';

export function calculateReaderReminder(sessions, now) {
  const start = now - 90 * 86400000;
  const history = [...new Set(sessions)].filter(at => Number.isFinite(at) && at >= start && at <= now);
  const model = fitStudySessions(history, start, now);
  if (!model) return 0;
  const hourly = Array(24).fill(0);
  for (const time of history) hourly[new Date(time).getHours()]++;
  const highest = Math.max(...hourly);
  const slots = [];
  for (let day = 0; day <= 1; day++) {
    for (let hour = 8; hour < 21; hour++) {
      if (hourly[hour] < Math.max(2, highest / 2)) continue;
      const candidate = new Date(now);
      candidate.setDate(candidate.getDate() + day);
      candidate.setHours(hour, 0, 0, 0);
      slots.push({ at: candidate.getTime(), quiet: false });
    }
  }
  return chooseReminder(model, slots, null,
    { permitted: true, alreadyScheduled: false, asOf: now + 3600000 }) || 0;
}

if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
  self.onmessage = ({ data }) => {
    try {
      self.postMessage(calculateReaderReminder(data.sessions, data.now));
    } catch (_) {
      self.postMessage(0);
    }
  };
}

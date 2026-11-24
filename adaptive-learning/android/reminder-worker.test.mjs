import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateReaderReminder } from './reminder-worker.mjs';

test('Hawkes worker filters invalid or repeated session data and only schedules daytime reminders', () => {
  const now = new Date(2026, 8, 20, 7).getTime();
  const sessions = Array.from({length: 12}, (_, i) => {
    const first = new Date(2026, 8, 19 - i, 12).getTime();
    return [first, first + 45 * 60000];
  }).flat();
  assert.equal(calculateReaderReminder([...sessions.slice(0, 19), sessions[0], NaN, now + 1], now), 0);
  const selected = calculateReaderReminder(sessions, now);
  assert.ok(selected >= now + 3600000);
  assert.ok(new Date(selected).getHours() >= 8 && new Date(selected).getHours() < 21);
});

import { performance } from 'node:perf_hooks';
import { buildProfile, dailyStudyPlan } from './session.mjs';
import { PrerequisiteGraph } from './graph.mjs';
import { Rating } from './memory.mjs';

const day = 86400000;
const parameters = { difficulty: 0, guess: 0.25, slip: 0.05 };
const tasks = Array.from({ length: 240 }, (_, i) => ({
  ...parameters, skill: 'skill-' + i, item: 'item-' + i, seconds: 20 + i % 21,
  load: 1 + i % 2, accessible: true, examAligned: i % 3 === 0,
}));
const graph = new PrerequisiteGraph(tasks.map(task => task.skill), []);
const events = Array.from({ length: 4800 }, (_, i) => {
  const task = tasks[i % tasks.length];
  const correct = (i * 13 + Math.floor(i / tasks.length)) % 7 !== 0;
  return { ...parameters, skill: task.skill, item: task.item, at: i * 60000,
    id: 'event-' + i, correct, rating: correct ? Rating.Good : Rating.Again };
});
const options = { at: 12 * day, seconds: 600, maxLoad: 20, masteryThreshold: 0.6,
  weights: { retention: 2, mastery: 2, exam: 1, time: 0.1, load: 0.1 } };
const replay = [];
const planning = [];
for (let i = 0; i < 6; i++) {
  const start = performance.now();
  const profile = buildProfile(events);
  const reprocessed = performance.now();
  dailyStudyPlan(tasks, profile, graph, options);
  if (i) {
    replay.push(reprocessed - start);
    planning.push(performance.now() - reprocessed);
  }
}
const median = values => values.sort((a, b) => a - b)[2].toFixed(1);
console.log(JSON.stringify({ node: process.version, events: events.length, tasks: tasks.length,
  measurements: replay.length, replayMedianMs: median(replay), planMedianMs: median(planning) }));

import { buildProfile, dailyStudyPlan } from '../session.mjs';
import { selectQuestion } from '../models.mjs';
import { PrerequisiteGraph } from '../graph.mjs';
import { updateDifficulty } from '../pacing.mjs';
import { compareWriting } from '../strokes.mjs';
import { sampleLearningPriority } from '../exploration.mjs';

const settings = { target: 0.75, kp: 0.7, ki: 0.002, kd: 0.1, smoothing: 0.2, limit: 0.4, maxStep: 0.05 };
const weights = { retention: 2, mastery: 2, exam: 1, time: 0.06, load: 0.04 };
const format = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' });

function button(text, action) {
  const node = document.createElement('button');
  node.type = 'button';
  node.textContent = text;
  node.onclick = action;
  return node;
}

function shuffle(values) {
  const result = values.slice();
  const random = new Uint32Array(1);
  for (let i = result.length - 1; i > 0; i--) {
    const limit = Math.floor(2 ** 32 / (i + 1)) * (i + 1);
    do crypto.getRandomValues(random); while (random[0] >= limit);
    const j = random[0] % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function coldPacing() {
  return { accuracy: settings.target, error: 0, derivative: 0, integral: 0, output: 0 };
}

function lessons(data, level, preview, word, meaning) {
  const prefix = level + ':' + (preview ? 'preview:' : 'full:');
  const rows = Object.keys(data).flatMap(kind => data[kind].flatMap(entry => {
    const prompt = String(word(entry) || '').trim();
    const answer = String(meaning(entry) || '').trim();
    if (!entry.id || !prompt || !answer) return [];
    const id = prefix + kind + ':' + entry.id;
    return [{ id, item: id, skill: id, kind, prompt, answer, guess: 0.25, slip: 0.05,
      difficulty: 0, accessible: true, examAligned: false, seconds: 25, load: 1 }];
  }));
  const ambiguous = new Map();
  for (const row of rows) {
    const key = row.kind + ':' + row.prompt;
    if (!ambiguous.has(key)) ambiguous.set(key, new Set());
    ambiguous.get(key).add(row.answer);
  }
  return rows.filter(row => ambiguous.get(row.kind + ':' + row.prompt).size === 1);
}

function mount(data, level, preview, word, meaning) {
  const native = window.StudyNative;
  if (!native || !native.adaptiveHistory) return;
  const rows = lessons(data, level, preview, word, meaning);
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.kind)) groups.set(row.kind, new Set());
    groups.get(row.kind).add(row.answer);
  }
  const items = rows.filter(row => groups.get(row.kind).size >= 4);
  if (!items.length) return;
  const kanji = new Map(items.filter(row => row.kind === 'kanji').map(row => [row.prompt, row.id]));
  // Character containment is an observed relationship. It supplies a
  // recommendation in progress, while hard prerequisites await curriculum review.
  const related = items.flatMap(row => row.kind !== 'vocab' ? [] :
    [...new Set(Array.from(row.prompt).map(char => kanji.get(char)).filter(Boolean))].map(id => [id, row.id]));
  const graph = new PrerequisiteGraph(items.map(row => row.id), related);
  const noHardPrerequisites = new PrerequisiteGraph(items.map(row => row.id), []);
  const panel = document.createElement('section');
  panel.className = 'adaptive-study';
  panel.setAttribute('aria-live', 'polite');
  const menu = document.createElement('div');
  menu.className = 'detail-actions';
  const output = document.createElement('div');
  panel.append(menu, output);
  document.querySelector('#tabs').insertAdjacentElement('afterend', panel);
  let used = new Set();
  let remaining = 300;
  let pacing = coldPacing();

  function history() {
    const value = native.adaptiveHistory();
    if (!value) throw new Error('এই মুহূর্তে অনুশীলনের তথ্য পাওয়া যাচ্ছে না।');
    return JSON.parse(value);
  }

  function show(text) {
    const paragraph = document.createElement('p');
    paragraph.textContent = text;
    output.appendChild(paragraph);
  }

  function next(mode) {
    output.textContent = '';
    let events;
    try { events = history(); }
    catch (error) { show(error.message); return; }
    const profile = buildProfile(events);
    const at = Date.now();
    const candidates = items.filter(row => !used.has(row.id));
    let chosen;
    if (mode === 'review') {
      chosen = candidates.filter(row => {
        const card = profile.cards.get(row.id);
        return card && card.due.getTime() <= at;
      }).sort((a, b) => profile.cards.get(a.id).due - profile.cards.get(b.id).due)[0];
    } else {
      if (remaining < 1) { show('আজকের এই অনুশীলন সেশন শেষ।'); return; }
      const evidence = new Map();
      for (const event of events) {
        const prior = evidence.get(event.item);
        if (!prior || prior.at < event.at) evidence.set(event.item, event);
      }
      const estimated = candidates.map(row => {
        const last = evidence.get(row.id);
        return last ? { ...row, seconds: Math.max(5, Math.ceil(last.seconds)) } : row;
      });
      const plan = dailyStudyPlan(estimated, profile, noHardPrerequisites, {
        at, seconds: remaining, maxLoad: 16, weights, masteryThreshold: 0.55,
      });
      const spacedEvidence = new Map();
      const lastByItem = new Map();
      for (const event of events.slice().reverse()) {
        const prior = lastByItem.get(event.item);
        if (prior && event.at - prior.at >= 86400000) {
          const counts = spacedEvidence.get(event.item) || { successes: 0, failures: 0 };
          counts[event.correct ? 'successes' : 'failures']++;
          spacedEvidence.set(event.item, counts);
        }
        lastByItem.set(event.item, event);
      }
      const eligible = plan.map(row => ({
        ...row, priority: spacedEvidence.has(row.id) ? sampleLearningPriority(spacedEvidence.get(row.id)) : 0.5,
      }));
      chosen = (selectQuestion(eligible, profile.skills, { offset: pacing.output, radius: 0.8 }) ||
        selectQuestion(eligible, profile.skills))?.question;
    }
    if (!chosen) { show(mode === 'review' ? 'এখন কোনো রিভিউ বাকি নেই।' : 'এই সেশনে আর কোনো পাঠ বাকি নেই।'); return; }
    show(chosen.prompt);
    const distractors = shuffle([...groups.get(chosen.kind)].filter(value => value !== chosen.answer)).slice(0, 3);
    const started = performance.now();
    const options = shuffle([chosen.answer, ...distractors]).map(value => button(value, () => {
      for (const option of options) option.disabled = true;
      const correct = value === chosen.answer;
      const seconds = Math.max(1, Math.round((performance.now() - started) / 1000));
      if (!native.recordAdaptiveAnswer(JSON.stringify({ item: chosen.id, correct, seconds }))) {
        show('এই উত্তরটি সেভ করা যায়নি।');
        return;
      }
      used.add(chosen.id);
      remaining -= seconds;
      pacing = updateDifficulty(pacing, correct, Math.min(120, seconds), settings);
      show(correct ? 'সঠিক' : 'সঠিক উত্তর · ' + chosen.answer);
      output.appendChild(button('পরেরটি', () => next(mode)));
    }));
    output.append(...options);
  }

  menu.append(
    button('Smart Review', () => { used = new Set(); next('review'); }),
    button('Daily Smart Study', () => { used = new Set(); remaining = 300; next('daily'); }),
    button('My Progress', () => {
      output.textContent = '';
      try {
        const events = history();
        const state = buildProfile(events);
        const at = Date.now();
        const due = [...state.cards.values()].filter(card => card.due.getTime() <= at).length;
        show('অনুশীলন ' + events.length + ' · রিভিউ বাকি ' + due);
        const future = [...state.cards.values()].map(card => card.due.getTime()).filter(time => time > at);
        if (future.length) show('পরের রিভিউ · ' + format.format(Math.min(...future)));
        const mastery = new Map([...state.skills].map(([id, skill]) => [id, skill.mastery]));
        const available = new Set(items.map(row => row.id));
        const weak = items.find(row => row.kind === 'vocab' && mastery.has(row.id) && mastery.get(row.id) < 0.55);
        if (weak) {
          const suggestion = graph.weakPrerequisites(weak.id, mastery, available, 0.55)[0];
          if (suggestion) show('সহায়ক কানজি · ' + items.find(row => row.id === suggestion).prompt);
        }
      } catch (error) { show(error.message); }
    }),
  );
}

window.AdaptiveReader = { mount, compareWriting };

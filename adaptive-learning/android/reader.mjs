import { mockStudyPriority, mountMockExam } from './mock-exam.mjs';
import "./reader-compat.mjs";
import { createProfileCache, dailyStudyPlan } from '../session.mjs';
import { selectQuestion } from '../models.mjs';
import { curriculumGraphs, earlierLevelLesson } from './curriculum-graph.mjs';
import { chooseReminder, fitStudySessions, updateDifficulty } from '../pacing.mjs';
import { assessWriting, compareWriting } from '../strokes.mjs';
import { strategyPriorities } from '../exploration.mjs';

const settings = { target: 0.75, kp: 0.7, ki: 0.002, kd: 0.1, smoothing: 0.2, limit: 0.4, maxStep: 0.05 };
const weights = { retention: 2, mastery: 2, exam: 1, time: 0.06, load: 0.04 };
const kana = /^[ぁ-ゖァ-ヺー]+$/u;
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
    const reading = kind === 'vocab' ? String(entry.reading || '').normalize('NFKC').trim() : '';
    return [{ id, item: id, skill: id, kind, prompt, answer, entry,
      reading: kana.test(reading) && /[一-龯々]/u.test(prompt) ? reading : '',
      guess: 0.25, slip: 0.05, difficulty: 0, accessible: true, examAligned: false, seconds: 25, load: 1 }];
  }));
  const ambiguous = new Map();
  for (const row of rows) {
    const key = row.kind + ':' + row.prompt;
    if (!ambiguous.has(key)) ambiguous.set(key, new Set());
    ambiguous.get(key).add(row.answer + '\u0000' + row.reading);
  }
  return rows.filter(row => ambiguous.get(row.kind + ':' + row.prompt).size === 1);
}

function trainReminder(native) {
  if (!native.adaptiveStudySessions) return;
  try {
    const now = Date.now();
    const sessions = JSON.parse(native.adaptiveStudySessions());
    if (!sessions.length) return;
    const model = fitStudySessions(sessions, now - 90 * 86400000, now);
    if (!model) { native.adaptiveReminder(0); return; }
    const hourly = Array(24).fill(0);
    for (const time of sessions) hourly[new Date(time).getHours()]++;
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
    const selected = chooseReminder(model, slots, null, { permitted: true, alreadyScheduled: false, asOf: now + 3600000 });
    native.adaptiveReminder(selected || 0);
  } catch (_) {
    // An unavailable profile leaves the existing daily reminder in charge.
  }
}

export function mount(data, level, preview, word, meaning) {
  const native = window.StudyNative;
  if (!native || !native.adaptiveHistory) return;
  const rows = lessons(data, level, preview, word, meaning);
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.kind)) groups.set(row.kind, { meanings: new Set(), words: new Set(), byMeaning: new Map() });
    const group = groups.get(row.kind);
    group.meanings.add(row.answer);
    group.words.add(row.prompt);
    if (!group.byMeaning.has(row.answer)) group.byMeaning.set(row.answer, new Set());
    group.byMeaning.get(row.answer).add(row.prompt);
  }
  const readings = new Set(rows.map(row => row.reading).filter(Boolean));
  const items = rows.filter(row => groups.get(row.kind).meanings.size >= 4)
    .map(row => ({ ...row, examAligned: !!row.reading && readings.size >= 4 }));
  if (!items.length) return;
  const { support: graph, required: prerequisites } = curriculumGraphs(items, level, preview);
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
  const profileFor = createProfileCache();

  function history() {
    const value = native.adaptiveHistory();
    if (!value) throw new Error('এই মুহূর্তে অনুশীলনের তথ্য পাওয়া যাচ্ছে না।');
    const events = JSON.parse(value);
    if (!Array.isArray(events)) throw new Error('অনুশীলনের তথ্য পড়া যায়নি।');
    return events;
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
    let profile;
    try { profile = profileFor(events); }
    catch (error) { show('অনুশীলনের হিসাব এই মুহূর্তে পাওয়া যাচ্ছে না।'); return; }
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
      const examPriority = mockStudyPriority(native);
      const estimated = candidates.map(row => {
        const last = evidence.get(row.id);
        return { ...row, seconds: last ? Math.max(5, Math.ceil(last.seconds)) : row.seconds,
          mockExamPriority: examPriority[row.kind] ?? 0 };
      });
      const mastery = new Map([...profile.skills].map(([id, state]) => [id, state.mastery]));
      const accessible = new Set(prerequisites.order);
      const plan = !profile.readiness.entropy
        ? estimated.filter(row => row.seconds <= remaining &&
          !prerequisites.weakPrerequisites(row.skill, mastery, accessible, 0.55).length)
        : dailyStudyPlan(estimated, profile, prerequisites, {
        at, seconds: remaining, maxLoad: 16, weights, masteryThreshold: 0.55,
      });
      const priorities = profile.readiness.phase === 'Cold Start' ? new Map() : strategyPriorities(events, Math.random, 12);
      const eligible = plan.flatMap(row => {
        const forward = { ...row, priority: priorities.get(row.mock ? 'mock' : 'meaning') };
        const variants = [forward];
        if (row.mock) return variants;
        const group = groups.get(row.kind);
        if (row.examAligned) variants.push({ ...forward, id: row.id + ':reading', readingQuestion: true, difficulty: 0.2, priority: priorities.get('reading') });
        if (row.kind !== 'grammar' && group.words.size >= 4 && group.byMeaning.get(row.answer).size === 1) {
          variants.push({ ...forward, id: row.id + ':reverse', reverse: true, difficulty: 0.35, priority: priorities.get('reverse') });
        }
        return variants;
      });
      const questionProfiles = new Map(eligible.map(question => [question.skill, profile.skillProfile(question.skill)]));
      chosen = !profile.readiness.entropy ? plan[0] : (selectQuestion(eligible, questionProfiles, { offset: pacing.output, radius: 0.2 }, 0.05) ||
        selectQuestion(eligible.filter(question => !question.reverse), questionProfiles))?.question;
    }
    if (!chosen) { show(mode === 'review' ? 'এখন কোনো রিভিউ বাকি নেই।' : 'এই সেশনে আর কোনো পাঠ বাকি নেই।'); return; }
    const group = groups.get(chosen.kind);
    const correctAnswer = chosen.readingQuestion ? chosen.reading : chosen.reverse ? chosen.prompt : chosen.answer;
    const possible = chosen.mock ? chosen.choices : chosen.readingQuestion ? readings : chosen.reverse ? group.words : group.meanings;
    if (chosen.mock && chosen.instruction) show(chosen.instruction);
    if (chosen.mock && chosen.passage) show(chosen.passage);
    show(chosen.readingQuestion ? '読み方 · ' + chosen.prompt : chosen.reverse ? chosen.answer : chosen.prompt);
    const distractors = shuffle([...possible].filter(value => value !== correctAnswer)).slice(0, 3);
    const started = performance.now();
    const options = shuffle([correctAnswer, ...distractors]).map(value => button(value, () => {
      for (const option of options) option.disabled = true;
      const correct = value === correctAnswer;
      const seconds = Math.max(1, Math.round((performance.now() - started) / 1000));
      if (!native.recordAdaptiveAnswer(JSON.stringify({ item: chosen.item, correct, seconds, variant: chosen.mock ? "mock" : chosen.readingQuestion ? "reading" : chosen.reverse ? "reverse" : "meaning" }))) {
        show('এই উত্তরটি সেভ করা যায়নি।');
        return;
      }
      if (!used.size) window.setTimeout(() => trainReminder(native), 0);
      used.add(chosen.item);
      remaining -= seconds;
      if (profile.readiness.pacing && !chosen.mock) {
        pacing = updateDifficulty(pacing, correct, Math.min(120, seconds), settings);
      }
      show(correct ? 'সঠিক' : 'সঠিক উত্তর · ' + correctAnswer);
      if (chosen.mock && chosen.explanation) show(chosen.explanation);
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
        const state = profileFor(events);
        const at = Date.now();
        const due = [...state.cards.values()].filter(card => card.due.getTime() <= at).length;
        show('অনুশীলন ' + events.length + ' · রিভিউ বাকি ' + due);
        const future = [...state.cards.values()].map(card => card.due.getTime()).filter(time => time > at);
        if (future.length) show('পরের রিভিউ · ' + format.format(Math.min(...future)));
        const mastery = new Map([...state.skills].map(([id, skill]) => [id, skill.mastery]));
        const available = new Set(items.map(row => row.id));
        const weakItems = items.filter(row => row.kind !== 'kanji' && mastery.has(row.id) && mastery.get(row.id) < 0.55)
          .sort((a, b) => mastery.get(a.id) - mastery.get(b.id));
        for (const weak of weakItems) {
          const suggestion = graph.weakPrerequisites(weak.id, mastery, available, 0.55)[0];
          if (suggestion) {
            show('সহায়ক পাঠ · ' + items.find(row => row.id === suggestion).prompt);
            break;
          }
          const earlier = earlierLevelLesson(level, weak.id);
          if (earlier && native.selectStudyLevel) {
            output.appendChild(button('সহায়ক পাঠ · ' + earlier.level + ' ' + earlier.label,
              () => native.selectStudyLevel(earlier.level, earlier.section)));
            break;
          }
        }
      } catch (error) { show(error.message); }
    }),
  );
  if (!preview) mountMockExam({ menu, level, native, button });
}

function mountFromAssets(data, level, preview, word, meaning) {
  mount(data, level, preview, word, meaning);
}

window.AdaptiveReader = { mount, mountFromAssets, compareWriting, assessWriting };

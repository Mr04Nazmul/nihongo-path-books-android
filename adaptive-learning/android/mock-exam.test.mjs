import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { mountMockExam, mockStudyPriority, validateMockPaper } from './mock-exam.mjs';

const paper = {
  id: 'n5-practice-1', title: 'Test fixture', level: 'N5', kind: 'JLPT', excluded: 0,
  questions: [
    { id: '1', category: 'vocabulary', prompt: '<u>水</u>', choices: ['みず', 'みち'], answer: 0, explanation: 'Water' },
    { id: '2', category: 'grammar', prompt: '猫（　）います。', choices: ['が', 'も'], answer: 0 },
    { id: '3', category: 'reading', prompt: '何時？', passage: '九時です。', choices: ['九時', '八時'], answer: 0 },
  ],
};
const entry = { id: paper.id, title: paper.title, count: 3 };
test('mock exam opens only on demand, supports navigation and stores its result separately', async () => {
  const { document } = parseHTML('<html><head></head><body><main><div id="menu"></div></main></body></html>');
  const calls = [];
  const results = [];
  const native = { recordMockResult: raw => (results.push(JSON.parse(raw)), true), recordAdaptiveAnswer: assert.fail };
  const button = (label, action) => {
    const node = document.createElement('button');
    node.textContent = label;
    node.onclick = action;
    return node;
  };
  const originalFetch = globalThis.fetch;
  globalThis.document = document;
  globalThis.fetch = async url => {
    calls.push(url);
    return { ok: true, json: async () => url.endsWith('catalog.json') ? [entry] : paper };
  };
  const press = async label => {
    const node = [...document.querySelectorAll('button')].find(b => b.textContent === label);
    assert.ok(node, label);
    await node.onclick();
  };
  try {
    mountMockExam({ level: 'N5', native, menu: document.querySelector('#menu'), button });
    assert.deepEqual(calls, []);
    await press('Mock Test');
    const dialog = document.querySelector('dialog.mock-screen');
    assert.equal(dialog.parentElement, document.body);
    assert.equal(dialog.hasAttribute('open'), true);
    await dialog.querySelector('.mock-paper-card').onclick();
    assert.match(dialog.textContent, /পরীক্ষার বিবরণ/);
    await press('▶ পরীক্ষা শুরু');
    assert.match(document.querySelector('.mock-screen-content').textContent, /Vocabulary/);
    await press('1みず');
    await press('পরের প্রশ্ন →');
    await press('← আগের প্রশ্ন');
    assert.equal(document.querySelector('.mock-choice[aria-pressed="true"]').textContent, '1みず');
    await press('পরের প্রশ্ন →');
    await press('2も');
    await press('পরের প্রশ্ন →');
    assert.match(document.querySelector('.mock-screen-content').textContent, /九時です/);
    await press('ফল দেখুন');
    assert.deepEqual(results[0].sections, {
      vocabulary: { correct: 1, total: 1, answered: 1 },
      grammar: { correct: 0, total: 1, answered: 1 },
      reading: { correct: 0, total: 1, answered: 0 },
    });
    await press('উত্তর ও ব্যাখ্যা দেখুন');
    assert.match(document.querySelector('.mock-screen-content').textContent, /Water/);
    await dialog.querySelector('header button').onclick();
    assert.equal(results.length, 1);
    await dialog.querySelector('header button').onclick();
    await dialog.querySelector('header button').onclick();
    assert.equal(mockStudyPriority({lastMockResult: () => JSON.stringify(results[0])}).grammar, 0.08);
  } finally {
    globalThis.fetch = originalFetch;
    delete globalThis.document;
  }
});
test('paper validation rejects wrong level, missing questions and invalid answer indices', () => {
  assert.equal(validateMockPaper(paper, 'N5', entry), paper);
  assert.throws(() => validateMockPaper(paper, 'N4', entry));
  assert.throws(() => validateMockPaper(paper, 'N5', { ...entry, count: 10 }));
  assert.throws(() => validateMockPaper({ ...paper, questions: paper.questions.map(q => ({ ...q, answer: 4 })) }, 'N5', entry));
});

test('written test deadline saves exactly once and native back stays in the exam flow', async t => {
  const { window, document } = parseHTML('<html><head></head><body><main><div id="menu"></div></main></body></html>');
  window.readerBack = () => false;
  let now = 1_000_000;
  let tick;
  const results = [];
  t.mock.method(Date, 'now', () => now);
  t.mock.method(globalThis, 'setInterval', fn => { tick = fn; return 1; });
  t.mock.method(globalThis, 'clearInterval', () => {});
  t.mock.method(globalThis, 'fetch', async url => ({
    ok: true, json: async () => url.endsWith('catalog.json') ? [entry] : paper,
  }));
  const button = (label, action) => {
    const node = document.createElement('button');
    node.textContent = label;
    node.onclick = action;
    return node;
  };
  globalThis.document = document;
  try {
    mountMockExam({ menu: document.querySelector('#menu'), level: 'N5',
      native: { recordMockResult: raw => (results.push(JSON.parse(raw)), true) }, button });
    assert.equal(window.readerBack(), false);
    await document.querySelector('#menu button').onclick();
    await document.querySelector('.mock-paper-card').onclick();
    document.querySelector('.mock-primary').onclick();
    const flag = document.querySelector('button[aria-label="প্রশ্ন চিহ্নিত করুন"]');
    flag.onclick();
    assert.equal(flag.getAttribute('aria-pressed'), 'true');
    document.querySelector('.mock-choice').onclick();
    now += 60 * 60000;
    tick();
    tick();
    assert.equal(results.length, 1);
    assert.equal(results[0].sections.vocabulary.correct, 1);
    assert.equal(window.readerBack(), true);
    assert.match(document.querySelector('.mock-screen h2').textContent, /JLPT Mock Test/);
    assert.equal(window.readerBack(), true);
    assert.equal(document.querySelector('.mock-screen').hasAttribute('open'), false);
  } finally {
    delete globalThis.document;
  }
});

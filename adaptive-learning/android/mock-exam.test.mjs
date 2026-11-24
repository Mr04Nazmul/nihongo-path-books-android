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
  const { document } = parseHTML('<main><div id="menu"></div></main>');
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
    await press('Test fixture · 3 প্রশ্ন');
    assert.match(document.querySelector('section').textContent, /Vocabulary/);
    await press('みず');
    await press('পরের প্রশ্ন');
    await press('আগের প্রশ্ন');
    assert.equal(document.querySelector('button[aria-pressed="true"]').textContent, 'みず');
    await press('পরের প্রশ্ন');
    await press('も');
    await press('পরের প্রশ্ন');
    assert.match(document.querySelector('section').textContent, /九時です/);
    await press('ফল দেখুন');
    assert.deepEqual(results[0].sections, {
      vocabulary: { correct: 1, total: 1, answered: 1 },
      grammar: { correct: 0, total: 1, answered: 1 },
      reading: { correct: 0, total: 1, answered: 0 },
    });
    await press('উত্তর ও ব্যাখ্যা দেখুন');
    assert.match(document.querySelector('section').textContent, /Water/);
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

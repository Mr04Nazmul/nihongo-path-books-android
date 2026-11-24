import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';

test('Android reader starts a cold study session and records the selected answer', async () => {
  const { window } = parseHTML('<body><nav id="tabs"></nav></body>');
  const submitted = [];
  window.StudyNative = {
    adaptiveHistory: () => '[]',
    recordAdaptiveAnswer: raw => { submitted.push(JSON.parse(raw)); return true; },
  };
  globalThis.window = window;
  globalThis.document = window.document;
  try {
    await import('./reader.mjs');
    const vocab = [
      { id: '1', word: '猫', meaning: 'বিড়াল' },
      { id: '2', word: '犬', meaning: 'কুকুর' },
      { id: '3', word: '鳥', meaning: 'পাখি' },
      { id: '4', word: '魚', meaning: 'মাছ' },
    ];
    window.AdaptiveReader.mount({ vocab }, 'N5', true, row => row.word, row => row.meaning);
    const controls = () => [...window.document.querySelectorAll('button')];
    controls().find(button => button.textContent === 'Daily Smart Study').click();
    const prompt = window.document.querySelector('.adaptive-study p').textContent;
    const correct = vocab.find(row => row.word === prompt);
    assert.ok(correct);
    controls().find(button => button.textContent === correct.meaning).click();
    assert.equal(submitted.length, 1);
    assert.equal(submitted[0].item, 'N5:preview:vocab:' + correct.id);
    assert.equal(submitted[0].correct, true);
    assert.equal(controls().filter(button => button.disabled).length, 4);
    assert.ok(controls().some(button => button.textContent === 'পরেরটি'));
  } finally {
    delete globalThis.window;
    delete globalThis.document;
  }
});

test('reviewed Sakura passage keeps its choices and records the real answer', async () => {
  const { window } = parseHTML('<body><nav id="tabs"></nav></body>');
  const submitted = [];
  window.StudyNative = {
    adaptiveHistory: () => '[]',
    recordAdaptiveAnswer: raw => { submitted.push(JSON.parse(raw)); return true; },
  };
  const reader = (await import('./reader.mjs'));
  globalThis.window = window;
  globalThis.document = window.document;
  try {
    reader.mount({}, 'N5', true, row => row.word, row => row.meaning, {
      level: 'N5',
      questions: [{ id: 'fixture', kind: 'grammar', prompt: '何時ですか。', instruction: '文を読んでください。',
        passage: '学校は九時に始まります。', choices: ['八時','九時','十時','十一時'], answer: 1 }],
    });
    const controls = () => [...document.querySelectorAll('button')];
    controls().find(button => button.textContent === 'Daily Smart Study').click();
    assert.match(document.querySelector('.adaptive-study').textContent, /学校は九時に始まります/);
    controls().find(button => button.textContent === '九時').click();
    assert.equal(submitted[0]?.item, 'N5:preview:grammar:sakura-fixture');
    assert.equal(submitted[0]?.correct, true);
    assert.equal(submitted[0]?.variant, 'mock');
  } finally {
    delete globalThis.window;
    delete globalThis.document;
  }
});

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

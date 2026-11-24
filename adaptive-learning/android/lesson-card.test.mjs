import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { renderLessonCard } from './lesson-card.mjs';

test('lesson card paginates independent level and subject entries and reports real learned progress', () => {
  const { document } = parseHTML('<div id="lesson"></div>');
  globalThis.document = document;
  const root = document.querySelector('#lesson');
  const rows = Array.from({length: 12}, (_, i) => ({id: i + 1}));
  const opened = [];
  const learned = new Set([1, 5, 6]);
  let visible;
  let level = 'N3';
  let kind = 'vocab';
  const refresh = () => {
    visible = renderLessonCard({ root, rows, level, kind, preview: false,
      learned: row => learned.has(row.id), open: row => opened.push(row.id), refresh });
  };
  const findButton = name => [...root.querySelectorAll('button')].find(b => b.textContent === name);
  try {
    refresh();
    assert.deepEqual(visible.map(row => row.id), [1, 2, 3, 4, 5]);
    assert.match(root.querySelector('.lesson-card-count').textContent, /2 \/ 5/);
    assert.equal(findButton('← আগের').disabled, true);
    findButton('পরের →').onclick();
    assert.deepEqual(visible.map(row => row.id), [6, 7, 8, 9, 10]);
    assert.match(root.querySelector('.lesson-card-count').textContent, /1 \/ 5/);
    findButton('▶ পাঠ শুরু').onclick();
    findButton('5').onclick();
    assert.deepEqual(opened, [6, 10]);
    findButton('পরের →').onclick();
    assert.equal(findButton('পরের →').disabled, true);
    assert.deepEqual(visible.map(row => row.id), [11, 12]);
    kind = 'grammar';
    refresh();
    assert.equal(visible[0].id, 1);
    kind = 'vocab';
    level = 'N2';
    refresh();
    assert.equal(visible[0].id, 1);
  } finally {
    delete globalThis.document;
  }
});

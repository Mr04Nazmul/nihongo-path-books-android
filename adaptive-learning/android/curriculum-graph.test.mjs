import test from 'node:test';
import assert from 'node:assert/strict';
import { curriculumGraphs } from './curriculum-graph.mjs';

test('adaptive relations connect the course subjects with no synthetic hard dependency', () => {
  const rows = [
    { id: 'k', prompt: '学', kind: 'kanji' },
    { id: 'v', prompt: '学生', kind: 'vocab' },
    { id: 'g', prompt: 'です', kind: 'grammar', entry: { examples: [{ word: '学生' }] } },
  ];
  const { support, required } = curriculumGraphs(rows, 'N5', true);
  assert.deepEqual(support.weakPrerequisites('g', new Map(), new Set(['g','v','k']), 0.5), ['k', 'v']);
  assert.deepEqual(required.weakPrerequisites('g', new Map(), new Set(['g','v','k']), 0.5), []);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { curriculumGraphs, earlierLevelLesson } from './curriculum-graph.mjs';

test('cross-level grammar suggestions require the matching lesson and access scope', () => {
  const cases = [
    ['N1', '005', 'N5', 'N1 の N2'],
    ['N2', '0005', 'N4', 'Plain form'],
    ['N3', '0004', 'N4', 'Plain form'],
    ['N4', '0001', 'N5', 'V辞書形'],
  ];
  for (const [level, number, earlier, label] of cases) {
    const lesson = 'own-' + level.toLowerCase() + '-grammar-' + number;
    for (const scope of ['full', 'preview']) {
      assert.deepEqual(earlierLevelLesson(level, level + ':' + scope + ':grammar:' + lesson),
        { level: earlier, label, section: 'grammar' });
    }
    assert.equal(earlierLevelLesson(level, 'N5:full:grammar:' + lesson), null);
    assert.equal(earlierLevelLesson(level, level + ':full:vocab:' + lesson), null);
  }
  assert.equal(earlierLevelLesson('N5', 'N5:full:grammar:own-n5-grammar-0001'), null);
});

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

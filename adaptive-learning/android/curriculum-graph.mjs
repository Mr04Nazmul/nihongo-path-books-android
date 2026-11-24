import { PrerequisiteGraph } from '../graph.mjs';

const curated = {
  N3: [['own-n3-grammar-0001', 'own-n3-grammar-0002']],
  N4: [
    ['own-n4-grammar-0001', 'own-n4-grammar-0002'],
    ['own-n4-grammar-0002', 'own-n4-grammar-0003'],
  ],
};

const normalized = value => String(value || '').normalize('NFKC').trim();

function uniqueIndex(rows) {
  const index = new Map();
  for (const row of rows) {
    const key = normalized(row.prompt);
    index.set(key, index.has(key) ? null : row.id);
  }
  return index;
}

// Relationships are restricted to the lesson payload already authorized in
// the native reader. Only reviewed grammar edges are enforced by the planner.
export function curriculumGraphs(items, level, preview) {
  const ids = new Set(items.map(row => row.id));
  const kanji = uniqueIndex(items.filter(row => row.kind === 'kanji'));
  const vocab = uniqueIndex(items.filter(row => row.kind === 'vocab'));
  const associations = [];
  for (const row of items) {
    if (row.kind === 'vocab') {
      const characters = new Set([...normalized(row.prompt)].map(character => kanji.get(character)));
      for (const parent of characters) if (parent) associations.push([parent, row.id]);
    }
    if (row.kind === 'grammar') {
      // Match complete curated example words. Substrings in example sentences
      // can be incidental and must not become hard prerequisites.
      for (const example of row.entry?.examples ?? []) {
        const parent = vocab.get(normalized(example.word));
        if (parent) associations.push([parent, row.id]);
      }
    }
  }
  const prefix = level + ':' + (preview ? 'preview:' : 'full:') + 'grammar:';
  const hard = (curated[level] ?? []).map(edge => edge.map(id => prefix + id))
    .filter(edge => edge.every(id => ids.has(id)));
  return {
    support: new PrerequisiteGraph([...ids], [...associations, ...hard]),
    required: new PrerequisiteGraph([...ids], hard),
  };
}

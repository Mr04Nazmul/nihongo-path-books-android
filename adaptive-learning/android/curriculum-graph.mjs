import { PrerequisiteGraph } from '../graph.mjs';

const curated = {
  N5: [82, 83, 84, 98, 100, 101].map(id => ['own-n5-grammar-0081', 'own-n5-grammar-' + String(id).padStart(4, '0')]),
  N3: [['own-n3-grammar-0001', 'own-n3-grammar-0002']],
  N4: [
    ['own-n4-grammar-0001', 'own-n4-grammar-0002'],
    ['own-n4-grammar-0002', 'own-n4-grammar-0003'],
    ...[15, 33, 34, 40, 64, 67, 71, 99].map(id => ['own-n4-grammar-0001', 'own-n4-grammar-' + String(id).padStart(4, '0')]),
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
    facts: new Map(items.filter(row => row.entry).map(row => [row.id, knowledgeFacts(row.entry)])),
    support: new PrerequisiteGraph([...ids], [...associations, ...hard]),
    required: new PrerequisiteGraph([...ids], hard),
  };
}


// Source-backed prerequisite across levels. The existing level switch owns
// entitlement, so this recommendation does not open protected material itself.
export function earlierLevelLesson(level, itemId) {
  if (level === 'N4' && itemId.endsWith(':own-n4-grammar-0001')) {
    return { level: 'N5', section: 'grammar', label: 'V辞書形' };
  }
  return null;
}

export function knowledgeFacts(entry) {
  const values = field => (Array.isArray(field) ? field : [field])
    .filter(value => typeof value === 'string' && value.trim().length)
    .map(normalized);
  return {
    readings: [...new Set([...values(entry.reading), ...values(entry.kunyomi), ...values(entry.onyomi)])],
    meanings: [...new Set([...values(entry.meaning), ...values(entry.meaning_bn), ...values(entry.bn)])],
    radicals: [...new Set([...values(entry.radical), ...values(entry.radicals)])],
  };
}

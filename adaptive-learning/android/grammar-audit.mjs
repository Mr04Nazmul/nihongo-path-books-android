import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { selectGrammarRules } from '../mdl.mjs';

// Recognized Japanese morphology and construction labels. A row must contain
// an exact match in the recovered source to be included in a coded pattern.
const verifiedFormations = [
  ['plain-clause', 'Plain form', 'Japanese plain predicate before explanatory んです'],
  ['te-form', 'Vて', 'Japanese verb te-form before a construction'],
  ['dictionary-form', 'Vる', 'Japanese dictionary-form verb before a construction'],
  ['past-form', 'Vた', 'Japanese plain past verb before a construction'],
  ['negative-form', 'Vない', 'Japanese plain negative verb before a construction'],
  ['noun-modifier', 'Nの', 'Japanese nominal modifier marked with の'],
];
const rules = verifiedFormations.map(([id, prefix, description]) => ({
  id, prefix, description, apply: (base, form) => form === '' ? prefix + ' + ' + base : null,
}));
const examples = [];
const locations = new Map();
const levels = [];
for (const path of process.argv.slice(2)) {
  const document = JSON.parse(await readFile(path, 'utf8'));
  if (!Array.isArray(document.grammar)) throw new Error('Missing grammar in ' + path);
  levels.push({ file: basename(path), rows: document.grammar.length });
  for (const row of document.grammar) {
    const source = typeof row.formation === 'string' ? row.formation : '';
    for (const surface of source.normalize('NFKC').split(/[;；]/).map(s => s.trim()).filter(Boolean)) {
      if (!locations.has(surface)) locations.set(surface, []);
      locations.get(surface).push(row.id);
      const match = rules.find(rule => surface.startsWith(rule.prefix + ' + '));
      examples.push(match ?
        { surface, base: surface.slice(match.prefix.length + 3), form: '' } :
        { surface, base: '', form: 'literal' });
    }
  }
}
if (!levels.length) throw new Error('Pass authorized curriculum JSON paths');
console.log(JSON.stringify({
  levels, formationClauses: examples.length,
  repeatedFormations: [...locations].filter(([, occurrences]) => occurrences.length > 1)
    .map(([formation, ids]) => ({ formation, ids })),
  before: selectGrammarRules(examples, []),
  after: selectGrammarRules(examples, rules),
  changesApplied: 0,
}, null, 2));

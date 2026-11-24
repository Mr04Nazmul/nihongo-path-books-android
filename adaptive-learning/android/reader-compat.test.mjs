import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

test('reader fallback works in a WebView without Object.hasOwn', () => {
  const source = readFileSync(new URL('./reader-compat.mjs', import.meta.url), 'utf8');
  assert.equal(runInNewContext(`
    delete Object.hasOwn;
    ${source}
    Object.hasOwn([3], 0) && !Object.hasOwn(Object.create({inherited: 1}), 'inherited');
  `), true);
});

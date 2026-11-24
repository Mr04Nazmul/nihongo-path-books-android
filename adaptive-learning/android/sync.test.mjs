import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { validateAdaptiveBatch } from './adaptive-sync-route.ts';

test('adaptive sync migration isolates owners, deduplicates retries and cascades deletion', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon;
      CREATE ROLE authenticated;
      CREATE ROLE service_role;
      CREATE SCHEMA books;
      CREATE TABLE books.users (id uuid PRIMARY KEY);
      CREATE TABLE books.sessions (user_id uuid REFERENCES books.users(id) ON DELETE CASCADE,
          token_hash text PRIMARY KEY, expires_at timestamptz NOT NULL);
      INSERT INTO books.users VALUES ('00000000-0000-4000-8000-000000000001'), ('00000000-0000-4000-8000-000000000002');
      INSERT INTO books.sessions VALUES
        ('00000000-0000-4000-8000-000000000001','one',now()+interval '1 day'),
        ('00000000-0000-4000-8000-000000000001','second-device',now()+interval '1 day'),
        ('00000000-0000-4000-8000-000000000002','two',now()+interval '1 day');
    `);
    await db.exec(await readFile(new URL('../adaptive-events.sql', import.meta.url), 'utf8'));
    const event = {
      id: '00000000-0000-4000-8000-000000000001', at: Date.now(), rating: 3,
      item: 'N5:preview:vocab:猫', skill: 'N5:preview:vocab:猫',
      correct: true, difficulty: 0, guess: 0.25, slip: 0.05, seconds: 7,
    };
    assert.equal(validateAdaptiveBatch({ after: '0', events: [{ ...event, owner: 'two' }] }).events[0].owner, undefined);
    assert.equal(validateAdaptiveBatch({ after: '0', events: [{ ...event, rating: 1 }] }), null);
    const rpc = async (token, after, events) => (await db.query(
      'SELECT public.nihongo_adaptive_sync($1,$2,$3::jsonb) result', [token, after, JSON.stringify(events)]
    )).rows[0].result;
    await db.exec('SET ROLE authenticated');
    await assert.rejects(() => rpc('one', '0', [event]), /permission denied/);
    await db.exec('RESET ROLE; SET ROLE service_role');
    const first = await rpc('one', '0', [event]);
    assert.equal(first.events.length, 1);
    // Replay a send after the first response was lost on reconnect.
    assert.deepEqual(await rpc('one', '0', [event]), first);
    assert.deepEqual(await rpc('second-device', '0', []), first);
    const secondEvent = {
      ...event, id: '00000000-0000-4000-8000-000000000003', correct: false, rating: 1,
    };
    const second = await rpc('second-device', first.events[0].cursor, [secondEvent]);
    assert.deepEqual(second.events.map(row => row.event), [secondEvent]);
    assert.deepEqual(await rpc('one', first.events[0].cursor, []), second);
    assert.deepEqual(await rpc('two', '0', []), { events: [] });
    assert.deepEqual(await rpc('one', second.events[0].cursor, []), { events: [] });
    assert.equal((await rpc('missing', '0', [event])).status, 401);
    await db.exec("RESET ROLE; DELETE FROM books.users WHERE id='00000000-0000-4000-8000-000000000001'");
    assert.equal((await db.query('SELECT count(*)::int AS count FROM books.adaptive_events')).rows[0].count, 0);
  } finally {
    await db.close();
  }
});

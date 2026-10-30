import pg from 'pg';
import {readFile,readdir} from 'node:fs/promises';
const pool=new pg.Pool({connectionString:process.env.MIGRATION_DATABASE_URL||process.env.DATABASE_URL});
try { for(const name of (await readdir(new URL('../migrations/',import.meta.url))).filter(x=>x.endsWith('.sql')).sort()){if(name==='002_android_release.sql' && (await pool.query("select to_regclass('books.levels') as t")).rows[0].t)continue;await pool.query(await readFile(new URL('../migrations/'+name,import.meta.url),'utf8'));} console.log('Migration applied'); } finally {await pool.end();}

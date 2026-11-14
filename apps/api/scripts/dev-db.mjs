// Local PostgreSQL without Docker (development / CI smoke only – use a managed Postgres in production).
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const dir = resolve(process.cwd(), '.pgdata');
const pg = new EmbeddedPostgres({ databaseDir: dir, user: 'hrone', password: 'hrone', port: 54329, persistent: true });

if (!existsSync(resolve(dir, 'PG_VERSION'))) await pg.initialise();
await pg.start();
try {
  await pg.createDatabase('hrone');
} catch {
  /* already exists */
}
console.log('PostgreSQL ready → postgresql://hrone:hrone@localhost:54329/hrone  (Ctrl+C to stop)');

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => {}, 1 << 30);

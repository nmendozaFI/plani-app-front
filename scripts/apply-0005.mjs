// One-shot migration runner for 0005_add_permite_extras_and_doble.
// Reads the migration.sql file verbatim and applies it against DATABASE_URL.
// Standalone (no Prisma); leaves the prisma db push workflow undisturbed.

import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const sqlPath = resolve(here, '../prisma/migrations/0005_add_permite_extras_and_doble/migration.sql');
const sql = readFileSync(sqlPath, 'utf8');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });

(async () => {
  await client.connect();
  console.log('Connected. Applying 0005...');

  // Pre-state snapshot (so we can report deltas).
  const pre = await client.query(`
    SELECT
      (SELECT array_agg(enumlabel ORDER BY enumsortorder)
         FROM pg_enum
        WHERE enumtypid = '"TipoAsignacion"'::regtype) AS enum_values,
      (SELECT EXISTS (
         SELECT 1 FROM information_schema.columns
          WHERE table_name = 'configTrimestral' AND column_name = 'permiteExtras')
      ) AS column_exists;
  `);
  console.log('Pre-state:', pre.rows[0]);

  // Apply the full migration.sql in one go (pg supports multiple statements
  // in a single .query call when no parameters are provided).
  await client.query(sql);
  console.log('Migration applied without errors.');

  // Post-state snapshot.
  const post = await client.query(`
    SELECT
      (SELECT array_agg(enumlabel ORDER BY enumsortorder)
         FROM pg_enum
        WHERE enumtypid = '"TipoAsignacion"'::regtype) AS enum_values,
      (SELECT COUNT(*) FROM "configTrimestral") AS total_cts,
      (SELECT COUNT(*) FROM "configTrimestral" WHERE "permiteExtras" = true) AS con_permite,
      (SELECT COUNT(*) FROM "configTrimestral" WHERE "permiteExtras" = false) AS sin_permite,
      (SELECT COUNT(*) FROM empresa WHERE "aceptaExtras" = true AND activa = true) AS empresas_acepta_extras,
      (SELECT COUNT(*) FROM "configTrimestral" ct JOIN empresa e ON e.id = ct."empresaId"
        WHERE e."aceptaExtras" <> ct."permiteExtras") AS desincronizados;
  `);
  console.log('Post-state:', post.rows[0]);

  await client.end();
})().catch(async (err) => {
  console.error('FAILED:', err.message);
  try { await client.end(); } catch {}
  process.exit(1);
});

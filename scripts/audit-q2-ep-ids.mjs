import 'dotenv/config';
import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

(async () => {
  await client.connect();

  console.log('Q2 — empresas con escuelaPropia=true en CT:');
  const r = await client.query(`
    SELECT e.id, e.nombre
      FROM "configTrimestral" ct
      JOIN empresa e ON e.id = ct."empresaId"
     WHERE ct.trimestre = '2026-Q2' AND ct."escuelaPropia" = true
     ORDER BY e.id
  `);
  for (const row of r.rows) console.log(`  ${row.id}\t${row.nombre}`);

  console.log('\nQ2 — empresas con permiteExtras=true en CT:');
  const r2 = await client.query(`
    SELECT e.id, e.nombre, e."aceptaExtras"
      FROM "configTrimestral" ct
      JOIN empresa e ON e.id = ct."empresaId"
     WHERE ct.trimestre = '2026-Q2' AND ct."permiteExtras" = true
     ORDER BY e.id
  `);
  for (const row of r2.rows) console.log(`  ${row.id}\t${row.nombre}\t(empresa.aceptaExtras=${row.aceptaExtras})`);

  console.log('\nCT rows en Q2 sin frecuenciaEF NI frecuenciaIT pero con tipoParticipacion=AMBAS:');
  const r3 = await client.query(`
    SELECT e.nombre, ct."tipoParticipacion", ct."frecuenciaSolicitada", ct."frecuenciaEF", ct."frecuenciaIT"
      FROM "configTrimestral" ct
      JOIN empresa e ON e.id = ct."empresaId"
     WHERE ct.trimestre = '2026-Q2'
       AND ct."frecuenciaEF" IS NULL
       AND ct."frecuenciaIT" IS NULL
     ORDER BY e.nombre
  `);
  for (const row of r3.rows) {
    console.log(`  ${row.nombre.padEnd(35)} tipo=${row.tipoParticipacion}\tfreqTotal=${row.frecuenciaSolicitada}`);
  }

  console.log(`\nCT rows en Q2 con freqEF NOT NULL (${(await client.query(`SELECT COUNT(*) FROM "configTrimestral" WHERE trimestre='2026-Q2' AND "frecuenciaEF" IS NOT NULL`)).rows[0].count} filas):`);
  const r4 = await client.query(`
    SELECT e.nombre, ct."tipoParticipacion", ct."frecuenciaSolicitada", ct."frecuenciaEF", ct."frecuenciaIT"
      FROM "configTrimestral" ct
      JOIN empresa e ON e.id = ct."empresaId"
     WHERE ct.trimestre = '2026-Q2' AND ct."frecuenciaEF" IS NOT NULL
     ORDER BY e.nombre
     LIMIT 8
  `);
  for (const row of r4.rows) {
    console.log(`  ${row.nombre.padEnd(35)} tipo=${row.tipoParticipacion}\tfreqTotal=${row.frecuenciaSolicitada}\tEF=${row.frecuenciaEF}\tIT=${row.frecuenciaIT}`);
  }
  console.log('  ...');

  await client.end();
})().catch(async (err) => {
  console.error('FAILED:', err.message);
  try { await client.end(); } catch {}
  process.exit(1);
});

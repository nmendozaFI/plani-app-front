// V24 Cambio B / B5: read-only snapshot de Q2+Q3 antes del wipe destructivo.
// Reporta filas que se eliminarían en cada tabla por trimestre + estadísticas.
// No modifica nada.

import 'dotenv/config';
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });

const TRIMESTRES = ['2026-Q2', '2026-Q3'];

(async () => {
  await client.connect();

  for (const tri of TRIMESTRES) {
    console.log(`\n══════ ${tri} — estado pre-wipe ══════`);

    // planificacion por tipoAsignacion
    const p = await client.query(`
      SELECT "tipoAsignacion" AS tipo, COUNT(*)::int AS n
        FROM planificacion
       WHERE trimestre = $1
       GROUP BY "tipoAsignacion"
       ORDER BY "tipoAsignacion"
    `, [tri]);
    const pTotals = Object.fromEntries(p.rows.map(r => [r.tipo, r.n]));
    const pTotal = Object.values(pTotals).reduce((a, b) => a + b, 0);
    console.log(`  planificacion: ${pTotal} filas`);
    for (const t of ['BASE', 'EXTRA', 'DOBLE', 'CONTINGENCIA']) {
      console.log(`    ${t.padEnd(13)} ${pTotals[t] ?? 0}`);
    }

    // frecuencia
    const f = await client.query(`
      SELECT COUNT(*)::int AS n,
             COALESCE(SUM("talleresEF"), 0)::int AS sum_ef,
             COALESCE(SUM("talleresIT"), 0)::int AS sum_it
        FROM frecuencia
       WHERE trimestre = $1
    `, [tri]);
    console.log(`  frecuencia: ${f.rows[0].n} filas (sum EF=${f.rows[0].sum_ef}, sum IT=${f.rows[0].sum_it})`);

    // configTrimestral
    const ct = await client.query(`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE "escuelaPropia" = true)::int AS ep,
             COUNT(*) FILTER (WHERE "permiteExtras" = true)::int AS pe,
             COUNT(*) FILTER (WHERE "frecuenciaEF" IS NOT NULL)::int AS con_ef,
             COUNT(*) FILTER (WHERE "frecuenciaIT" IS NOT NULL)::int AS con_it
        FROM "configTrimestral"
       WHERE trimestre = $1
    `, [tri]);
    const c = ct.rows[0];
    console.log(`  configTrimestral: ${c.total} filas (EP=${c.ep}, PE=${c.pe}, con freqEF=${c.con_ef}, con freqIT=${c.con_it})`);

    // historicoTaller — NO se borra, solo informativo
    const h = await client.query(`
      SELECT COUNT(*)::int AS n FROM "historicoTaller" WHERE trimestre = $1
    `, [tri]);
    console.log(`  historicoTaller (NO se toca): ${h.rows[0].n} filas`);

    // festivo — informativo
    const fest = await client.query(`
      SELECT COUNT(*)::int AS n FROM festivo WHERE trimestre = $1
    `, [tri]);
    console.log(`  festivo (NO se toca): ${fest.rows[0].n} filas`);
  }

  // Q1 cerrado — debe permanecer intacto
  console.log('\n══════ 2026-Q1 (histórico, NO se toca, sólo informativo) ══════');
  const q1 = await client.query(`
    SELECT
      (SELECT COUNT(*)::int FROM planificacion WHERE trimestre = '2026-Q1') AS p,
      (SELECT COUNT(*)::int FROM frecuencia WHERE trimestre = '2026-Q1') AS f,
      (SELECT COUNT(*)::int FROM "configTrimestral" WHERE trimestre = '2026-Q1') AS ct,
      (SELECT COUNT(*)::int FROM "historicoTaller" WHERE trimestre = '2026-Q1') AS h
  `);
  const q = q1.rows[0];
  console.log(`  planificacion=${q.p} frecuencia=${q.f} configTrimestral=${q.ct} historicoTaller=${q.h}`);

  await client.end();

  console.log('\n────────────────────────────────────────────────');
  console.log('Para ejecutar el WIPE de Q2 + Q3 corre:');
  console.log('  node scripts/wipe-q2-q3.mjs');
  console.log('────────────────────────────────────────────────');
})().catch(async (err) => {
  console.error('FAILED:', err.message);
  try { await client.end(); } catch {}
  process.exit(1);
});

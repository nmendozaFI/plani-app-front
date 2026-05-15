// V24 Cambio B / B5: DESTRUCTIVO — wipe de planificacion + frecuencia +
// configTrimestral para Q2 y Q3 (D1: "Q2 wipear y reimportar / Q3 fresh").
// NO toca: historicoTaller, festivo, empresa, taller, semanaConfig, ciudad.
// NO toca Q1 (histórico cerrado).
//
// Para correrlo:
//   node scripts/wipe-q2-q3.mjs --confirm
//
// Sin la flag --confirm hace un dry-run que reporta cuántas filas BORRARÍA.

import 'dotenv/config';
import pg from 'pg';

const args = new Set(process.argv.slice(2));
const CONFIRM = args.has('--confirm');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });

const TRIMESTRES = ['2026-Q2', '2026-Q3'];

(async () => {
  await client.connect();

  console.log(CONFIRM
    ? '🔴 EJECUTANDO WIPE (--confirm presente)'
    : '⚪ DRY-RUN (sin --confirm — solo cuenta, no borra)');

  for (const tri of TRIMESTRES) {
    console.log(`\n══════ ${tri} ══════`);

    // Count BEFORE.
    const counts = await client.query(`
      SELECT
        (SELECT COUNT(*)::int FROM planificacion WHERE trimestre = $1) AS p,
        (SELECT COUNT(*)::int FROM frecuencia WHERE trimestre = $1) AS f,
        (SELECT COUNT(*)::int FROM "configTrimestral" WHERE trimestre = $1) AS ct
    `, [tri]);
    const { p, f, ct } = counts.rows[0];
    console.log(`  pre-wipe: planificacion=${p} frecuencia=${f} configTrimestral=${ct}`);

    if (!CONFIRM) {
      console.log(`  [dry-run] borraría ${p + f + ct} filas en total`);
      continue;
    }

    // Order matters por FKs (planificacion → empresaId → configTrimestral.empresaId
    // no es FK directa, así que se pueden borrar en cualquier orden, pero
    // mantenemos planificacion → frecuencia → configTrimestral por simetría).
    await client.query('BEGIN');
    try {
      const r1 = await client.query(
        'DELETE FROM planificacion WHERE trimestre = $1',
        [tri],
      );
      const r2 = await client.query(
        'DELETE FROM frecuencia WHERE trimestre = $1',
        [tri],
      );
      const r3 = await client.query(
        'DELETE FROM "configTrimestral" WHERE trimestre = $1',
        [tri],
      );
      await client.query('COMMIT');
      console.log(`  ✅ wipe OK: planificacion=${r1.rowCount} frecuencia=${r2.rowCount} configTrimestral=${r3.rowCount}`);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    }

    // Verify post-state.
    const post = await client.query(`
      SELECT
        (SELECT COUNT(*)::int FROM planificacion WHERE trimestre = $1) AS p,
        (SELECT COUNT(*)::int FROM frecuencia WHERE trimestre = $1) AS f,
        (SELECT COUNT(*)::int FROM "configTrimestral" WHERE trimestre = $1) AS ct
    `, [tri]);
    const { p: pp, f: ff, ct: ccc } = post.rows[0];
    console.log(`  post-wipe: planificacion=${pp} frecuencia=${ff} configTrimestral=${ccc}`);
    if (pp !== 0 || ff !== 0 || ccc !== 0) {
      console.error(`  ⚠ post-wipe NO está vacío — revisar manualmente`);
    }
  }

  // Q1 sanity (no debe haber cambiado nada).
  console.log('\n══════ Q1 (sanity post-wipe — no debe cambiar) ══════');
  const q1 = await client.query(`
    SELECT
      (SELECT COUNT(*)::int FROM "historicoTaller" WHERE trimestre = '2026-Q1') AS h,
      (SELECT COUNT(*)::int FROM festivo WHERE trimestre = '2026-Q1') AS f
  `);
  console.log(`  historicoTaller=${q1.rows[0].h} festivo=${q1.rows[0].f}`);

  await client.end();

  if (!CONFIRM) {
    console.log('\n⚪ DRY-RUN completado. Para ejecutar de verdad:');
    console.log('   node scripts/wipe-q2-q3.mjs --confirm');
  } else {
    console.log('\n✅ Wipe completado. Próximo paso: subir Excel CT nuevo (formato V24 split EF/IT).');
  }
})().catch(async (err) => {
  console.error('FAILED:', err.message);
  try { await client.query('ROLLBACK'); } catch {}
  try { await client.end(); } catch {}
  process.exit(1);
});

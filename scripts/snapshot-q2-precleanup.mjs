// Fase 7 (Cambio A): read-only snapshot of Q2/Q3 planificacion state before
// the destructive cleanup. Reports counts per tipoAsignacion, lists existing
// EXTRA + DOBLE rows so the planner can confirm what's about to be deleted,
// and shows the permiteExtras / escuelaPropia distribution.

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
    console.log(`\n══════ ${tri} ══════`);

    // Counts per tipoAsignacion.
    const counts = await client.query(`
      SELECT "tipoAsignacion" AS tipo, COUNT(*)::int AS n
        FROM planificacion
       WHERE trimestre = $1
       GROUP BY "tipoAsignacion"
       ORDER BY "tipoAsignacion"
    `, [tri]);
    const totals = Object.fromEntries(counts.rows.map(r => [r.tipo, r.n]));
    const total = Object.values(totals).reduce((a, b) => a + b, 0);
    console.log('Totals by tipoAsignacion:');
    for (const tipo of ['BASE', 'EXTRA', 'DOBLE', 'CONTINGENCIA']) {
      console.log(`  ${tipo.padEnd(12)} ${totals[tipo] ?? 0}`);
    }
    console.log(`  ${'TOTAL'.padEnd(12)} ${total}`);

    // EXTRA + DOBLE detail (what cleanup will wipe).
    const extras = await client.query(`
      SELECT p.id, p.semana, p.dia, p.horario, p."tipoAsignacion" AS tipo,
             e.nombre AS empresa, t.nombre AS taller, p.estado
        FROM planificacion p
        LEFT JOIN empresa e ON e.id = p."empresaId"
        LEFT JOIN taller t  ON t.id = p."tallerId"
       WHERE p.trimestre = $1
         AND p."tipoAsignacion" IN ('EXTRA', 'DOBLE')
       ORDER BY p.semana, p.dia, p.horario, e.nombre
    `, [tri]);
    if (extras.rows.length > 0) {
      console.log(`\nDetalle de las ${extras.rows.length} filas EXTRA/DOBLE (que se borrarán):`);
      console.log('  id      sem dia horario   tipo  empresa                        taller');
      for (const r of extras.rows) {
        const id = String(r.id).padEnd(7);
        const sem = String(r.semana).padStart(3);
        const dia = (r.dia || '').padEnd(3);
        const horario = (r.horario || '').padEnd(9);
        const tipo = (r.tipo || '').padEnd(5);
        const empresa = (r.empresa || '(null)').padEnd(30);
        const taller = r.taller || '(null)';
        console.log(`  ${id} ${sem} ${dia} ${horario} ${tipo} ${empresa} ${taller}`);
      }
    } else {
      console.log('\nSin filas EXTRA/DOBLE — cleanup en este trimestre sería no-op.');
    }

    // Empresas con escuelaPropia / permiteExtras en CT para este trimestre.
    const flags = await client.query(`
      SELECT e.id, e.nombre, ct."escuelaPropia" AS ep, ct."permiteExtras" AS pe,
             e."aceptaExtras" AS empresa_acepta_extras, e."maxExtrasTrimestre" AS max_extras
        FROM "configTrimestral" ct
        JOIN empresa e ON e.id = ct."empresaId"
       WHERE ct.trimestre = $1
         AND (ct."escuelaPropia" = true OR ct."permiteExtras" = true)
       ORDER BY e.nombre
    `, [tri]);
    if (flags.rows.length > 0) {
      console.log(`\nEmpresas con EP=true o PE=true en CT (${flags.rows.length}):`);
      console.log('  id   empresa                        EP  PE  empresa.aceptaExtras  max');
      for (const r of flags.rows) {
        console.log(
          `  ${String(r.id).padEnd(4)} ${(r.nombre || '').padEnd(30)} ` +
          `${(r.ep ? '✓ ' : '· ')} ${(r.pe ? '✓ ' : '· ')}` +
          `${(r.empresa_acepta_extras ? 'sí'.padStart(18) : 'no'.padStart(18))}    ${r.max_extras ?? 0}`
        );
      }
    } else {
      console.log('\nSin empresas con EP=true ni PE=true en este trimestre.');
    }
  }

  await client.end();
})().catch(async (err) => {
  console.error('FAILED:', err.message);
  try { await client.end(); } catch {}
  process.exit(1);
});

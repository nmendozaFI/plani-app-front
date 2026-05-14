// Smoke test for the new LEFT JOIN that surfaces empresa_nombre_original
// in GET /api/calendario/{trimestre}. Hits the SQL directly (mirror of the
// query in app/routers/calendario.py:obtener_calendario) and verifies:
//   1) The column comes back without error.
//   2) Rows where empresa_id_original is non-null get a non-null
//      empresa_nombre_original.
//   3) Counts rows where motivo_cambio=EMPRESA_CANCELO AND
//      empresa_id != empresa_id_original (i.e. rows that will display the
//      new "Canceló: X" badge in Operación).

import 'dotenv/config';
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });

(async () => {
  await client.connect();

  for (const tri of ['2026-Q2', '2026-Q3']) {
    console.log(`\n══════ ${tri} ══════`);
    const r = await client.query(`
      SELECT p.id,
             p."empresaId" AS empresa_id,
             p."empresaIdOriginal" AS empresa_id_original,
             e.nombre AS empresa_nombre,
             e_orig.nombre AS empresa_nombre_original,
             p."motivoCambio" AS motivo_cambio
        FROM planificacion p
        LEFT JOIN empresa e ON e.id = p."empresaId"
        LEFT JOIN empresa e_orig ON e_orig.id = p."empresaIdOriginal"
       WHERE p.trimestre = $1
    `, [tri]);

    const total = r.rows.length;
    const withOriginal = r.rows.filter(row => row.empresa_id_original != null);
    const withOriginalAndName = withOriginal.filter(row => row.empresa_nombre_original != null);
    const cancelados = r.rows.filter(row => row.motivo_cambio === 'EMPRESA_CANCELO');
    const cancelReassigned = cancelados.filter(row =>
      row.empresa_id_original != null
      && row.empresa_id_original !== row.empresa_id
      && row.empresa_nombre_original != null
    );

    console.log(`  Total slots:                                       ${total}`);
    console.log(`  Slots con empresa_id_original != NULL:             ${withOriginal.length}`);
    console.log(`  ... y empresa_nombre_original también != NULL:     ${withOriginalAndName.length}`);
    console.log(`  Slots con motivo_cambio=EMPRESA_CANCELO:           ${cancelados.length}`);
    console.log(`  ... y empresa_id != empresa_id_original (badge):   ${cancelReassigned.length}`);

    if (cancelReassigned.length > 0) {
      console.log(`\n  Ejemplos del badge "Canceló: X" (máx 5):`);
      for (const row of cancelReassigned.slice(0, 5)) {
        console.log(
          `    slot ${row.id}: actual=${row.empresa_nombre} (id ${row.empresa_id}), ` +
          `original=${row.empresa_nombre_original} (id ${row.empresa_id_original})`
        );
      }
    }
  }

  await client.end();
})().catch(async (err) => {
  console.error('FAILED:', err.message);
  try { await client.end(); } catch {}
  process.exit(1);
});

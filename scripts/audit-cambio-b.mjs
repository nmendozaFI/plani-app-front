// Read-only audit for Cambio B. No writes.
// Reports:
//   - frecuenciaEF / frecuenciaIT distribution per trimestre.
//   - escuelaPropia / permiteExtras distribution per trimestre.
//   - tipoParticipacion distribution per trimestre.
//   - frecuencia table state per trimestre (talleresEF/IT/totalAsignado).

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

  // Trimestres a auditar.
  const tris = await client.query(`
    SELECT DISTINCT trimestre FROM "configTrimestral"
    ORDER BY trimestre DESC
  `);
  const trimestres = tris.rows.map(r => r.trimestre);

  console.log('\n══════ Trimestres con CT ══════');
  console.log(trimestres.join(', '));

  for (const tri of trimestres) {
    console.log(`\n══════ ${tri} ══════`);

    // 1.3 — frecuenciaEF/IT en CT
    const r1 = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE "frecuenciaSolicitada" IS NOT NULL) AS con_freq_total,
        COUNT(*) FILTER (WHERE "frecuenciaSolicitada" IS NULL) AS sin_freq_total,
        COUNT(*) FILTER (WHERE "frecuenciaEF" IS NOT NULL) AS con_freq_ef,
        COUNT(*) FILTER (WHERE "frecuenciaIT" IS NOT NULL) AS con_freq_it,
        COUNT(*) FILTER (WHERE "frecuenciaEF" IS NOT NULL OR "frecuenciaIT" IS NOT NULL) AS con_split,
        COUNT(*) FILTER (WHERE "frecuenciaEF" IS NULL AND "frecuenciaIT" IS NULL) AS sin_split,
        COUNT(*) AS total
      FROM "configTrimestral"
      WHERE trimestre = $1
    `, [tri]);
    const r1d = r1.rows[0];
    console.log('Bloque 1.3 — configTrimestral counts:');
    console.log(`  total CT rows                                   ${r1d.total}`);
    console.log(`  con frecuenciaSolicitada NOT NULL               ${r1d.con_freq_total}`);
    console.log(`  con frecuenciaSolicitada NULL                   ${r1d.sin_freq_total}`);
    console.log(`  con frecuenciaEF NOT NULL                       ${r1d.con_freq_ef}`);
    console.log(`  con frecuenciaIT NOT NULL                       ${r1d.con_freq_it}`);
    console.log(`  con freqEF o freqIT (algún split)               ${r1d.con_split}`);
    console.log(`  con freqEF=NULL Y freqIT=NULL                   ${r1d.sin_split}`);

    // 4.4 — escuelaPropia / permiteExtras / tipoParticipacion
    const r2 = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE "escuelaPropia" = true) AS ep_true,
        COUNT(*) FILTER (WHERE "escuelaPropia" = false) AS ep_false,
        COUNT(*) FILTER (WHERE "permiteExtras" = true) AS pe_true,
        COUNT(*) FILTER (WHERE "permiteExtras" = false) AS pe_false,
        COUNT(*) FILTER (WHERE "tipoParticipacion" = 'EF') AS tipo_ef,
        COUNT(*) FILTER (WHERE "tipoParticipacion" = 'IT') AS tipo_it,
        COUNT(*) FILTER (WHERE "tipoParticipacion" = 'AMBAS') AS tipo_ambas
      FROM "configTrimestral"
      WHERE trimestre = $1
    `, [tri]);
    const r2d = r2.rows[0];
    console.log('Bloque 4.4 — flags y tipoParticipacion:');
    console.log(`  escuelaPropia: ${r2d.ep_true} true / ${r2d.ep_false} false`);
    console.log(`  permiteExtras: ${r2d.pe_true} true / ${r2d.pe_false} false`);
    console.log(`  tipoParticipacion: ${r2d.tipo_ef} EF / ${r2d.tipo_it} IT / ${r2d.tipo_ambas} AMBAS`);

    // Estado de tabla frecuencia para este trimestre
    const r3 = await client.query(`
      SELECT
        COUNT(*) AS rows,
        COALESCE(SUM("talleresEF"), 0)::int AS total_ef,
        COALESCE(SUM("talleresIT"), 0)::int AS total_it,
        COALESCE(SUM("totalAsignado"), 0)::int AS total_asignado
      FROM frecuencia
      WHERE trimestre = $1
    `, [tri]);
    const r3d = r3.rows[0];
    console.log('Tabla `frecuencia`:');
    console.log(`  filas: ${r3d.rows}, sum talleresEF: ${r3d.total_ef}, sum talleresIT: ${r3d.total_it}, sum totalAsignado: ${r3d.total_asignado}`);

    // Estado de tabla planificacion para este trimestre
    const r4 = await client.query(`
      SELECT
        "tipoAsignacion" AS tipo,
        COUNT(*) AS n
      FROM planificacion
      WHERE trimestre = $1
      GROUP BY "tipoAsignacion"
      ORDER BY "tipoAsignacion"
    `, [tri]);
    console.log('Tabla `planificacion`:');
    for (const r of r4.rows) {
      console.log(`  ${r.tipo}: ${r.n}`);
    }
    if (r4.rows.length === 0) {
      console.log('  (sin filas)');
    }
  }

  // Aceptaextras a nivel Empresa (input baseline maestro)
  console.log('\n══════ Empresa.aceptaExtras (baseline maestro) ══════');
  const re = await client.query(`
    SELECT COUNT(*) FILTER (WHERE "aceptaExtras" = true) AS ae_true,
           COUNT(*) FILTER (WHERE "aceptaExtras" = false OR "aceptaExtras" IS NULL) AS ae_false,
           COUNT(*) AS total
    FROM empresa
    WHERE activa = true
  `);
  const red = re.rows[0];
  console.log(`  empresas activas: ${red.total} (aceptaExtras true=${red.ae_true}, false/null=${red.ae_false})`);

  await client.end();
})().catch(async (err) => {
  console.error('FAILED:', err.message);
  try { await client.end(); } catch {}
  process.exit(1);
});

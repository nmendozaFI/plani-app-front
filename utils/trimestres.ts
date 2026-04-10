/**
 * utils/trimestres.ts
 * 
 * Utilidades para manejar trimestres de forma dinámica.
 * Importar desde cualquier componente — nunca hardcodear "2026-Q2".
 */

export interface TrimestreOption {
  value: string;  // "2026-Q2"
  label: string;  // "2026-Q2"
}

/**
 * Devuelve el trimestre actual basado en la fecha del sistema.
 * Q1 = Ene-Mar | Q2 = Abr-Jun | Q3 = Jul-Sep | Q4 = Oct-Dic
 */
export function getTrimestreActual(): string {
  const now = new Date();
  const q = Math.ceil((now.getMonth() + 1) / 3);
  return `${now.getFullYear()}-Q${q}`;
}

/**
 * Devuelve el trimestre anterior al dado.
 * Ej: "2026-Q1" → "2025-Q4"
 */
export function getTrimestreAnterior(trimestre: string): string {
  const [yearStr, qStr] = trimestre.split("-Q");
  let year = parseInt(yearStr);
  let q = parseInt(qStr) - 1;
  if (q === 0) { q = 4; year--; }
  return `${year}-Q${q}`;
}

/**
 * Devuelve el trimestre siguiente al dado.
 * Ej: "2026-Q4" → "2027-Q1"
 */
export function getTrimestreSiguiente(trimestre: string): string {
  const [yearStr, qStr] = trimestre.split("-Q");
  let year = parseInt(yearStr);
  let q = parseInt(qStr) + 1;
  if (q === 5) { q = 1; year++; }
  return `${year}-Q${q}`;
}

/**
 * Lista de trimestres para selects: desde (actual - 2) hasta (actual + 4).
 * Cubre siempre el pasado reciente y planificación futura hasta ~1 año.
 * Se recalcula en cada render — sin mantenimiento.
 */
export function getTrimestres(): TrimestreOption[] {
  const actual = getTrimestreActual();
  const [yearStr, qStr] = actual.split("-Q");
  let year = parseInt(yearStr);
  let q = parseInt(qStr);

  // Retroceder 2 trimestres para el punto de inicio
  for (let i = 0; i < 2; i++) {
    q--;
    if (q === 0) { q = 4; year--; }
  }

  const opciones: TrimestreOption[] = [];
  for (let i = 0; i < 10; i++) {  // 10 trimestres = ~2.5 años de rango
    opciones.push({ value: `${year}-Q${q}`, label: `${year}-Q${q}` });
    q++;
    if (q === 5) { q = 1; year++; }
  }

  return opciones;
}
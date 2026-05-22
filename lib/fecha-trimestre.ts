/**
 * V26 — Helpers compartidos para mapear (trimestre, semana, día) → fecha real.
 *
 * Origen: las funciones `getWeekDateRange` y `getDayDateLabel` vivían inline
 * en OperacionPageClient.tsx. Se extrajeron acá para que la vista calendario
 * mensual (CalendarioMensualView) las reutilice sin duplicar la lógica de
 * "primer lunes del trimestre".
 */

const MONTHS_ABREV = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

const MONTHS_FULL = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const DIA_OFFSET: Record<string, number> = { L: 0, M: 1, X: 2, J: 3, V: 4 };
const DIAS_LMV: ReadonlyArray<"L" | "M" | "X" | "J" | "V"> = ["L", "M", "X", "J", "V"];

function parseTrimestre(trimestre: string): { year: number; quarter: number } {
  const [yearStr, qStr] = trimestre.split("-Q");
  return { year: parseInt(yearStr), quarter: parseInt(qStr) };
}

function getFirstMondayOfQuarter(year: number, quarter: number): Date {
  // Q1=Jan, Q2=Apr, Q3=Jul, Q4=Oct
  const quarterStartMonth = (quarter - 1) * 3;
  const quarterStart = new Date(year, quarterStartMonth, 1);
  const dayOfWeek = quarterStart.getDay();
  const daysUntilMonday =
    dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek;
  const firstMonday = new Date(quarterStart);
  firstMonday.setDate(quarterStart.getDate() + daysUntilMonday);
  return firstMonday;
}

/** Rango de fechas de la semana ("DD - DD Mes Año"). Vista lista. */
export function getWeekDateRange(trimestre: string, semana: number): string {
  const { year, quarter } = parseTrimestre(trimestre);
  const firstMonday = getFirstMondayOfQuarter(year, quarter);
  const weekStart = new Date(firstMonday);
  weekStart.setDate(firstMonday.getDate() + (semana - 1) * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 4);
  return `${weekStart.getDate()} - ${weekEnd.getDate()} ${MONTHS_ABREV[weekEnd.getMonth()]} ${year}`;
}

/** Etiqueta "DD/MM" al lado del día en la vista lista. */
export function getDayDateLabel(
  trimestre: string,
  semana: number,
  dia: string,
): string {
  const offset = DIA_OFFSET[dia];
  if (offset === undefined) return "";
  const { year, quarter } = parseTrimestre(trimestre);
  const firstMonday = getFirstMondayOfQuarter(year, quarter);
  const target = new Date(firstMonday);
  target.setDate(firstMonday.getDate() + (semana - 1) * 7 + offset);
  const dd = String(target.getDate()).padStart(2, "0");
  const mm = String(target.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

/** V26: fecha JS real del slot (semana, día) en el trimestre. null si día inválido. */
export function getDateForSlot(
  trimestre: string,
  semana: number,
  dia: string,
): Date | null {
  const offset = DIA_OFFSET[dia];
  if (offset === undefined) return null;
  const { year, quarter } = parseTrimestre(trimestre);
  const firstMonday = getFirstMondayOfQuarter(year, quarter);
  const target = new Date(firstMonday);
  target.setDate(firstMonday.getDate() + (semana - 1) * 7 + offset);
  return target;
}

export interface MesInfo {
  year: number;
  monthIdx: number;   // 0..11
  nombre: string;     // "Abril"
}

/**
 * V26: meses únicos que abarcan las semanas del trimestre. Para Q2 2026
 * típicamente devuelve [abril, mayo, junio]. Orden: cronológico.
 */
export function getMesesDelTrimestre(
  trimestre: string,
  semanasTotal: number = 13,
): MesInfo[] {
  const seen = new Set<string>();
  const result: MesInfo[] = [];
  for (let s = 1; s <= semanasTotal; s++) {
    for (const dia of DIAS_LMV) {
      const d = getDateForSlot(trimestre, s, dia);
      if (!d) continue;
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({
        year: d.getFullYear(),
        monthIdx: d.getMonth(),
        nombre: MONTHS_FULL[d.getMonth()],
      });
    }
  }
  return result;
}

/**
 * V26: semanas (1..N) del trimestre que tocan al menos un día del mes dado.
 * Si la semana cae con un solo día dentro del mes, igual se incluye — la
 * grilla mensual pintará esa semana con las celdas del otro mes en gris
 * ("Fuera del mes").
 */
export function getSemanasDelMes(
  trimestre: string,
  year: number,
  monthIdx: number,
  semanasTotal: number = 13,
): number[] {
  const result = new Set<number>();
  for (let s = 1; s <= semanasTotal; s++) {
    for (const dia of DIAS_LMV) {
      const d = getDateForSlot(trimestre, s, dia);
      if (!d) continue;
      if (d.getFullYear() === year && d.getMonth() === monthIdx) {
        result.add(s);
        break;
      }
    }
  }
  return [...result].sort((a, b) => a - b);
}

export function nombreMes(monthIdx: number, full: boolean = true): string {
  if (monthIdx < 0 || monthIdx > 11) return "";
  return (full ? MONTHS_FULL : MONTHS_ABREV)[monthIdx];
}

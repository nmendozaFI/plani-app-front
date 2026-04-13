/**
 * Calendario (Phase 2) types.
 * Extracted from lib/api.ts
 */

export interface SugerenciaContingencia {
  empresa_id: number;
  empresa_nombre: string;
  motivo: string;
  prioridad: number;
}

export interface SlotCalendario {
  semana: number;
  dia: string;
  horario: string;
  turno: string;
  empresa_id: number;
  empresa_nombre: string;
  programa: string;
  taller_id: number;
  taller_nombre: string;
  ciudad_id: number | null;
  ciudad: string | null;
  tipo_asignacion: string;
  sugerencias: SugerenciaContingencia[] | null;
}

export interface CalendarioOutput {
  trimestre: string;
  status: string;
  tiempo_segundos: number;
  total_slots: number;
  total_ef: number;
  total_it: number;
  slots: SlotCalendario[];
  inviolables_pct: number;
  preferentes_pct: number;
  warnings: string[];
}

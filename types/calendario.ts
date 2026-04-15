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
  id: number;
  semana: number;
  dia: string;
  horario: string;
  turno: string;
  empresa_id: number | null;
  empresa_id_original: number | null;  // Solver's original assignment (never changes)
  empresa_nombre: string | null;
  programa: string;
  taller_id: number;
  taller_nombre: string;
  ciudad_id: number | null;
  ciudad: string | null;
  tipo_asignacion: string;
  estado: string;  // PLANIFICADO | CONFIRMADO | OK | CANCELADO | VACANTE
  confirmado: boolean;
  notas: string | null;
  motivo_cambio: string | null;  // EMPRESA_CANCELO | DECISION_PLANIFICADOR | null
  sugerencias?: SugerenciaContingencia[] | null;
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

// Phase 3: Operacion types
export interface CalendarioResumen {
  trimestre: string;
  total_slots: number;
  asignados: number;
  vacantes: number;
  confirmados: number;
  ok: number;
  cancelados: number;
  progress_pct: number;
  by_week: {
    semana: number;
    total: number;
    asignados: number;
    vacantes: number;
    confirmados: number;
    ok: number;
    cancelados: number;
  }[];
  by_company: {
    empresa: string;
    total: number;
    confirmados: number;
    ok: number;
    cancelados: number;
  }[];
}

export interface SlotUpdateInput {
  estado?: string;
  confirmado?: boolean;
  empresa_id?: number | null;
  notas?: string | null;
  motivo_cambio?: string | null;  // EMPRESA_CANCELO | DECISION_PLANIFICADOR
}

export interface SlotBatchUpdateItem {
  slot_id: number;
  estado?: string;
  confirmado?: boolean;
  empresa_id?: number | null;
  notas?: string | null;
  motivo_cambio?: string | null;  // EMPRESA_CANCELO | DECISION_PLANIFICADOR
}

// ── Validation types ─────────────────────────────────────────

export interface ValidarAsignacionInput {
  slot_id: number;
  empresa_id: number;
}

export interface ValidarAsignacionResult {
  ok: boolean;
  warnings: string[];
  restricciones_violadas: string[];
}

export interface CalendarioGetResponse {
  trimestre: string;
  total_slots: number;
  asignados: number;
  vacantes: number;
  confirmados: number;
  ok: number;
  cancelados: number;
  slots: SlotCalendario[];
}

// ── Import Excel types ─────────────────────────────────────

export interface EmpresaCambiada {
  slot_id: number;
  semana: number;
  dia: string;
  taller_nombre: string;
  empresa_anterior: string | null;
  empresa_nueva: string;
}

export interface CambioDetalle {
  slot_id: number;
  semana: number;
  dia: string;
  taller_nombre: string;
  empresa_nombre: string | null;
  campo: "estado" | "confirmado" | "empresa";
  valor_anterior: string;
  valor_nuevo: string;
}

export interface ImportarExcelResult {
  trimestre: string;
  total_procesados: number;
  actualizados: number;
  sin_cambios: number;
  errores: number;
  empresas_cambiadas: EmpresaCambiada[];
  cambios_detalle: CambioDetalle[];
  warnings: string[];
}

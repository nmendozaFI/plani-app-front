/**
 * Calendario (Phase 2) types.
 * Extracted from lib/api.ts
 */

// V17: planificacion.estado dropped "OK". CONFIRMADO is the terminal state.
// Operation page no longer tracks "did the workshop happen"; that lives in
// historicoTaller (own enum, untouched).
export type EstadoSlot =
  | "VACANTE"
  | "PLANIFICADO"
  | "CONFIRMADO"
  | "CANCELADO";

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
  empresa_nombre_original?: string | null;  // Nombre de la empresa originalmente asignada — surfaced for the "Canceló: X" badge when motivo_cambio=EMPRESA_CANCELO
  programa: string;
  taller_id: number;
  taller_nombre: string;
  ciudad_id: number | null;
  ciudad: string | null;
  tipo_asignacion: string;
  estado: EstadoSlot;
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

// V26: festivos del trimestre. Endpoint dedicado para la vista calendario
// mensual (marca celdas como festivo en gris claro). El frontend mapea
// (semana, dia) → fecha real con los helpers de lib/fecha-trimestre.
export interface Festivo {
  semana: number;
  dia: string;       // "L" | "M" | "X" | "J" | "V"
  motivo: string;
}

export interface ListaFestivosResponse {
  trimestre: string;
  festivos: Festivo[];
}

// Phase 3: Operacion types
export interface CalendarioResumen {
  trimestre: string;
  total_slots: number;
  asignados: number;
  vacantes: number;
  confirmados: number;
  cancelados: number;
  progress_pct: number;
  by_week: {
    semana: number;
    total: number;
    asignados: number;
    vacantes: number;
    confirmados: number;
    cancelados: number;
  }[];
  by_company: {
    empresa: string;
    total: number;
    confirmados: number;
    cancelados: number;
  }[];
}

export interface SlotUpdateInput {
  estado?: EstadoSlot;
  confirmado?: boolean;
  empresa_id?: number | null;
  notas?: string | null;
  motivo_cambio?: string | null;  // EMPRESA_CANCELO | DECISION_PLANIFICADOR
  // V26 (edición unificada): el modal de edición puede sustituir el taller
  // del slot por cualquier otro del catálogo activo. El backend devuelve
  // taller_nombre/programa derivados vía JOIN; no hay que pasarlos aquí.
  taller_id?: number;
}

export interface SlotBatchUpdateItem {
  slot_id: number;
  estado?: EstadoSlot;
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

// V19: bulk INSERT calendar importer — response of
// POST /api/calendario/{trimestre}/importar-excel-bulk
// V20: extras_insertados / extras_detalle added for escuela-propia EXTRA rows.
export interface ImportarExcelBulkResult {
  trimestre: string;
  total_procesados: number;
  insertados: number;
  vacantes: number;
  extras_insertados: number;
  extras_detalle: FilaExtraInsertada[];
  empresa_no_encontrada: number;
  taller_no_encontrado: number;
  errores: number;
  warnings: string[];
  dry_run: boolean;
  wipe_first: boolean;
}

// V20: detail of an EXTRA slot inserted via the bulk importer.
// planificacion_id is null in dry_run mode (row not committed).
export interface FilaExtraInsertada {
  planificacion_id: number | null;
  semana: number;
  dia: string;
  horario: string;
  taller_nombre: string;
  empresa_nombre: string;
  fila_excel: number;
}

// V20: one EXTRA row in GET /api/calendario/{trimestre}/extras.
export interface SlotExtraResponse {
  id: number;
  semana: number;
  dia: string;
  horario: string;
  taller_nombre: string;
  empresa_id: number | null;
  empresa_nombre: string | null;
  estado: EstadoSlot;
  confirmado: boolean;
  notas: string | null;
  motivo_cambio: string | null;
  created_at: string;
}

// V20: response of GET /api/calendario/{trimestre}/extras.
export interface ListaExtrasResponse {
  trimestre: string;
  total: number;
  extras: SlotExtraResponse[];
}

// V21: input for POST /api/planificacion/{trimestre}/extra.
// Backend validates the AND-rule (empresa is escuelaPropia in trimestre AND
// there is a colliding slot from another empresa) before inserting.
export interface CrearSlotExtraInput {
  empresa_id: number;
  semana: number; // 1..13
  dia: string;
  horario: string;
  taller_id: number;
  programa: "EF" | "IT";
  notas?: string | null;
}

// V21: input for PATCH /api/planificacion/{slotId}/extra.
// Both fields optional but the backend rejects (422) if both are omitted.
// notas: empty string clears it; null/undefined leaves it untouched.
export interface EditarSlotExtraInput {
  empresa_id?: number;
  notas?: string | null;
}

// ── V22 (Cambio A): DOBLE types ──────────────────────────────────

// One DOBLE row returned by POST/PATCH/GET in the doble router.
// Same shape as SlotExtraResponse plus taller_id and programa (so the UI can
// render the programa badge without re-joining).
export interface SlotDobleResponse {
  id: number;
  semana: number;
  dia: string;
  horario: string;
  taller_id: number;
  taller_nombre: string;
  programa: string; // "EF" | "IT" — left as string to mirror tipo_asignacion convention
  empresa_id: number | null;
  empresa_nombre: string | null;
  estado: EstadoSlot;
  confirmado: boolean;
  notas: string | null;
  created_at: string;
}

// Response of GET /api/planificacion/{trimestre}/dobles.
export interface ListaDoblesResponse {
  trimestre: string;
  total: number;
  dobles: SlotDobleResponse[];
}

// Input for POST /api/planificacion/{trimestre}/doble.
// Decision 4 of Cambio A: backend only checks empresa-activa + empresa-EP +
// taller-exists. NO collision check, NO programa check, NO duplicate check.
export interface CrearSlotDobleInput {
  empresa_id: number;
  semana: number; // 1..13
  dia: string;
  horario: string;
  taller_id: number;
  notas?: string | null;
}

// Input for PATCH /api/planificacion/{slotId}/doble.
// All fields optional; backend rejects 422 if none are set. Editable: empresa,
// taller, semana, día, horario, notas — much more permissive than EXTRA.
export interface EditarSlotDobleInput {
  empresa_id?: number;
  taller_id?: number;
  semana?: number;
  dia?: string;
  horario?: string;
  notas?: string | null;
}

// Response of DELETE /api/planificacion/{trimestre}/extras-doble?confirmar=true.
// Reports how many rows each bucket lost so the caller can confirm the cleanup
// happened. BASE/CONTINGENCIA are never touched by this endpoint.
export interface CleanupExtrasDobleResult {
  trimestre: string;
  confirmar: boolean;
  extras_eliminados: number;
  dobles_eliminados: number;
}

// ── V26 (edición unificada de slots) ─────────────────────────────

// Input para POST /api/calendario/{trimestre}/slots — crear un slot puntual
// (BASE o EXTRA) desde la UI Operación, reemplazando el flujo Excel→bulk.
// El gate EXTRA (permiteExtras) solo se aplica cuando tipo_asignacion='EXTRA'.
export interface CrearSlotInput {
  empresa_id: number;
  semana: number;  // 1..13
  dia: string;
  horario: string;
  taller_id: number;
  programa: "EF" | "IT";
  tipo_asignacion: "BASE" | "EXTRA";
  notas?: string | null;
}

// Response de DELETE /api/calendario/{trimestre}/slots/{slotId} — genérico
// BASE/EXTRA. Devuelve metadata del slot borrado para que el toast post-action
// pueda explicarle a la planificadora qué quedó descuadrado (motivo previo,
// confirmación previa, etc.). 409 si el trimestre ya está cerrado.
export interface EliminarSlotResult {
  deleted_id: number;
  tipo_asignacion: string;
  had_motivo_cambio: boolean;
  was_confirmado: boolean;
}

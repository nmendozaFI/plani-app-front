"use server";

import {
  generarCalendario,
  obtenerCalendario,
  obtenerFestivos,
  actualizarSlot,
  actualizarSlotsBatch,
  crearSlot,
  eliminarSlot,
  validarAsignacion,
  obtenerResumenOperacion,
  obtenerAnalisis,
  cerrarTrimestre,
  importarExcelCalendario,
  importarExcelCalendarioBulk,
  listarExtras,
  borrarSlotExtra,
  crearSlotExtra,
  editarSlotExtra,
  crearSlotDoble,
  listarDobles,
  editarSlotDoble,
  borrarSlotDoble,
  cleanupExtrasDoble,
} from "@/lib/api";
import { apiFetchServer } from "@/lib/api-client";
import type {
  CalendarioOutput,
  EstadoSlot,
  SlotCalendario,
  CalendarioResumen,
  CalendarioGetResponse,
  ListaFestivosResponse,
  SlotUpdateInput,
  SlotBatchUpdateItem,
  ImportarExcelResult,
  ImportarExcelBulkResult,
  ListaExtrasResponse,
  SlotExtraResponse,
  CrearSlotExtraInput,
  EditarSlotExtraInput,
  SlotDobleResponse,
  ListaDoblesResponse,
  CrearSlotDobleInput,
  EditarSlotDobleInput,
  CleanupExtrasDobleResult,
  ValidarAsignacionResult,
  CrearSlotInput,
  EliminarSlotResult,
} from "@/types/calendario";
import type { AnalisisResponse } from "@/types/analisis";
import type { ActionResult } from "@/types/actions";
import type { CerrarTrimestreResult } from "@/types/config-trimestral";

export async function actionGenerarCalendario(
  trimestre: string
): Promise<ActionResult<CalendarioOutput>> {
  try {
    const data = await generarCalendario(trimestre);
    return { ok: true, data };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al generar calendario";
    return { ok: false, error: msg };
  }
}

export async function actionObtenerCalendario(
  trimestre: string
): Promise<ActionResult<CalendarioGetResponse>> {
  try {
    const data = await obtenerCalendario(trimestre);
    return { ok: true, data };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al obtener calendario";
    return { ok: false, error: msg };
  }
}

// V26: festivos del trimestre, consumidos por la vista calendario mensual.
export async function actionListarFestivos(
  trimestre: string,
): Promise<ActionResult<ListaFestivosResponse>> {
  try {
    const data = await obtenerFestivos(trimestre);
    return { ok: true, data };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al obtener festivos";
    return { ok: false, error: msg };
  }
}

// ── Operación (Fase 3) ───────────────────────────────────────

export async function actionActualizarSlot(
  trimestre: string,
  slotId: number,
  data: SlotUpdateInput
): Promise<ActionResult<{ slot: SlotCalendario }>> {
  try {
    const result = await actualizarSlot(trimestre, slotId, data);
    return { ok: true, data: result };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al actualizar slot";
    return { ok: false, error: msg };
  }
}

export async function actionActualizarSlotsBatch(
  trimestre: string,
  updates: SlotBatchUpdateItem[]
): Promise<ActionResult<{ updated: number; errors: string[] }>> {
  try {
    const result = await actualizarSlotsBatch(trimestre, updates);
    return { ok: true, data: result };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al actualizar slots";
    return { ok: false, error: msg };
  }
}

// V26 (edición unificada): crea un slot puntual (BASE o EXTRA) desde la UI
// Operación. Reemplaza el Excel→bulk para añadidos mid-trimestre. El detail
// del backend (franja ocupada, permiteExtras, programa incoherente) se
// propaga verbatim para que el modal lo muestre tal cual.
export async function actionCrearSlot(
  trimestre: string,
  body: CrearSlotInput,
): Promise<ActionResult<SlotCalendario>> {
  try {
    const data = await crearSlot(trimestre, body);
    return { ok: true, data };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al crear slot";
    return { ok: false, error: msg };
  }
}

// V26 (edición unificada): borra un slot cualquiera (BASE o EXTRA). 409 si
// el trimestre ya está cerrado. Devuelve metadata del slot borrado para que
// el toast post-action explique qué pasó.
export async function actionEliminarSlot(
  trimestre: string,
  slotId: number,
): Promise<ActionResult<EliminarSlotResult>> {
  try {
    const data = await eliminarSlot(trimestre, slotId);
    return { ok: true, data };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al eliminar slot";
    return { ok: false, error: msg };
  }
}

export async function actionValidarAsignacion(
  trimestre: string,
  slotId: number,
  empresaId: number
): Promise<ActionResult<ValidarAsignacionResult>> {
  try {
    const data = await validarAsignacion(trimestre, slotId, empresaId);
    return { ok: true, data };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al validar asignacion";
    return { ok: false, error: msg };
  }
}

export async function actionObtenerResumen(
  trimestre: string
): Promise<ActionResult<CalendarioResumen>> {
  try {
    const data = await obtenerResumenOperacion(trimestre);
    return { ok: true, data };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al obtener resumen";
    return { ok: false, error: msg };
  }
}

// ── Cerrar Trimestre ─────────────────────────────────────────

export async function actionCerrarTrimestre(
  trimestre: string,
  confirmar: boolean
): Promise<ActionResult<CerrarTrimestreResult>> {
  try {
    const data = await cerrarTrimestre(trimestre, confirmar);
    return { ok: true, data };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al cerrar trimestre";
    return { ok: false, error: msg };
  }
}

// ── Importar Excel ───────────────────────────────────────────

export async function actionImportarExcelCalendario(
  trimestre: string,
  file: File,
  dryRun: boolean = false
): Promise<ActionResult<ImportarExcelResult>> {
  try {
    const data = await importarExcelCalendario(trimestre, file, dryRun);
    return { ok: true, data };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al importar Excel";
    return { ok: false, error: msg };
  }
}

// V19: bulk INSERT calendar import.
// wipeFirst=true → backend deletes all planificacion rows for the trimestre first.
// wipeFirst=false + rows already exist → backend returns 409; surface to caller.
export async function actionImportarExcelCalendarioBulk(
  trimestre: string,
  file: File,
  wipeFirst: boolean = false
): Promise<ActionResult<ImportarExcelBulkResult>> {
  try {
    const data = await importarExcelCalendarioBulk(trimestre, file, wipeFirst, false);
    return { ok: true, data };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al importar Excel (bulk)";
    return { ok: false, error: msg };
  }
}

// ── EXTRAS (V20) ─────────────────────────────────────────────

export async function actionListarExtras(
  trimestre: string,
  estados?: EstadoSlot[]
): Promise<ActionResult<ListaExtrasResponse>> {
  try {
    const data = await listarExtras(trimestre, estados);
    return { ok: true, data };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al listar EXTRAS";
    return { ok: false, error: msg };
  }
}

export async function actionBorrarSlotExtra(
  slotId: number
): Promise<ActionResult<{ slot_id: number }>> {
  try {
    await borrarSlotExtra(slotId);
    return { ok: true, data: { slot_id: slotId } };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al borrar slot EXTRA";
    return { ok: false, error: msg };
  }
}

// V21: create one EXTRA slot. The backend's detail message (regla AND, EP,
// colisión, duplicado) is propagated verbatim so the UI can show it as-is.
export async function actionCrearSlotExtra(
  trimestre: string,
  body: CrearSlotExtraInput
): Promise<ActionResult<SlotExtraResponse>> {
  try {
    const data = await crearSlotExtra(trimestre, body);
    return { ok: true, data };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al crear slot EXTRA";
    return { ok: false, error: msg };
  }
}

// V21: edit empresa and/or notas of an existing EXTRA slot.
export async function actionEditarSlotExtra(
  slotId: number,
  body: EditarSlotExtraInput
): Promise<ActionResult<SlotExtraResponse>> {
  try {
    const data = await editarSlotExtra(slotId, body);
    return { ok: true, data };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al editar slot EXTRA";
    return { ok: false, error: msg };
  }
}

// ── V22 (Cambio A): DOBLE CRUD ───────────────────────────────
// Decision 4: backend only gates by escuelaPropia + empresa-activa + taller.
// No collision, no programa check, no duplicate check — frontend trusts the
// detail message from the backend and surfaces it verbatim on error.

export async function actionCrearDoble(
  trimestre: string,
  body: CrearSlotDobleInput
): Promise<ActionResult<SlotDobleResponse>> {
  try {
    const data = await crearSlotDoble(trimestre, body);
    return { ok: true, data };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al crear slot DOBLE";
    return { ok: false, error: msg };
  }
}

// Optional filters: semana (1..13) and empresaId.
// Empty list → 200 (NOT 404) when no DOBLE rows match.
export async function actionListarDobles(
  trimestre: string,
  filters?: { semana?: number; empresaId?: number }
): Promise<ActionResult<ListaDoblesResponse>> {
  try {
    const data = await listarDobles(trimestre, filters);
    return { ok: true, data };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al listar DOBLEs";
    return { ok: false, error: msg };
  }
}

// Full-freedom PATCH: empresa, taller, semana, día, horario, notas.
// Backend rejects (422) if body has no fields set.
export async function actionEditarDoble(
  slotId: number,
  body: EditarSlotDobleInput
): Promise<ActionResult<SlotDobleResponse>> {
  try {
    const data = await editarSlotDoble(slotId, body);
    return { ok: true, data };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al editar slot DOBLE";
    return { ok: false, error: msg };
  }
}

// Guarded to tipoAsignacion='DOBLE': 400 if it's not, 404 if id unknown.
export async function actionBorrarDoble(
  slotId: number
): Promise<ActionResult<{ slot_id: number }>> {
  try {
    await borrarSlotDoble(slotId);
    return { ok: true, data: { slot_id: slotId } };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al borrar slot DOBLE";
    return { ok: false, error: msg };
  }
}

// Bulk cleanup of EXTRA+DOBLE for a trimestre. Caller must pass
// confirmar=true; the backend returns 400 if it's false. BASE/CONTINGENCIA
// rows are untouched.
export async function actionCleanupExtrasDoble(
  trimestre: string,
  confirmar: boolean
): Promise<ActionResult<CleanupExtrasDobleResult>> {
  try {
    const data = await cleanupExtrasDoble(trimestre, confirmar);
    return { ok: true, data };
  } catch (e: unknown) {
    const msg =
      e instanceof Error ? e.message : "Error al ejecutar cleanup extras-doble";
    return { ok: false, error: msg };
  }
}

// ── Analisis: Planificado vs Realizado ───────────────────────

export async function actionObtenerAnalisis(
  trimestre: string
): Promise<ActionResult<AnalisisResponse>> {
  try {
    const data = await obtenerAnalisis(trimestre);
    return { ok: true, data };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al obtener analisis";
    return { ok: false, error: msg };
  }
}

// ── Recalcular Scores ────────────────────────────────────────

export interface RecalcularScoresResult {
  empresas_actualizadas: number;
  detalle: Array<{
    empresa_id: number;
    empresa_nombre: string;
    score_v3: number;
    semaforo: string;
    fiabilidad_reciente: number;
    total_asignado: number;
    cumplidos: number;
    cancelados_empresa: number;
  }>;
  warnings: string[];
}

export async function actionRecalcularScores(): Promise<ActionResult<RecalcularScoresResult>> {
  try {
    const data = await apiFetchServer<RecalcularScoresResult>(
      "/api/calendario/recalcular-scores",
      { method: "POST" }
    );
    return { ok: true, data };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al recalcular scores";
    return { ok: false, error: msg };
  }
}
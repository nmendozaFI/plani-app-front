"use server";

import {
  generarCalendario,
  obtenerCalendario,
  actualizarSlot,
  actualizarSlotsBatch,
  validarAsignacion,
  obtenerResumenOperacion,
  obtenerAnalisis,
  cerrarTrimestre,
  importarExcelCalendario,
  importarExcelCalendarioBulk,
  listarExtras,
  borrarSlotExtra,
} from "@/lib/api";
import { apiFetchServer } from "@/lib/api-client";
import type {
  CalendarioOutput,
  EstadoSlot,
  SlotCalendario,
  CalendarioResumen,
  CalendarioGetResponse,
  SlotUpdateInput,
  SlotBatchUpdateItem,
  ImportarExcelResult,
  ImportarExcelBulkResult,
  ListaExtrasResponse,
  ValidarAsignacionResult,
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
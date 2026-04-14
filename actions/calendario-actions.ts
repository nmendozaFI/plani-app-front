"use server";

import {
  generarCalendario,
  obtenerCalendario,
  actualizarSlot,
  actualizarSlotsBatch,
  obtenerResumenOperacion,
  cerrarTrimestre,
  importarExcelCalendario,
} from "@/lib/api";
import type {
  CalendarioOutput,
  SlotCalendario,
  CalendarioResumen,
  CalendarioGetResponse,
  SlotUpdateInput,
  SlotBatchUpdateItem,
  ImportarExcelResult,
} from "@/types/calendario";
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
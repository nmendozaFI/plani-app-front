"use server";

import {
  obtenerCalendarioAnual,
  inicializarCalendarioAnual,
  actualizarSemanaConfig,
  actualizarSemanasConfigBatch,
  obtenerSemanaDetalle,
  crearExtraSlot,
  eliminarExtraSlot,
  obtenerResumenTrimestre,
} from "@/lib/api";
import type {
  SemanaConfigOut,
  SemanaConfigUpdate,
  SemanaDetalleOut,
  SemanaExtraSlotOut,
  SemanaExtraSlotCreate,
  CalendarioAnualResumen,
  BatchUpdateResult,
} from "@/types/taller";
import type { ActionResult } from "@/types/actions";

export async function actionObtenerCalendarioAnual(
  anio: number
): Promise<ActionResult<SemanaConfigOut[]>> {
  try {
    const data = await obtenerCalendarioAnual(anio);
    return { ok: true, data };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { ok: false, error: msg };
  }
}

export async function actionInicializarCalendarioAnual(
  anio: number,
  template?: "estandar_madrid"
): Promise<ActionResult<{ message: string; created: number; template_applied: string | null }>> {
  try {
    const data = await inicializarCalendarioAnual(anio, template);
    return { ok: true, data };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { ok: false, error: msg };
  }
}

export async function actionActualizarSemanaConfig(
  anio: number,
  semana: number,
  data: SemanaConfigUpdate
): Promise<ActionResult<SemanaConfigOut>> {
  try {
    const result = await actualizarSemanaConfig(anio, semana, data);
    return { ok: true, data: result };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { ok: false, error: msg };
  }
}

export async function actionActualizarSemanasConfigBatch(
  anio: number,
  updates: Array<{ semana: number; tipo?: "normal" | "intensiva"; notas?: string | null }>
): Promise<ActionResult<BatchUpdateResult>> {
  try {
    const data = await actualizarSemanasConfigBatch(anio, updates);
    return { ok: true, data };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { ok: false, error: msg };
  }
}

export async function actionObtenerSemanaDetalle(
  anio: number,
  semana: number
): Promise<ActionResult<SemanaDetalleOut>> {
  try {
    const data = await obtenerSemanaDetalle(anio, semana);
    return { ok: true, data };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { ok: false, error: msg };
  }
}

export async function actionCrearExtraSlot(
  anio: number,
  semana: number,
  data: SemanaExtraSlotCreate
): Promise<ActionResult<SemanaExtraSlotOut>> {
  try {
    const result = await crearExtraSlot(anio, semana, data);
    return { ok: true, data: result };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { ok: false, error: msg };
  }
}

export async function actionEliminarExtraSlot(
  extraId: number
): Promise<ActionResult<{ ok: boolean }>> {
  try {
    const data = await eliminarExtraSlot(extraId);
    return { ok: true, data };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { ok: false, error: msg };
  }
}

export async function actionObtenerResumenTrimestre(
  anio: number,
  quarter: number
): Promise<ActionResult<CalendarioAnualResumen & { talleres_ef_total: number; talleres_it_total: number }>> {
  try {
    const data = await obtenerResumenTrimestre(anio, quarter);
    return { ok: true, data };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { ok: false, error: msg };
  }
}

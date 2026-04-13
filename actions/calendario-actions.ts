"use server";

import { generarCalendario, obtenerCalendario } from "@/lib/api";
import type { CalendarioOutput, SlotCalendario } from "@/types/calendario";
import type { ActionResult } from "@/types/actions";

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
): Promise<ActionResult<{ trimestre: string; total_slots: number; slots: SlotCalendario[] }>> {
  try {
    const data = await obtenerCalendario(trimestre);
    return { ok: true, data };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al obtener calendario";
    return { ok: false, error: msg };
  }
}
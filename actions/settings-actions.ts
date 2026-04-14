"use server";

import {
  obtenerSettings,
  actualizarSettings,
  promoverTrimestre,
} from "@/lib/api";
import type {
  AppSettings,
  AppSettingsUpdate,
  PromoverResult,
} from "@/types/settings";
import type { ActionResult } from "@/types/actions";

export async function actionObtenerSettings(): Promise<ActionResult<AppSettings>> {
  try {
    const data = await obtenerSettings();
    return { ok: true, data };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al obtener settings";
    return { ok: false, error: msg };
  }
}

export async function actionActualizarSettings(
  data: AppSettingsUpdate
): Promise<ActionResult<AppSettings>> {
  try {
    const result = await actualizarSettings(data);
    return { ok: true, data: result };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al actualizar settings";
    return { ok: false, error: msg };
  }
}

export async function actionPromoverTrimestre(): Promise<ActionResult<PromoverResult>> {
  try {
    const data = await promoverTrimestre();
    return { ok: true, data };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al promover trimestre";
    return { ok: false, error: msg };
  }
}

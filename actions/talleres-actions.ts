"use server";

import {
  obtenerTalleres,
  crearTallerApi,
  editarTallerApi,
  eliminarTallerApi,
} from "@/lib/api";
import type {
  TallerOut,
  TallerCreate,
  TallerUpdate,
} from "@/types/taller";
import type { ActionResult } from "@/types/actions";

export async function actionObtenerTalleres(
  programa?: string,
  soloActivos?: boolean
): Promise<ActionResult<TallerOut[]>> {
  try {
    const data = await obtenerTalleres(programa, soloActivos);
    return { ok: true, data };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { ok: false, error: msg };
  }
}

export async function actionCrearTaller(
  taller: TallerCreate
): Promise<ActionResult<TallerOut>> {
  try {
    const data = await crearTallerApi(taller);
    return { ok: true, data };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { ok: false, error: msg };
  }
}

export async function actionEditarTaller(
  id: number,
  taller: TallerUpdate
): Promise<ActionResult<TallerOut>> {
  try {
    const data = await editarTallerApi(id, taller);
    return { ok: true, data };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { ok: false, error: msg };
  }
}

export async function actionEliminarTaller(
  id: number
): Promise<ActionResult> {
  try {
    await eliminarTallerApi(id);
    return { ok: true, data: undefined };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { ok: false, error: msg };
  }
}

"use server";

import {
  obtenerTalleres,
  crearTallerApi,
  editarTallerApi,
  eliminarTallerApi,
} from "@/lib/api";
import type { TallerOut, TallerCreate, TallerUpdate } from "@/lib/api";

export async function actionObtenerTalleres(
  programa?: string,
  soloActivos?: boolean
): Promise<{ data: TallerOut[] | null; error: string | null }> {
  try {
    const data = await obtenerTalleres(programa, soloActivos);
    return { data, error: null };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { data: null, error: msg };
  }
}

export async function actionCrearTaller(
  taller: TallerCreate
): Promise<{ data: TallerOut | null; error: string | null }> {
  try {
    const data = await crearTallerApi(taller);
    return { data, error: null };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { data: null, error: msg };
  }
}

export async function actionEditarTaller(
  id: number,
  taller: TallerUpdate
): Promise<{ data: TallerOut | null; error: string | null }> {
  try {
    const data = await editarTallerApi(id, taller);
    return { data, error: null };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { data: null, error: msg };
  }
}

export async function actionEliminarTaller(
  id: number
): Promise<{ ok: boolean; error: string | null }> {
  try {
    await eliminarTallerApi(id);
    return { ok: true, error: null };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { ok: false, error: msg };
  }
}
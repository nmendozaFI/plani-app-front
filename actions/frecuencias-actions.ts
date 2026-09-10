"use server";

import { calcularFrecuencias, confirmarFrecuencias, obtenerFrecuencias } from "@/lib/api";
import type {
  FrecuenciaOutput,
  ConfirmarOutput,
  ConfirmarEmpresa,
} from "@/types/frecuencia";
import type { ActionResult } from "@/types/actions";

export async function actionCalcularFrecuencias(
  trimestre: string,
  trimestreAnterior?: string
): Promise<ActionResult<FrecuenciaOutput>> {
  try {
    const data = await calcularFrecuencias(trimestre, trimestreAnterior);
    return { ok: true, data };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al calcular frecuencias";
    return { ok: false, error: msg };
  }
}

// V31 Capa 0a: lee las frecuencias YA persistidas (tabla frecuencia) para el
// diff del diálogo de confirmación (antes → después).
export async function actionObtenerFrecuencias(
  trimestre: string,
): Promise<ActionResult<Awaited<ReturnType<typeof obtenerFrecuencias>>>> {
  try {
    const data = await obtenerFrecuencias(trimestre);
    return { ok: true, data };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al obtener frecuencias";
    return { ok: false, error: msg };
  }
}

export async function actionConfirmarFrecuencias(
  trimestre: string,
  empresas: ConfirmarEmpresa[],
  force: boolean = false, // V31 Capa 0a
): Promise<ActionResult<ConfirmarOutput>> {
  try {
    const data = await confirmarFrecuencias(trimestre, empresas, force);
    return { ok: true, data };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al confirmar frecuencias";
    return { ok: false, error: msg };
  }
}
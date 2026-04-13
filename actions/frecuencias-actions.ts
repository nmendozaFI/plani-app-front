"use server";

import { calcularFrecuencias, confirmarFrecuencias } from "@/lib/api";
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

export async function actionConfirmarFrecuencias(
  trimestre: string,
  empresas: ConfirmarEmpresa[]
): Promise<ActionResult<ConfirmarOutput>> {
  try {
    const data = await confirmarFrecuencias(trimestre, empresas);
    return { ok: true, data };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al confirmar frecuencias";
    return { ok: false, error: msg };
  }
}
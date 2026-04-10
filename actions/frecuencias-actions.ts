"use server";

import {
  calcularFrecuencias,
  confirmarFrecuencias,
  type FrecuenciaOutput,
  type ConfirmarOutput,
  type ConfirmarEmpresa,
} from "@/lib/api";

export async function actionCalcularFrecuencias(
  trimestre: string,
  trimestreAnterior?: string
): Promise<{ data?: FrecuenciaOutput; error?: string }> {
  try {
    const data = await calcularFrecuencias(trimestre, trimestreAnterior);
    return { data };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    return { error: e.message || "Error al calcular frecuencias" };
  }
}

export async function actionConfirmarFrecuencias(
  trimestre: string,
  empresas: ConfirmarEmpresa[]
): Promise<{ data?: ConfirmarOutput; error?: string }> {
  try {
    const data = await confirmarFrecuencias(trimestre, empresas);
    return { data };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    return { error: e.message || "Error al confirmar frecuencias" };
  }
}
"use server";

import {
  obtenerConfigsTrimestre,
  obtenerConfigResumen,
  actualizarConfigTrimestral,
  actualizarConfigsBatch,
  inicializarConfigTrimestral,
} from "@/lib/api";
import type {
  ConfigTrimestralUpdate,
  ConfigBatchUpdateItem,
} from "@/types/config-trimestral";

export async function actionObtenerConfigsTrimestre(trimestre: string) {
  try {
    const result = await obtenerConfigsTrimestre(trimestre);
    return { data: result, error: null };
  } catch (e) {
    return { data: null, error: (e as Error).message };
  }
}

export async function actionObtenerConfigResumen(trimestre: string) {
  try {
    const result = await obtenerConfigResumen(trimestre);
    return { data: result, error: null };
  } catch (e) {
    return { data: null, error: (e as Error).message };
  }
}

export async function actionActualizarConfigTrimestral(
  trimestre: string,
  empresaId: number,
  data: ConfigTrimestralUpdate
) {
  try {
    const result = await actualizarConfigTrimestral(trimestre, empresaId, data);
    return { data: result, error: null };
  } catch (e) {
    return { data: null, error: (e as Error).message };
  }
}

export async function actionActualizarConfigsBatch(
  trimestre: string,
  updates: ConfigBatchUpdateItem[]
) {
  try {
    const result = await actualizarConfigsBatch(trimestre, updates);
    return { data: result, error: null };
  } catch (e) {
    return { data: null, error: (e as Error).message };
  }
}

export async function actionInicializarConfigTrimestral(
  trimestre: string,
  origenTrimestre?: string
) {
  try {
    const result = await inicializarConfigTrimestral(trimestre, origenTrimestre);
    return { data: result, error: null };
  } catch (e) {
    return { data: null, error: (e as Error).message };
  }
}

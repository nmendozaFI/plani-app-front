"use server";

import {
  obtenerConfigsTrimestre,
  obtenerConfigResumen,
  actualizarConfigTrimestral,
  actualizarConfigsBatch,
  inicializarConfigTrimestral,
  importarConfigExcel,
  listarEmpresasEP,
} from "@/lib/api";
import type {
  ConfigTrimestralUpdate,
  ConfigBatchUpdateItem,
  ListaEmpresasEPResponse,
} from "@/types/config-trimestral";
import type { ActionResult } from "@/types/actions";

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

export async function actionImportarConfigExcel(
  trimestre: string,
  file: File,
  dryRun: boolean = true
) {
  try {
    const result = await importarConfigExcel(trimestre, file, dryRun);
    return { data: result, error: null };
  } catch (e) {
    return { data: null, error: (e as Error).message };
  }
}

// V21 / F3a: list empresas with escuelaPropia=true for the trimestre. Uses
// the F2 ActionResult<T> wrapper (older actions in this file still use the
// legacy { data, error } shape). The modal "Añadir EXTRA" calls this on mount
// to populate its empresa Select.
export async function actionListarEmpresasEP(
  trimestre: string
): Promise<ActionResult<ListaEmpresasEPResponse>> {
  try {
    const data = await listarEmpresasEP(trimestre);
    return { ok: true, data };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al listar empresas EP";
    return { ok: false, error: msg };
  }
}

"use server";

import {
  obtenerTrimestresHistorico,
  obtenerHistoricoTrimestre,
  exportarHistoricoExcel,
  type HistoricoTrimestreResponse,
} from "@/lib/api";
import type { ActionResult } from "@/types/actions";

export async function actionObtenerTrimestresHistorico(): Promise<
  ActionResult<{ trimestres: string[] }>
> {
  try {
    const data = await obtenerTrimestresHistorico();
    return { ok: true, data };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al obtener trimestres";
    return { ok: false, error: msg };
  }
}

export async function actionObtenerHistoricoTrimestre(
  trimestre: string
): Promise<ActionResult<HistoricoTrimestreResponse>> {
  try {
    const data = await obtenerHistoricoTrimestre(trimestre);
    return { ok: true, data };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al obtener historico";
    return { ok: false, error: msg };
  }
}

export async function actionExportarHistoricoExcel(
  trimestre: string
): Promise<ActionResult<{ url: string }>> {
  try {
    const blob = await exportarHistoricoExcel(trimestre);
    // Return the blob as a base64 string for client-side download
    const buffer = await blob.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const dataUrl = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`;
    return { ok: true, data: { url: dataUrl } };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al exportar Excel";
    return { ok: false, error: msg };
  }
}

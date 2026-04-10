/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import {
  generarCalendario,
  obtenerCalendario,
  exportarExcel,
  type CalendarioOutput,
} from "@/lib/api";

export async function actionGenerarCalendario(
  trimestre: string
): Promise<{ data?: CalendarioOutput; error?: string }> {
  try {
    const data = await generarCalendario(trimestre);
    return { data };
  } catch (e: any) {
    return { error: e.message || "Error al generar calendario" };
  }
}

export async function actionObtenerCalendario(
  trimestre: string
): Promise<{ data?: { trimestre: string; total_slots: number; slots: any[] }; error?: string }> {
  try {
    const data = await obtenerCalendario(trimestre);
    return { data };
  } catch (e: any) {
    return { error: e.message || "Error al obtener calendario" };
  }
}
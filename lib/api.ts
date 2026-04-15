/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Cliente API para comunicarse con el backend FastAPI.
 * Centraliza todas las llamadas HTTP con manejo de errores.
 */

import { apiFetch, apiFetchBlob, apiUpload } from "./api-client";

// ── Re-export types from canonical source ────────────────────
export type {
  FrecuenciaEmpresa,
  RecorteDetalle,
  FrecuenciaOutput,
  ConfirmarEmpresa,
  ConfirmarOutput,
} from "@/types/frecuencia";

export type {
  SugerenciaContingencia,
  SlotCalendario,
  CalendarioOutput,
  CalendarioResumen,
  CalendarioGetResponse,
  SlotUpdateInput,
  SlotBatchUpdateItem,
  EmpresaCambiada,
  ImportarExcelResult,
} from "@/types/calendario";

export type {
  ImportEmpresasResult,
  ImportHistoricoResult,
  EstadoImportacion,
  ClonarTrimestreResult,
} from "@/types/importacion";

export type {
  Restriccion,
} from "@/types/restriccion";

export type {
  TallerOut,
  TallerCreate,
  TallerUpdate,
} from "@/types/taller";

export type {
  Empresa,
  EmpresaFull,
  EmpresaCreateInput,
  EmpresaUpdateInput,
  EmpresaSimple,
} from "@/types/empresa";

export type {
  ConfigTrimestralOut,
  ConfigTrimestralUpdate,
  ConfigBatchUpdateItem,
  ConfigTrimestralListResponse,
  ConfigTrimestralResumen,
  InicializarConfigResult,
  CerrarTrimestreResult,
  ImportarConfigExcelResult,
  ImportPreviewItem,
} from "@/types/config-trimestral";

export type {
  AppSettings,
  AppSettingsUpdate,
  PromoverResult,
  PlanningStatus,
} from "@/types/settings";

export type {
  EmpresaAnalisis,
  CambioSlot,
  AnalisisResumen,
  AnalisisResponse,
} from "@/types/analisis";

// Import types for use in this file
import type {
  FrecuenciaOutput,
  ConfirmarEmpresa,
  ConfirmarOutput,
} from "@/types/frecuencia";

import type {
  CalendarioOutput,
  SlotCalendario,
  CalendarioResumen,
  CalendarioGetResponse,
  SlotUpdateInput,
  SlotBatchUpdateItem,
  ImportarExcelResult,
} from "@/types/calendario";

import type { AnalisisResponse } from "@/types/analisis";

import type {
  ImportEmpresasResult,
  ImportHistoricoResult,
  EstadoImportacion,
  ClonarTrimestreResult,
} from "@/types/importacion";

import type { Restriccion } from "@/types/restriccion";

import type {
  TallerOut,
  TallerCreate,
  TallerUpdate,
} from "@/types/taller";

import type {
  EmpresaFull,
  EmpresaCreateInput,
  EmpresaUpdateInput,
  EmpresaSimple,
} from "@/types/empresa";

import type {
  ConfigTrimestralOut,
  ConfigTrimestralUpdate,
  ConfigBatchUpdateItem,
  ConfigTrimestralListResponse,
  ConfigTrimestralResumen,
  InicializarConfigResult,
  CerrarTrimestreResult,
  ImportarConfigExcelResult,
} from "@/types/config-trimestral";

import type {
  AppSettings,
  AppSettingsUpdate,
  PromoverResult,
  PlanningStatus,
} from "@/types/settings";

// ── Frecuencias (Fase 1) ─────────────────────────────────────

export async function calcularFrecuencias(
  trimestre: string,
  trimestreAnterior?: string
): Promise<FrecuenciaOutput> {
  return apiFetch<FrecuenciaOutput>("/api/frecuencias/calcular", {
    method: "POST",
    body: JSON.stringify({
      trimestre,
      trimestre_anterior: trimestreAnterior || null,
    }),
  });
}

export async function confirmarFrecuencias(
  trimestre: string,
  empresas: ConfirmarEmpresa[]
): Promise<ConfirmarOutput> {
  return apiFetch<ConfirmarOutput>("/api/frecuencias/confirmar", {
    method: "POST",
    body: JSON.stringify({ trimestre, empresas }),
  });
}

export async function obtenerFrecuencias(trimestre: string) {
  return apiFetch<{ trimestre: string; frecuencias: any[] }>(
    `/api/frecuencias/${trimestre}`
  );
}

// ── Calendario (Fase 2) ──────────────────────────────────────

export async function generarCalendario(
  trimestre: string
): Promise<CalendarioOutput> {
  return apiFetch<CalendarioOutput>("/api/calendario/generar", {
    method: "POST",
    body: JSON.stringify({ trimestre }),
  });
}

export async function obtenerCalendario(trimestre: string) {
  return apiFetch<CalendarioGetResponse>(
    `/api/calendario/${trimestre}`
  );
}

export async function exportarExcel(trimestre: string): Promise<Blob> {
  return apiFetchBlob(`/api/calendario/${trimestre}/exportar-excel`, { method: "POST" });
}

// ── Operación (Fase 3) ───────────────────────────────────────

export async function actualizarSlot(
  trimestre: string,
  slotId: number,
  data: SlotUpdateInput
): Promise<{ slot: SlotCalendario }> {
  return apiFetch<{ slot: SlotCalendario }>(
    `/api/calendario/${trimestre}/slots/${slotId}`,
    {
      method: "PATCH",
      body: JSON.stringify(data),
    }
  );
}

export async function actualizarSlotsBatch(
  trimestre: string,
  updates: SlotBatchUpdateItem[]
): Promise<{ updated: number; errors: string[] }> {
  return apiFetch<{ updated: number; errors: string[] }>(
    `/api/calendario/${trimestre}/slots-batch`,
    {
      method: "PATCH",
      body: JSON.stringify({ updates }),
    }
  );
}

export async function obtenerResumenOperacion(
  trimestre: string
): Promise<CalendarioResumen> {
  return apiFetch<CalendarioResumen>(
    `/api/calendario/${trimestre}/resumen`
  );
}

export async function obtenerAnalisis(
  trimestre: string
): Promise<AnalisisResponse> {
  return apiFetch<AnalisisResponse>(
    `/api/calendario/${trimestre}/analisis`
  );
}

export async function importarExcelCalendario(
  trimestre: string,
  file: File,
  dryRun: boolean = false
): Promise<ImportarExcelResult> {
  const formData = new FormData();
  formData.append("file", file);
  return apiUpload<ImportarExcelResult>(
    `/api/calendario/${trimestre}/importar-excel-file?dry_run=${dryRun}`,
    formData
  );
}

// ── Empresas ─────────────────────────────────────────────────

export async function obtenerEmpresas(): Promise<EmpresaSimple[]> {
  const res = await apiFetch<{ empresas: EmpresaSimple[] }>("/api/empresas");
  return res.empresas;
}

// ── Importación masiva ───────────────────────────────────────

export async function importarEmpresas(
  file: File,
  trimestre: string
): Promise<ImportEmpresasResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("trimestre", trimestre);
  return apiUpload<ImportEmpresasResult>("/api/importar/empresas", formData);
}

export async function importarHistorico(
  file: File,
  trimestre: string
): Promise<ImportHistoricoResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("trimestre", trimestre);
  return apiUpload<ImportHistoricoResult>("/api/importar/historico", formData);
}

export async function obtenerEstadoImportacion(
  trimestre: string
): Promise<EstadoImportacion> {
  return apiFetch<EstadoImportacion>(`/api/importar/estado/${trimestre}`);
}

// ── Clonación de trimestre ────────────────────────────────────

export async function clonarTrimestre(
  trimestreOrigen: string,
  trimestreDestino: string
): Promise<ClonarTrimestreResult> {
  const formData = new FormData();
  formData.append("trimestre_origen", trimestreOrigen);
  formData.append("trimestre_destino", trimestreDestino);
  return apiUpload<ClonarTrimestreResult>("/api/importar/clonar-trimestre", formData);
}

// ── Restricciones ─────────────────────────────────────────────

export async function obtenerRestricciones(empresaId?: number): Promise<Restriccion[]> {
  const path = empresaId ? `/api/restricciones/${empresaId}` : "/api/restricciones";
  return apiFetch<Restriccion[]>(path);
}

// ── Talleres ──────────────────────────────────────────────────

export async function obtenerTalleres(
  programa?: string,
  soloActivos?: boolean
): Promise<TallerOut[]> {
  const params = new URLSearchParams();
  if (programa) params.set("programa", programa);
  if (soloActivos !== undefined) params.set("solo_activos", String(soloActivos));
  const qs = params.toString();
  return apiFetch<TallerOut[]>(`/api/talleres${qs ? `?${qs}` : ""}`);
}

export async function crearTallerApi(data: TallerCreate): Promise<TallerOut> {
  return apiFetch<TallerOut>("/api/talleres", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function editarTallerApi(id: number, data: TallerUpdate): Promise<TallerOut> {
  return apiFetch<TallerOut>(`/api/talleres/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function eliminarTallerApi(id: number): Promise<void> {
  await apiFetch<{ ok: boolean }>(`/api/talleres/${id}`, { method: "DELETE" });
}

// ── Empresas (CRUD) ──────────────────────────────────────────

export async function obtenerEmpresasFull(filters?: {
  activa?: boolean;
  tipo?: string;
  semaforo?: string;
  search?: string;
}): Promise<EmpresaFull[]> {
  const params = new URLSearchParams();
  if (filters?.activa !== undefined) params.set("activa", String(filters.activa));
  if (filters?.tipo) params.set("tipo", filters.tipo);
  if (filters?.semaforo) params.set("semaforo", filters.semaforo);
  if (filters?.search) params.set("search", filters.search);
  const qs = params.toString();
  const res = await apiFetch<{ empresas: EmpresaFull[] }>(
    `/api/empresas${qs ? `?${qs}` : ""}`
  );
  return res.empresas;
}
 
export async function obtenerEmpresaDetalle(empresaId: number) {
  return apiFetch<{
    empresa: EmpresaFull & { createdAt: string; updatedAt: string };
    restricciones: { id: number; tipo: string; clave: string; valor: string; descripcion: string | null }[];
    ciudades: { id: number; nombre: string; activaReciente: boolean }[];
    historico_reciente: { trimestre: string; total: number; ok: number; cancelados: number }[];
  }>(`/api/empresas/${empresaId}`);
}
 
export async function crearEmpresaApi(data: EmpresaCreateInput): Promise<EmpresaFull> {
  const res = await apiFetch<{ empresa: EmpresaFull }>("/api/empresas", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return res.empresa;
}
 
export async function editarEmpresaApi(id: number, data: EmpresaUpdateInput): Promise<EmpresaFull> {
  const res = await apiFetch<{ empresa: EmpresaFull }>(`/api/empresas/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  return res.empresa;
}
 
export async function toggleEmpresaApi(id: number): Promise<{ id: number; activa: boolean }> {
  return apiFetch<{ id: number; activa: boolean }>(`/api/empresas/${id}/toggle`, {
    method: "PATCH",
  });
}

// ── Config Trimestral ────────────────────────────────────────

export async function obtenerConfigsTrimestre(
  trimestre: string
): Promise<ConfigTrimestralListResponse> {
  return apiFetch<ConfigTrimestralListResponse>(
    `/api/config-trimestral/${trimestre}`
  );
}

export async function obtenerConfigResumen(
  trimestre: string
): Promise<ConfigTrimestralResumen> {
  return apiFetch<ConfigTrimestralResumen>(
    `/api/config-trimestral/${trimestre}/resumen`
  );
}

export async function actualizarConfigTrimestral(
  trimestre: string,
  empresaId: number,
  data: ConfigTrimestralUpdate
): Promise<{ config: ConfigTrimestralOut }> {
  return apiFetch<{ config: ConfigTrimestralOut }>(
    `/api/config-trimestral/${trimestre}/${empresaId}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    }
  );
}

export async function actualizarConfigsBatch(
  trimestre: string,
  updates: ConfigBatchUpdateItem[]
): Promise<{ updated: number; errors: string[] }> {
  return apiFetch<{ updated: number; errors: string[] }>(
    `/api/config-trimestral/${trimestre}/batch`,
    {
      method: "PUT",
      body: JSON.stringify({ updates }),
    }
  );
}

export async function inicializarConfigTrimestral(
  trimestre: string,
  origenTrimestre?: string
): Promise<InicializarConfigResult> {
  return apiFetch<InicializarConfigResult>(
    `/api/config-trimestral/${trimestre}/inicializar`,
    {
      method: "POST",
      body: JSON.stringify({ origen_trimestre: origenTrimestre || null }),
    }
  );
}

export async function importarConfigExcel(
  trimestre: string,
  file: File,
  dryRun: boolean = true
): Promise<ImportarConfigExcelResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("dry_run", dryRun ? "true" : "false");
  return apiUpload<ImportarConfigExcelResult>(
    `/api/config-trimestral/${trimestre}/importar-excel`,
    formData
  );
}

// ── Cerrar Trimestre ─────────────────────────────────────────

export async function cerrarTrimestre(
  trimestre: string,
  confirmar: boolean
): Promise<CerrarTrimestreResult> {
  return apiFetch<CerrarTrimestreResult>(
    `/api/calendario/${trimestre}/cerrar`,
    {
      method: "POST",
      body: JSON.stringify({ confirmar }),
    }
  );
}

// ── Settings (App Settings) ──────────────────────────────────

export async function obtenerSettings(): Promise<AppSettings> {
  return apiFetch<AppSettings>("/api/settings/");
}

export async function obtenerPlanningStatus(): Promise<PlanningStatus> {
  return apiFetch<PlanningStatus>("/api/settings/status");
}

export async function actualizarSettings(
  data: AppSettingsUpdate
): Promise<AppSettings> {
  return apiFetch<AppSettings>("/api/settings/", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function promoverTrimestre(): Promise<PromoverResult> {
  return apiFetch<PromoverResult>("/api/settings/promover", {
    method: "POST",
  });
}

// ── Histórico ────────────────────────────────────────────────

export interface HistoricoRegistro {
  id: number;
  empresa_id: number;
  empresa_nombre: string;
  taller_id: number;
  taller_nombre: string;
  programa: string;
  dia: string;
  turno: string;
  horario: string;
  fecha: string;
  estado: string;
  ciudad: string | null;
  trimestre: string;
  semana_abs: number;
}

export interface HistoricoTrimestreResponse {
  trimestre: string;
  total: number;
  ok: number;
  cancelados: number;
  registros: HistoricoRegistro[];
}

export async function obtenerTrimestresHistorico(): Promise<{ trimestres: string[] }> {
  return apiFetch<{ trimestres: string[] }>("/api/historico/trimestres");
}

export async function obtenerHistoricoTrimestre(
  trimestre: string
): Promise<HistoricoTrimestreResponse> {
  return apiFetch<HistoricoTrimestreResponse>(`/api/historico/${trimestre}`);
}

export async function exportarHistoricoExcel(trimestre: string): Promise<Blob> {
  return apiFetchBlob(`/api/historico/${trimestre}/exportar-excel`, { method: "POST" });
}
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Cliente API para comunicarse con el backend FastAPI.
 * Centraliza todas las llamadas HTTP con manejo de errores.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

// ── Types ────────────────────────────────────────────────────

export interface FrecuenciaEmpresa {
  empresa_id: number;
  nombre: string;
  talleres_ef: number;
  talleres_it: number;
  total: number;
  semaforo: string;
  score: number;
  ajuste_desempeno: number;
  es_nueva: boolean;
  es_comodin: boolean;
  prioridad_reduccion: string;
  ciudades_activas: string[];
  restricciones: { tipo: string; clave: string; valor: string }[];
}

export interface RecorteDetalle {
  empresa_id: number;
  nombre: string;
  ef_original: number;
  it_original: number;
  ef_recortado: number;
  it_recortado: number;
  ef_delta: number;
  it_delta: number;
  motivo: string;
}

export interface FrecuenciaOutput {
  trimestre: string;
  total_ef: number;
  total_it: number;
  max_ef: number;
  max_it: number;
  semanas_disponibles: number;
  max_ef_trimestre: number;
  max_it_trimestre: number;
  exceso_ef: number;
  exceso_it: number;
  empresas: FrecuenciaEmpresa[];
  recortes: RecorteDetalle[];
  warnings: string[];
  status: string;
}

export interface ConfirmarEmpresa {
  empresa_id: number;
  talleres_ef: number;
  talleres_it: number;
}

export interface ConfirmarOutput {
  status: string;
  trimestre: string;
  total_ef: number;
  total_it: number;
  empresas: {
    empresa_id: number;
    nombre: string;
    talleres_ef: number;
    talleres_it: number;
    total: number;
  }[];
}

export interface SugerenciaContingencia {
  empresa_id: number;
  empresa_nombre: string;
  motivo: string;
  prioridad: number;
}

export interface SlotCalendario {
  semana: number;
  dia: string;
  horario: string;
  turno: string;
  empresa_id: number;
  empresa_nombre: string;
  programa: string;
  taller_id: number;
  taller_nombre: string;
  ciudad_id: number | null;
  ciudad: string | null;
  tipo_asignacion: string;
  sugerencias: SugerenciaContingencia[] | null;
}

export interface CalendarioOutput {
  trimestre: string;
  status: string;
  tiempo_segundos: number;
  total_slots: number;
  total_ef: number;
  total_it: number;
  slots: SlotCalendario[];
  inviolables_pct: number;
  preferentes_pct: number;
  warnings: string[];
}

// ── Fetch helper ─────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      body.detail || `API error ${res.status}: ${res.statusText}`
    );
  }

  return res.json();
}

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
  return apiFetch<{ trimestre: string; total_slots: number; slots: SlotCalendario[] }>(
    `/api/calendario/${trimestre}`
  );
}

export async function exportarExcel(trimestre: string): Promise<Blob> {
  const url = `${API_BASE}/api/calendario/${trimestre}/exportar-excel`;
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) throw new Error("Error al exportar Excel");
  return res.blob();
}

// ── Empresas ─────────────────────────────────────────────────
interface EmpresaSimple {
  id: number;
  nombre: string;
}

export async function obtenerEmpresas(): Promise<EmpresaSimple[]> {
  const res = await apiFetch<{ empresas: EmpresaSimple[] }>("/api/empresas");
  return res.empresas;
}

// ── Importación masiva ───────────────────────────────────────

export interface ImportEmpresasResult {
  total_empresas: number;
  creadas: number;
  actualizadas: number;
  ciudades_creadas: string[];
  empresa_ciudad_links: number;
  config_trimestral_creadas: number;
  semanas_excluidas: number;
  warnings: string[];
}

export interface ImportHistoricoResult {
  trimestre: string;
  total_filas: number;
  importadas_ok: number;
  importadas_cancelado: number;
  vacantes_ignoradas: number;
  empresas_no_encontradas: string[];
  talleres_no_encontrados: string[];
  warnings: string[];
}

export interface EstadoImportacion {
  trimestre: string;
  empresas_activas: number;
  config_trimestral: number;
  frecuencias: number;
  historico: number;
  restricciones: number;
  ciudades: number;
  empresa_ciudad: number;
  semanas_excluidas: number;
  listo_fase_1: boolean;
  listo_fase_2: boolean;
}

export async function importarEmpresas(
  file: File,
  trimestre: string
): Promise<ImportEmpresasResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("trimestre", trimestre);

  const url = `${API_BASE}/api/importar/empresas`;
  const res = await fetch(url, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Error ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

export async function importarHistorico(
  file: File,
  trimestre: string
): Promise<ImportHistoricoResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("trimestre", trimestre);

  const url = `${API_BASE}/api/importar/historico`;
  const res = await fetch(url, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Error ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

export async function obtenerEstadoImportacion(
  trimestre: string
): Promise<EstadoImportacion> {
  return apiFetch<EstadoImportacion>(`/api/importar/estado/${trimestre}`);
}

// ── Clonación de trimestre ────────────────────────────────────

export interface ClonarTrimestreResult {
  trimestre_origen: string;
  trimestre_destino: string;
  configs_clonadas: number;
  configs_ya_existentes: number;
  empresas_saltadas: string[];
  warnings: string[];
}

export async function clonarTrimestre(
  trimestreOrigen: string,
  trimestreDestino: string
): Promise<ClonarTrimestreResult> {
  const formData = new FormData();
  formData.append("trimestre_origen", trimestreOrigen);
  formData.append("trimestre_destino", trimestreDestino);

  const url = `${API_BASE}/api/importar/clonar-trimestre`;
  const res = await fetch(url, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Error ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

// ── Restricciones ─────────────────────────────────────────────

export interface Restriccion {
  id: number;
  empresa_id: number;
  empresa_nombre: string;
  tipo: "HARD" | "SOFT";
  clave: "solo_dia" | "solo_taller" | "no_comodin" | "max_extras";
  valor: string;
  descripcion: string | null;
}

export async function obtenerRestricciones(empresaId?: number): Promise<Restriccion[]> {
  const path = empresaId ? `/api/restricciones/${empresaId}` : "/api/restricciones";
  return apiFetch<Restriccion[]>(path);
}

// ── Talleres ──────────────────────────────────────────────────

export interface TallerOut {
  id: number;
  nombre: string;
  programa: string;
  dia_semana: string | null;
  horario: string | null;
  turno: string | null;
  es_contratante: boolean;
  descripcion: string | null;
  activo: boolean;
}

export interface TallerCreate {
  nombre: string;
  programa: string;
  dia_semana?: string | null;
  horario?: string | null;
  turno?: string | null;
  es_contratante?: boolean;
  descripcion?: string | null;
  activo?: boolean;
}

export interface TallerUpdate {
  nombre?: string | null;
  programa?: string | null;
  dia_semana?: string | null;
  horario?: string | null;
  turno?: string | null;
  es_contratante?: boolean | null;
  descripcion?: string | null;
  activo?: boolean | null;
}

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
 
export interface EmpresaFull {
  id: number;
  nombre: string;
  tipo: "EF" | "IT" | "AMBAS";
  semaforo: "VERDE" | "AMBAR" | "ROJO";
  scoreV3: number;
  fiabilidadReciente: number;
  esComodin: boolean;
  aceptaExtras: boolean;
  maxExtrasTrimestre: number;
  prioridadReduccion: "ALTA" | "MEDIA" | "BAJA";
  tieneBolsa: boolean;
  turnoPreferido: string | null;
  activa: boolean;
  notas: string | null;
}
 
export interface EmpresaCreateInput {
  nombre: string;
  tipo?: string;
  semaforo?: string;
  scoreV3?: number;
  fiabilidadReciente?: number;
  esComodin?: boolean;
  aceptaExtras?: boolean;
  maxExtrasTrimestre?: number;
  prioridadReduccion?: string;
  tieneBolsa?: boolean;
  turnoPreferido?: string | null;
  notas?: string | null;
}
 
export interface EmpresaUpdateInput {
  nombre?: string;
  tipo?: string;
  semaforo?: string;
  scoreV3?: number;
  fiabilidadReciente?: number;
  esComodin?: boolean;
  aceptaExtras?: boolean;
  maxExtrasTrimestre?: number;
  prioridadReduccion?: string;
  tieneBolsa?: boolean;
  turnoPreferido?: string | null;
  notas?: string | null;
}
 
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
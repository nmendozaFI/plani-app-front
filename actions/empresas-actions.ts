"use server";

import { revalidatePath } from "next/cache";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

// ── Types ────────────────────────────────────────────────────

export interface Empresa {
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

export interface EmpresaDetalle extends Empresa {
  createdAt: string;
  updatedAt: string;
}

export interface EmpresaInput {
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

export interface RestriccionResumen {
  id: number;
  tipo: string;
  clave: string;
  valor: string;
  descripcion: string | null;
}

export interface CiudadResumen {
  id: number;
  nombre: string;
  activaReciente: boolean;
}

export interface HistoricoResumen {
  trimestre: string;
  total: number;
  ok: number;
  cancelados: number;
}

export interface EmpresaDetalleCompleto {
  empresa: EmpresaDetalle;
  restricciones: RestriccionResumen[];
  ciudades: CiudadResumen[];
  historico_reciente: HistoricoResumen[];
}

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// ── Fetch helper ─────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Error ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Read actions ─────────────────────────────────────────────

export async function getEmpresas(filters?: {
  activa?: boolean;
  tipo?: string;
  semaforo?: string;
  search?: string;
}): Promise<Empresa[]> {
  const params = new URLSearchParams();
  if (filters?.activa !== undefined) params.set("activa", String(filters.activa));
  if (filters?.tipo) params.set("tipo", filters.tipo);
  if (filters?.semaforo) params.set("semaforo", filters.semaforo);
  if (filters?.search) params.set("search", filters.search);
  const qs = params.toString();
  const res = await apiFetch<{ empresas: Empresa[] }>(
    `/api/empresas${qs ? `?${qs}` : ""}`
  );
  return res.empresas;
}

export async function getEmpresaDetalle(
  empresaId: number
): Promise<EmpresaDetalleCompleto> {
  return apiFetch<EmpresaDetalleCompleto>(`/api/empresas/${empresaId}`);
}

// ── Mutation actions ─────────────────────────────────────────

export async function crearEmpresa(
  data: EmpresaInput
): Promise<ActionResult<Empresa>> {
  try {
    const result = await apiFetch<{ empresa: Empresa }>("/api/empresas", {
      method: "POST",
      body: JSON.stringify(data),
    });
    revalidatePath("/planificacion/empresas");
    return { ok: true, data: result.empresa };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function editarEmpresa(
  empresaId: number,
  data: EmpresaUpdateInput
): Promise<ActionResult<Empresa>> {
  try {
    const result = await apiFetch<{ empresa: Empresa }>(
      `/api/empresas/${empresaId}`,
      { method: "PUT", body: JSON.stringify(data) }
    );
    revalidatePath("/planificacion/empresas");
    return { ok: true, data: result.empresa };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function toggleEmpresaActiva(
  empresaId: number
): Promise<ActionResult<{ id: number; activa: boolean }>> {
  try {
    const result = await apiFetch<{ id: number; activa: boolean }>(
      `/api/empresas/${empresaId}/toggle`,
      { method: "PATCH" }
    );
    revalidatePath("/planificacion/empresas");
    return { ok: true, data: result };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
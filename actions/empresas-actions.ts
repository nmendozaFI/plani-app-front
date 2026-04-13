"use server";

import { revalidatePath } from "next/cache";
import { apiFetchServer } from "@/lib/api-client";
import type { ActionResult } from "@/types/actions";
import type {
  Empresa,
  EmpresaCreateInput,
  EmpresaUpdateInput,
  EmpresaDetalleCompleto,
} from "@/types/empresa";

// Re-export types for backwards compatibility
export type {
  Empresa,
  EmpresaDetalle,
  EmpresaInput,
  EmpresaUpdateInput,
  RestriccionResumen,
  CiudadResumen,
  HistoricoResumen,
  EmpresaDetalleCompleto,
} from "@/types/empresa";

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
  const res = await apiFetchServer<{ empresas: Empresa[] }>(
    `/api/empresas${qs ? `?${qs}` : ""}`
  );
  return res.empresas;
}

export async function getEmpresaDetalle(
  empresaId: number
): Promise<EmpresaDetalleCompleto> {
  return apiFetchServer<EmpresaDetalleCompleto>(`/api/empresas/${empresaId}`);
}

// ── Mutation actions ─────────────────────────────────────────

export async function crearEmpresa(
  data: EmpresaCreateInput
): Promise<ActionResult<Empresa>> {
  try {
    const result = await apiFetchServer<{ empresa: Empresa }>("/api/empresas", {
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
    const result = await apiFetchServer<{ empresa: Empresa }>(
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
    const result = await apiFetchServer<{ id: number; activa: boolean }>(
      `/api/empresas/${empresaId}/toggle`,
      { method: "PATCH" }
    );
    revalidatePath("/planificacion/empresas");
    return { ok: true, data: result };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
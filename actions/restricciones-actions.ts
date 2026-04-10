"use server";

import { revalidatePath } from "next/cache";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

// ── Types ────────────────────────────────────────────────────

export interface Restriccion {
  id: number;
  empresa_id: number;
  empresa_nombre: string;
  tipo: "HARD" | "SOFT";
  clave: "solo_dia" | "solo_taller" | "no_comodin" | "max_extras";
  valor: string;
  descripcion: string | null;
}

export interface RestriccionInput {
  tipo: "HARD" | "SOFT";
  clave: "solo_dia" | "solo_taller" | "no_comodin" | "max_extras";
  valor: string;
  descripcion?: string;
}

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// ── Fetch helper (server-side, no-cache) ─────────────────────

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

export async function getRestricciones(
  empresaId?: number
): Promise<Restriccion[]> {
  const path = empresaId
    ? `/api/restricciones/${empresaId}`
    : "/api/restricciones";
  return apiFetch<Restriccion[]>(path);
}

export async function getEmpresas(): Promise<
  { id: number; nombre: string }[]
> {
  // Backend devuelve { empresas: [...] }, extraemos el array
  const res = await apiFetch<{ empresas: { id: number; nombre: string }[] }>(
    "/api/empresas"
  );
  return res.empresas;
}

// ── Mutation actions ─────────────────────────────────────────

export async function crearRestriccion(
  empresaId: number,
  data: RestriccionInput
): Promise<ActionResult<Restriccion>> {
  try {
    const result = await apiFetch<Restriccion>(
      `/api/restricciones/${empresaId}`,
      { method: "POST", body: JSON.stringify(data) }
    );
    revalidatePath("/planificacion/restricciones");
    return { ok: true, data: result };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function editarRestriccion(
  restriccionId: number,
  data: RestriccionInput
): Promise<ActionResult<Restriccion>> {
  try {
    const result = await apiFetch<Restriccion>(
      `/api/restricciones/${restriccionId}`,
      { method: "PUT", body: JSON.stringify(data) }
    );
    revalidatePath("/planificacion/restricciones");
    return { ok: true, data: result };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function borrarRestriccion(
  restriccionId: number
): Promise<ActionResult> {
  try {
    await apiFetch(`/api/restricciones/${restriccionId}`, {
      method: "DELETE",
    });
    revalidatePath("/planificacion/restricciones");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
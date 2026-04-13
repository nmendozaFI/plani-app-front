"use server";

import { revalidatePath } from "next/cache";
import { apiFetchServer } from "@/lib/api-client";
import type { ActionResult } from "@/types/actions";
import type { Restriccion, RestriccionInput } from "@/types/restriccion";

// Re-export types for backwards compatibility
export type { Restriccion, RestriccionInput } from "@/types/restriccion";

// ── Read actions ─────────────────────────────────────────────

export async function getRestricciones(
  empresaId?: number
): Promise<Restriccion[]> {
  const path = empresaId
    ? `/api/restricciones/${empresaId}`
    : "/api/restricciones";
  return apiFetchServer<Restriccion[]>(path);
}

export async function getEmpresas(): Promise<
  { id: number; nombre: string }[]
> {
  // Backend devuelve { empresas: [...] }, extraemos el array
  const res = await apiFetchServer<{ empresas: { id: number; nombre: string }[] }>(
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
    const result = await apiFetchServer<Restriccion>(
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
    const result = await apiFetchServer<Restriccion>(
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
    await apiFetchServer(`/api/restricciones/${restriccionId}`, {
      method: "DELETE",
    });
    revalidatePath("/planificacion/restricciones");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
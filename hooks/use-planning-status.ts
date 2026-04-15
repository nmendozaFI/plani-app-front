"use client";

import { useState, useEffect, useCallback } from "react";
import { actionObtenerPlanningStatus } from "@/actions/settings-actions";
import type { PlanningStatus } from "@/types/settings";

/**
 * Hook to get the current planning status.
 *
 * This determines:
 * - Which trimestre should be used for Frecuencias/Calendario (trimestre_a_planificar)
 * - Which trimestre should be used for Operacion (trimestre_activo)
 * - Whether the activo trimestre still needs planning
 */
export function usePlanningStatus() {
  const [status, setStatus] = useState<PlanningStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await actionObtenerPlanningStatus();
      if (result.ok) {
        setStatus(result.data);
      } else {
        setError(result.error);
        console.error("[usePlanningStatus] Action returned error:", result.error);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error inesperado al cargar estado de planificacion";
      setError(msg);
      console.error("[usePlanningStatus] Exception during fetch:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { status, loading, error, refresh };
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { actionObtenerSettings, actionActualizarSettings } from "@/actions/settings-actions";
import type { AppSettings, AppSettingsUpdate } from "@/types/settings";

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await actionObtenerSettings();
      if (result.ok) {
        setSettings(result.data);
      } else {
        setError(result.error);
        console.error("[useSettings] Action returned error:", result.error);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error inesperado al cargar settings";
      setError(msg);
      console.error("[useSettings] Exception during fetch:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const update = useCallback(async (data: AppSettingsUpdate) => {
    try {
      const result = await actionActualizarSettings(data);
      if (result.ok) {
        setSettings(result.data);
        return { ok: true as const };
      }
      return { ok: false as const, error: result.error };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al actualizar";
      return { ok: false as const, error: msg };
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { settings, loading, error, refresh, update };
}

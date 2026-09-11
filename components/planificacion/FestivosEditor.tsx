"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  actionListarFestivos,
  actionAgregarFestivo,
  actionEliminarFestivo,
} from "@/actions/calendario-anual-actions";
import type { FestivoOut } from "@/types/taller";

const DIA_NOMBRE: Record<string, string> = {
  L: "Lun", M: "Mar", X: "Mié", J: "Jue", V: "Vie",
};

/**
 * V32 — Editor de festivos/cierres por año. Dueño único de la tabla `festivo`.
 * La analista añade un día festivo por FECHA (+ motivo); el backend deriva
 * trimestre/semana/día. El solver y la Fase 1 excluyen esos días al generar.
 * Editar aquí NO regenera calendarios ya creados.
 */
export function FestivosEditor({ anio }: { anio: number }) {
  const [festivos, setFestivos] = useState<FestivoOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fecha, setFecha] = useState("");
  const [motivo, setMotivo] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true);
    const res = await actionListarFestivos(anio);
    if (res.ok) setFestivos(res.data);
    else toast.error(res.error);
    setLoading(false);
  }, [anio]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const agregar = useCallback(async () => {
    if (!fecha || saving) return;
    setSaving(true);
    const res = await actionAgregarFestivo(anio, { fecha, motivo: motivo.trim() || null });
    if (res.ok) {
      toast.success(`Festivo ${res.data.fecha} guardado (${res.data.trimestre}, semana ${res.data.semana})`);
      setFecha("");
      setMotivo("");
      await cargar();
    } else {
      toast.error(res.error);
    }
    setSaving(false);
  }, [anio, fecha, motivo, saving, cargar]);

  const eliminar = useCallback(async (f: FestivoOut) => {
    const res = await actionEliminarFestivo(f.id);
    if (res.ok) {
      toast.success(`Festivo ${f.fecha} eliminado`);
      setFestivos((prev) => prev.filter((x) => x.id !== f.id));
    } else {
      toast.error(res.error);
    }
  }, []);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-1 text-sm font-semibold text-slate-800">
        Festivos y cierres · {anio}
      </div>
      <p className="mb-3 text-xs text-slate-500">
        Los días que agregues aquí se excluyen al <strong>generar</strong> el calendario (no tocan
        los calendarios ya creados). Días laborales (L–V).
      </p>

      {/* Alta */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col">
          <label htmlFor="festivo-fecha" className="text-[11px] font-medium text-slate-500">Fecha</label>
          <input
            id="festivo-fecha"
            type="date"
            value={fecha}
            min={`${anio}-01-01`}
            max={`${anio}-12-31`}
            onChange={(e) => setFecha(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-1 flex-col min-w-[160px]">
          <label htmlFor="festivo-motivo" className="text-[11px] font-medium text-slate-500">Motivo (opcional)</label>
          <input
            id="festivo-motivo"
            type="text"
            value={motivo}
            placeholder="Almudena, Año Nuevo…"
            onChange={(e) => setMotivo(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") agregar(); }}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <button
          onClick={agregar}
          disabled={!fecha || saving}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {saving ? "Guardando…" : "Añadir"}
        </button>
      </div>

      {/* Lista */}
      <div className="mt-4">
        {loading ? (
          <div className="text-xs text-slate-400">Cargando…</div>
        ) : festivos.length === 0 ? (
          <div className="text-xs text-slate-400">Sin festivos cargados para {anio}.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {festivos.map((f) => (
              <li key={f.id} className="flex items-center justify-between py-1.5 text-sm">
                <span className="text-slate-700">
                  <span className="font-mono">{f.fecha}</span>
                  <span className="ml-2 text-slate-400">
                    {DIA_NOMBRE[f.dia] ?? f.dia} · {f.trimestre} · sem {f.semana}
                  </span>
                  {f.motivo && <span className="ml-2 text-slate-600">— {f.motivo}</span>}
                </span>
                <button
                  onClick={() => eliminar(f)}
                  className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

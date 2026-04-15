"use client";

import Link from "next/link";
import { BarChart, Calendar, CalendarCheck, TrendingUp } from "lucide-react";
import { useSettings } from "@/hooks/use-settings";

export function DashboardCards() {
  const { settings, loading } = useSettings();

  const siguienteLabel = settings?.trimestre_siguiente
    ? `Planificando: ${settings.trimestre_siguiente}`
    : "Configura el siguiente trimestre para empezar";

  const activoLabel = settings?.trimestre_activo
    ? `Operando: ${settings.trimestre_activo}`
    : "Cargando...";

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Fase 1 */}
      <Link
        href="/planificacion/frecuencias"
        className="group rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
      >
        <div className="flex items-start justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-slate-900 group-hover:text-white transition-colors">
            <BarChart />
          </div>
          <span className="text-xs font-medium text-slate-400 group-hover:text-slate-600">
            Paso 1
          </span>
        </div>
        <h2 className="mt-4 text-lg font-semibold text-slate-900">
          Frecuencias
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Calcula cuantos talleres EF/IT le corresponden a cada empresa.
          Recorte automatico + ajuste manual.
        </p>
        <div className="mt-4 text-xs font-medium">
          {loading ? (
            <span className="text-slate-400">Cargando...</span>
          ) : settings?.trimestre_siguiente ? (
            <span className="text-blue-600">{siguienteLabel}</span>
          ) : (
            <span className="text-amber-600">{siguienteLabel}</span>
          )}
        </div>
      </Link>

      {/* Fase 2 */}
      <Link
        href="/planificacion/calendario"
        className="group rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
      >
        <div className="flex items-start justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-slate-900 group-hover:text-white transition-colors">
            <Calendar />
          </div>
          <span className="text-xs font-medium text-slate-400 group-hover:text-slate-600">
            Paso 2
          </span>
        </div>
        <h2 className="mt-4 text-lg font-semibold text-slate-900">
          Calendario
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Genera el calendario trimestral con OR-Tools CP-SAT.
          Asignacion automatica de talleres y ciudades.
        </p>
        <div className="mt-4 text-xs font-medium">
          {loading ? (
            <span className="text-slate-400">Cargando...</span>
          ) : settings?.trimestre_siguiente ? (
            <span className="text-blue-600">{siguienteLabel}</span>
          ) : (
            <span className="text-amber-600">{siguienteLabel}</span>
          )}
        </div>
      </Link>

      {/* Fase 3 */}
      <Link
        href="/planificacion/operacion"
        className="group rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
      >
        <div className="flex items-start justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-slate-900 group-hover:text-white transition-colors">
            <CalendarCheck />
          </div>
          <span className="text-xs font-medium text-slate-400 group-hover:text-slate-600">
            Paso 3
          </span>
        </div>
        <h2 className="mt-4 text-lg font-semibold text-slate-900">
          Operacion
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Gestiona el calendario en tiempo real.
          Confirma, cancela y asigna vacantes.
        </p>
        <div className="mt-4 text-xs font-medium">
          {loading ? (
            <span className="text-slate-400">Cargando...</span>
          ) : (
            <span className="text-emerald-600">{activoLabel}</span>
          )}
        </div>
      </Link>

      {/* Analisis */}
      <Link
        href="/planificacion/analisis"
        className="group rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
      >
        <div className="flex items-start justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-slate-900 group-hover:text-white transition-colors">
            <TrendingUp />
          </div>
          <span className="text-xs font-medium text-slate-400 group-hover:text-slate-600">
            Analisis
          </span>
        </div>
        <h2 className="mt-4 text-lg font-semibold text-slate-900">
          Planificado vs Realizado
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Compara asignaciones del solver vs resultado final.
          Identifica empresas sustituidas y comodines.
        </p>
        <div className="mt-4 text-xs font-medium">
          {loading ? (
            <span className="text-slate-400">Cargando...</span>
          ) : (
            <span className="text-violet-600">{activoLabel}</span>
          )}
        </div>
      </Link>
    </div>
  );
}

import { BanIcon, Building, History, ImportIcon, School, Settings2 } from "lucide-react";
import Link from "next/link";
import { TrimestreIndicator } from "@/components/planificacion/TrimestreIndicator";
import { DashboardCards } from "@/components/planificacion/DashboardCards";

export default async function DashboardPage() {
  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="mx-auto max-w-5xl px-6 py-10">
        {/* Header with Trimestre Indicator */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Planificador de Talleres
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Fundación Integra — Sistema de planificación trimestral
            </p>
          </div>
          <TrimestreIndicator />
        </div>

        {/* Cards principales — Pasos */}
        <DashboardCards />

        {/* Separador — Configuraciones */}
        <div className="mt-8 mb-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <p className="text-xs font-medium uppercase tracking-widest text-slate-400">
            Configuraciones
          </p>
          <div className="h-px flex-1 bg-slate-200" />
        </div>
        <p className="mb-4 text-xs text-slate-400">
          Estos datos se configuran una vez y pueden editarse en cualquier momento.
        </p>

        {/* Cards de configuración — 5 columnas en desktop */}
        <div className="grid gap-2 grid-cols-1 md:grid-cols-2 lg:grid-cols-5">
          {/* Importar */}
          <Link
            href="/planificacion/importacion"
            className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                <ImportIcon className="h-4 w-4" />
              </div>
              <span className="text-xs font-medium text-slate-400 group-hover:text-slate-600">
                Importar datos
              </span>
            </div>
            <h2 className="mt-3 text-sm font-semibold text-slate-900">
              Importación
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Importa datos de empresas y historial para generar el calendario.
            </p>
            <div className="mt-3 text-xs font-medium text-slate-400 group-hover:text-slate-600">
              Puedes editar luego los datos importados
            </div>
          </Link>

          {/* Restricciones */}
          <Link
            href="/planificacion/restricciones"
            className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                <BanIcon className="h-4 w-4" />
              </div>
              <span className="text-xs font-medium text-slate-400 group-hover:text-slate-600">
                Restricciones
              </span>
            </div>
            <h2 className="mt-3 text-sm font-semibold text-slate-900">
              Restricciones
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Define restricciones para la asignación de talleres.
            </p>
            <div className="mt-3 text-xs font-medium text-slate-400 group-hover:text-slate-600">
              Puedes editar luego las restricciones definidas
            </div>
          </Link>

          {/* Talleres */}
          <Link
            href="/planificacion/talleres"
            className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                <School className="h-4 w-4" />
              </div>
              <span className="text-xs font-medium text-slate-400 group-hover:text-slate-600">
                Talleres
              </span>
            </div>
            <h2 className="mt-3 text-sm font-semibold text-slate-900">
              Talleres
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Define talleres para la asignación de voluntarios.
            </p>
            <div className="mt-3 text-xs font-medium text-slate-400 group-hover:text-slate-600">
              Puedes editar luego los talleres definidos
            </div>
          </Link>
          {/* Empresas */}
          <Link
            href="/planificacion/empresas"
            className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                <Building className="h-4 w-4" />
              </div>
              <span className="text-xs font-medium text-slate-400 group-hover:text-slate-600">
                Empresas
              </span>
            </div>
            <h2 className="mt-3 text-sm font-semibold text-slate-900">
              Empresas
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Gestiona las empresas para la asignación de voluntarios.
            </p>
            <div className="mt-3 text-xs font-medium text-slate-400 group-hover:text-slate-600">
              Puedes editar luego las empresas.
            </div>
          </Link>

          {/* Config Trimestral */}
          <Link
            href="/configuracion-trimestral"
            className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                <Settings2 className="h-4 w-4" />
              </div>
              <span className="text-xs font-medium text-slate-400 group-hover:text-slate-600">
                Config
              </span>
            </div>
            <h2 className="mt-3 text-sm font-semibold text-slate-900">
              Config Trimestral
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Preferencias de empresas: dias, turnos, frecuencia solicitada.
            </p>
            <div className="mt-3 text-xs font-medium text-slate-400 group-hover:text-slate-600">
              Edita antes de calcular frecuencias
            </div>
          </Link>
        </div>

        {/* Separador — Historicos */}
        <div className="mt-8 mb-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <p className="text-xs font-medium uppercase tracking-widest text-slate-400">
            Consultas
          </p>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        {/* Historicos */}
        <div className="grid gap-2 grid-cols-1 md:grid-cols-2 lg:grid-cols-5">
          <Link
            href="/historicos"
            className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                <History className="h-4 w-4" />
              </div>
              <span className="text-xs font-medium text-slate-400 group-hover:text-slate-600">
                Historicos
              </span>
            </div>
            <h2 className="mt-3 text-sm font-semibold text-slate-900">
              Historicos
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Consulta trimestres cerrados y exporta a Excel.
            </p>
            <div className="mt-3 text-xs font-medium text-slate-400 group-hover:text-slate-600">
              Ver datos de trimestres anteriores
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
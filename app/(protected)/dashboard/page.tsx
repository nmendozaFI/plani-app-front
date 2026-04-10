import { BanIcon, BarChart, Building, Calendar, ImportIcon, School } from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="mx-auto max-w-5xl px-6 py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Planificador de Talleres
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Fundación Integra — Sistema de planificación trimestral
          </p>
        </div>

        {/* Cards principales — Pasos */}
        <div className="grid gap-4 sm:grid-cols-2">
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
              Calcula cuántos talleres EF/IT le corresponden a cada empresa.
              Recorte automático + ajuste manual.
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs font-medium text-slate-400 group-hover:text-slate-600">
              <span>14 EF + 6 IT = 20 talleres/trimestre</span>
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
              Asignación automática de talleres y ciudades.
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs font-medium text-slate-400 group-hover:text-slate-600">
              <span>13 semanas · Solver OPTIMAL</span>
            </div>
          </Link>
        </div>

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

        {/* Cards de configuración — 3 columnas desktop, 2 en md, 1 en móvil */}
        <div className="grid gap-2 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
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
        </div>
      </div>
    </div>
  );
}
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { actionObtenerAnalisis } from "@/actions/calendario-actions";
import { useSettings } from "@/hooks/use-settings";
import type {
  AnalisisResponse,
  EmpresaAnalisis,
  CambioSlot,
} from "@/types/analisis";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowRightLeft,
  ChevronDown,
  ChevronUp,
  Search,
  Download,
  TrendingDown,
  TrendingUp,
  Clock,
} from "lucide-react";

// ── Constants ────────────────────────────────────────────────

const SUGERENCIA_CONFIG: Record<
  string,
  { bg: string; text: string; icon: React.ReactNode }
> = {
  REDUCIR: {
    bg: "bg-red-100",
    text: "text-red-700",
    icon: <TrendingDown className="h-3 w-3" />,
  },
  REVISAR: {
    bg: "bg-amber-100",
    text: "text-amber-700",
    icon: <AlertTriangle className="h-3 w-3" />,
  },
  MANTENER: {
    bg: "bg-green-100",
    text: "text-green-700",
    icon: <TrendingUp className="h-3 w-3" />,
  },
  SOLO_COMODIN: {
    bg: "bg-blue-100",
    text: "text-blue-700",
    icon: <ArrowRightLeft className="h-3 w-3" />,
  },
};

const DIAS_LABEL: Record<string, string> = {
  L: "Lunes",
  M: "Martes",
  X: "Miercoles",
  J: "Jueves",
  V: "Viernes",
};

// ══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════

export function AnalisisPageClient() {
  const { settings, loading: loadingSettings } = useSettings();
  const [selectedTrimestre, setSelectedTrimestre] = useState<string | null>(
    null
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analisis, setAnalisis] = useState<AnalisisResponse | null>(null);

  // Filters & sorting
  const [filtroEmpresa, setFiltroEmpresa] = useState("");
  const [filtroSugerencia, setFiltroSugerencia] = useState<string>("Todas");
  const [sortField, setSortField] = useState<
    "tasa_cumplimiento" | "asignados_solver" | "sustituida" | "extras_cubiertos"
  >("tasa_cumplimiento");
  const [sortAsc, setSortAsc] = useState(true);

  // Expandable sections
  const [showCambios, setShowCambios] = useState(false);

  // Available trimestres (active + closed from historico)
  const trimestres = useMemo(() => {
    const list: string[] = [];
    if (settings?.trimestre_activo) list.push(settings.trimestre_activo);
    if (
      settings?.trimestre_siguiente &&
      settings.trimestre_siguiente !== settings.trimestre_activo
    ) {
      list.push(settings.trimestre_siguiente);
    }
    // In the future, could add closed trimestres from historico API
    return list;
  }, [settings]);

  // Set default trimestre
  useEffect(() => {
    if (!selectedTrimestre && settings?.trimestre_activo) {
      setSelectedTrimestre(settings.trimestre_activo);
    }
  }, [settings, selectedTrimestre]);

  // ── Load data ──────────────────────────────────────────────

  const cargarAnalisis = useCallback(async () => {
    if (!selectedTrimestre) return;
    setLoading(true);
    setError(null);
    try {
      const result = await actionObtenerAnalisis(selectedTrimestre);
      if (!result.ok) throw new Error(result.error);
      setAnalisis(result.data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al cargar analisis";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [selectedTrimestre]);

  useEffect(() => {
    if (selectedTrimestre) {
      cargarAnalisis();
    }
  }, [cargarAnalisis, selectedTrimestre]);

  // ── Computed data ──────────────────────────────────────────

  const empresasFiltradas = useMemo(() => {
    if (!analisis) return [];
    let filtered = [...analisis.por_empresa];

    // Filter by empresa name
    if (filtroEmpresa.trim()) {
      const search = filtroEmpresa.toLowerCase();
      filtered = filtered.filter((e) =>
        e.empresa_nombre.toLowerCase().includes(search)
      );
    }

    // Filter by sugerencia
    if (filtroSugerencia !== "Todas") {
      filtered = filtered.filter((e) => e.sugerencia === filtroSugerencia);
    }

    // Sort
    filtered.sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      return sortAsc ? valA - valB : valB - valA;
    });

    return filtered;
  }, [analisis, filtroEmpresa, filtroSugerencia, sortField, sortAsc]);

  const handleSort = (
    field:
      | "tasa_cumplimiento"
      | "asignados_solver"
      | "sustituida"
      | "extras_cubiertos"
  ) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(field === "tasa_cumplimiento"); // Default ascending for cumplimiento (worst first)
    }
  };

  // ── Export to CSV ──────────────────────────────────────────

  const exportarCSV = () => {
    if (!analisis) return;

    const headers = [
      "Empresa",
      "Asignados Solver",
      "Cumplidos",
      "Sustituida",
      "Cancelados",
      "Pendientes",
      "Extras Cubiertos",
      "Tasa Cumplimiento",
      "Tasa Sustitucion",
      "Sugerencia",
    ];

    const rows = analisis.por_empresa.map((e) => [
      e.empresa_nombre,
      e.asignados_solver,
      e.cumplidos,
      e.sustituida,
      e.cancelados,
      e.pendientes,
      e.extras_cubiertos,
      e.tasa_cumplimiento,
      e.tasa_sustitucion,
      e.sugerencia,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((r) => r.map((c) => `"${c}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `analisis_${selectedTrimestre}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado");
  };

  // ── Render ─────────────────────────────────────────────────

  if (loadingSettings) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-600" />
      </div>
    );
  }

  if (!settings?.trimestre_activo) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" />
        <h3 className="mt-2 font-medium text-amber-800">
          No hay trimestre activo configurado
        </h3>
        <p className="mt-1 text-sm text-amber-600">
          Configura el trimestre activo desde el Dashboard para ver el analisis.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Analisis: Planificado vs Realizado
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Compara las asignaciones del solver con el resultado final del
            trimestre
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Trimestre Selector */}
          <select
            value={selectedTrimestre || ""}
            onChange={(e) => setSelectedTrimestre(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100"
          >
            {trimestres.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          {/* Export */}
          <button
            onClick={exportarCSV}
            disabled={!analisis || loading}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-600" />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={cargarAnalisis}
            className="mt-2 text-sm font-medium text-red-600 hover:text-red-800"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Main Content */}
      {analisis && !loading && (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              title="Asignados por Solver"
              value={analisis.resumen.total_slots_asignados}
              icon={<BarChart3 className="h-5 w-5" />}
              color="slate"
            />
            <SummaryCard
              title="Cumplidos sin Cambio"
              value={analisis.resumen.cumplidos_sin_cambio}
              subtitle={`${analisis.resumen.tasa_cumplimiento_global}%`}
              icon={<CheckCircle2 className="h-5 w-5" />}
              color="green"
            />
            <SummaryCard
              title="Sustituidos"
              value={analisis.resumen.sustituidos}
              subtitle={`${analisis.resumen.tasa_sustitucion_global}%`}
              icon={<ArrowRightLeft className="h-5 w-5" />}
              color="amber"
            />
            <SummaryCard
              title="Cancelados"
              value={analisis.resumen.cancelados}
              icon={<XCircle className="h-5 w-5" />}
              color="red"
            />
          </div>

          {/* Progress Bars */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="font-medium text-slate-900">Tasa Global</h3>
            <div className="mt-4 space-y-4">
              {/* Cumplimiento */}
              <div>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-slate-600">Cumplimiento</span>
                  <span className="font-medium text-green-600">
                    {analisis.resumen.tasa_cumplimiento_global}%
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-green-500 transition-all"
                    style={{
                      width: `${analisis.resumen.tasa_cumplimiento_global}%`,
                    }}
                  />
                </div>
              </div>
              {/* Sustitucion */}
              <div>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-slate-600">Sustitucion</span>
                  <span className="font-medium text-amber-600">
                    {analisis.resumen.tasa_sustitucion_global}%
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all"
                    style={{
                      width: `${analisis.resumen.tasa_sustitucion_global}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Buscar empresa..."
                value={filtroEmpresa}
                onChange={(e) => setFiltroEmpresa(e.target.value)}
                className="pl-9"
              />
            </div>
            <select
              value={filtroSugerencia}
              onChange={(e) => setFiltroSugerencia(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="Todas">Todas las sugerencias</option>
              <option value="REDUCIR">REDUCIR</option>
              <option value="REVISAR">REVISAR</option>
              <option value="MANTENER">MANTENER</option>
              <option value="SOLO_COMODIN">SOLO_COMODIN</option>
            </select>
          </div>

          {/* Companies Table */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-6 py-4">
              <h3 className="font-medium text-slate-900">
                Por Empresa ({empresasFiltradas.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    <th className="px-6 py-3">Empresa</th>
                    <th
                      className="cursor-pointer px-4 py-3 text-center hover:text-slate-700"
                      onClick={() => handleSort("asignados_solver")}
                    >
                      <div className="flex items-center justify-center gap-1">
                        Asig.
                        {sortField === "asignados_solver" &&
                          (sortAsc ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          ))}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-center">Cumpl.</th>
                    <th
                      className="cursor-pointer px-4 py-3 text-center hover:text-slate-700"
                      onClick={() => handleSort("sustituida")}
                    >
                      <div className="flex items-center justify-center gap-1">
                        Sust.
                        {sortField === "sustituida" &&
                          (sortAsc ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          ))}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-center">Cancel.</th>
                    <th className="px-4 py-3 text-center">Pend.</th>
                    <th
                      className="cursor-pointer px-4 py-3 text-center hover:text-slate-700"
                      onClick={() => handleSort("extras_cubiertos")}
                    >
                      <div className="flex items-center justify-center gap-1">
                        Extras
                        {sortField === "extras_cubiertos" &&
                          (sortAsc ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          ))}
                      </div>
                    </th>
                    <th
                      className="cursor-pointer px-4 py-3 text-center hover:text-slate-700"
                      onClick={() => handleSort("tasa_cumplimiento")}
                    >
                      <div className="flex items-center justify-center gap-1">
                        Tasa
                        {sortField === "tasa_cumplimiento" &&
                          (sortAsc ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          ))}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-center">Sugerencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {empresasFiltradas.map((emp) => (
                    <EmpresaRow key={emp.empresa_id} empresa={emp} />
                  ))}
                  {empresasFiltradas.length === 0 && (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-6 py-8 text-center text-sm text-slate-500"
                      >
                        No hay empresas que coincidan con los filtros
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cambios Detail */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <button
              onClick={() => setShowCambios(!showCambios)}
              className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-slate-50"
            >
              <div>
                <h3 className="font-medium text-slate-900">
                  Detalle de Sustituciones ({analisis.cambios.length})
                </h3>
                <p className="text-sm text-slate-500">
                  Slots donde la empresa original fue reemplazada
                </p>
              </div>
              {showCambios ? (
                <ChevronUp className="h-5 w-5 text-slate-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-slate-400" />
              )}
            </button>

            {showCambios && analisis.cambios.length > 0 && (
              <div className="border-t border-slate-100">
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-slate-50">
                      <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                        <th className="px-6 py-3">Semana</th>
                        <th className="px-4 py-3">Dia</th>
                        <th className="px-4 py-3">Taller</th>
                        <th className="px-4 py-3">Programa</th>
                        <th className="px-4 py-3">Original</th>
                        <th className="px-4 py-3">Final</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {analisis.cambios.map((cambio, idx) => (
                        <CambioRow key={idx} cambio={cambio} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {showCambios && analisis.cambios.length === 0 && (
              <div className="border-t border-slate-100 px-6 py-8 text-center text-sm text-slate-500">
                No hubo sustituciones en este trimestre
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ══════════════════════════════════════════════════════════════

function SummaryCard({
  title,
  value,
  subtitle,
  icon,
  color,
}: {
  title: string;
  value: number;
  subtitle?: string;
  icon: React.ReactNode;
  color: "slate" | "green" | "amber" | "red";
}) {
  const colorClasses = {
    slate: "bg-slate-100 text-slate-600",
    green: "bg-green-100 text-green-600",
    amber: "bg-amber-100 text-amber-600",
    red: "bg-red-100 text-red-600",
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg ${colorClasses[color]}`}
        >
          {icon}
        </div>
        {subtitle && (
          <span
            className={`text-sm font-medium ${
              color === "green"
                ? "text-green-600"
                : color === "amber"
                  ? "text-amber-600"
                  : color === "red"
                    ? "text-red-600"
                    : "text-slate-600"
            }`}
          >
            {subtitle}
          </span>
        )}
      </div>
      <div className="mt-4">
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-sm text-slate-500">{title}</p>
      </div>
    </div>
  );
}

function EmpresaRow({ empresa }: { empresa: EmpresaAnalisis }) {
  const sugerenciaConfig =
    SUGERENCIA_CONFIG[empresa.sugerencia] || SUGERENCIA_CONFIG.REVISAR;

  // Color for tasa_cumplimiento
  const tasaColor =
    empresa.tasa_cumplimiento >= 90
      ? "text-green-600"
      : empresa.tasa_cumplimiento >= 70
        ? "text-amber-600"
        : "text-red-600";

  return (
    <tr className="hover:bg-slate-50">
      <td className="px-6 py-3">
        <span className="font-medium text-slate-900">
          {empresa.empresa_nombre}
        </span>
        {empresa.extras_cubiertos > 0 && empresa.asignados_solver === 0 && (
          <Badge variant="outline" className="ml-2 text-xs">
            Comodin
          </Badge>
        )}
      </td>
      <td className="px-4 py-3 text-center text-sm text-slate-600">
        {empresa.asignados_solver}
      </td>
      <td className="px-4 py-3 text-center text-sm text-green-600">
        {empresa.cumplidos}
      </td>
      <td className="px-4 py-3 text-center text-sm text-amber-600">
        {empresa.sustituida}
      </td>
      <td className="px-4 py-3 text-center text-sm text-red-600">
        {empresa.cancelados}
      </td>
      <td className="px-4 py-3 text-center text-sm text-slate-400">
        {empresa.pendientes}
      </td>
      <td className="px-4 py-3 text-center">
        {empresa.extras_cubiertos > 0 ? (
          <Badge variant="secondary" className="bg-blue-100 text-blue-700">
            +{empresa.extras_cubiertos}
          </Badge>
        ) : (
          <span className="text-sm text-slate-400">-</span>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        <span className={`font-semibold ${tasaColor}`}>
          {empresa.tasa_cumplimiento}%
        </span>
      </td>
      <td className="px-4 py-3 text-center">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${sugerenciaConfig.bg} ${sugerenciaConfig.text}`}
        >
          {sugerenciaConfig.icon}
          {empresa.sugerencia}
        </span>
      </td>
    </tr>
  );
}

function CambioRow({ cambio }: { cambio: CambioSlot }) {
  return (
    <tr className="text-sm hover:bg-slate-50">
      <td className="px-6 py-3 font-medium text-slate-700">S{cambio.semana}</td>
      <td className="px-4 py-3 text-slate-600">
        {DIAS_LABEL[cambio.dia] || cambio.dia}
      </td>
      <td className="px-4 py-3 text-slate-600">{cambio.taller}</td>
      <td className="px-4 py-3">
        <Badge variant="outline" className="text-xs">
          {cambio.programa}
        </Badge>
      </td>
      <td className="px-4 py-3">
        <span className="text-red-600 line-through">
          {cambio.empresa_original}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="font-medium text-green-600">
          {cambio.empresa_final}
        </span>
      </td>
    </tr>
  );
}

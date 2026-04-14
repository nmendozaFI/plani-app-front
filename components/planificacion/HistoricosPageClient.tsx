"use client";

import { useState, useEffect, useCallback } from "react";
import {
  actionObtenerTrimestresHistorico,
  actionObtenerHistoricoTrimestre,
  actionExportarHistoricoExcel,
} from "@/actions/historico-actions";
import type { HistoricoTrimestreResponse } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

// ── Constants ────────────────────────────────────────────────

const ESTADO_COLORS: Record<string, { bg: string; text: string }> = {
  OK: { bg: "bg-green-100", text: "text-green-700" },
  CANCELADO: { bg: "bg-red-100", text: "text-red-700" },
};

// ══════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════

export function HistoricosPageClient() {
  const [trimestres, setTrimestres] = useState<string[]>([]);
  const [selectedTrimestre, setSelectedTrimestre] = useState<string | null>(null);
  const [historico, setHistorico] = useState<HistoricoTrimestreResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filtroEstado, setFiltroEstado] = useState<string>("Todos");
  const [filtroEmpresa, setFiltroEmpresa] = useState<string>("");
  const [filtroPrograma, setFiltroPrograma] = useState<string>("Todos");

  // Load trimestres on mount
  useEffect(() => {
    async function loadTrimestres() {
      const result = await actionObtenerTrimestresHistorico();
      if (result.ok && result.data.trimestres.length > 0) {
        setTrimestres(result.data.trimestres);
        setSelectedTrimestre(result.data.trimestres[0]);
      }
      setLoading(false);
    }
    loadTrimestres();
  }, []);

  // Load historico when trimestre changes
  const loadHistorico = useCallback(async (trimestre: string) => {
    setLoadingData(true);
    setError(null);
    const result = await actionObtenerHistoricoTrimestre(trimestre);
    if (result.ok) {
      setHistorico(result.data);
    } else {
      setError(result.error);
    }
    setLoadingData(false);
  }, []);

  useEffect(() => {
    if (selectedTrimestre) {
      (async () => { await loadHistorico(selectedTrimestre); })();
    }
  }, [selectedTrimestre, loadHistorico]);

  // Export to Excel
  const handleExport = async () => {
    if (!selectedTrimestre) return;
    setExporting(true);
    const result = await actionExportarHistoricoExcel(selectedTrimestre);
    if (result.ok) {
      const a = document.createElement("a");
      a.href = result.data.url;
      a.download = `historico_${selectedTrimestre}.xlsx`;
      a.click();
    } else {
      setError(result.error);
    }
    setExporting(false);
  };

  // Filter registros
  const filteredRegistros = historico?.registros.filter((r) => {
    if (filtroEstado !== "Todos" && r.estado !== filtroEstado) return false;
    if (filtroPrograma !== "Todos" && r.programa !== filtroPrograma) return false;
    if (filtroEmpresa && !r.empresa_nombre.toLowerCase().includes(filtroEmpresa.toLowerCase())) {
      return false;
    }
    return true;
  }) ?? [];

  // ── Render ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-400 border-t-transparent" />
      </div>
    );
  }

  if (trimestres.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="text-4xl mb-4">📭</div>
        <h2 className="text-xl font-semibold text-slate-700">Sin datos historicos</h2>
        <p className="text-sm text-slate-500 mt-2">
          No hay trimestres cerrados con datos historicos.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Historicos</h1>
          <p className="text-sm text-slate-500">
            Consulta trimestres cerrados y exporta a Excel
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedTrimestre || ""}
            onChange={(e) => setSelectedTrimestre(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {trimestres.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <button
            onClick={handleExport}
            disabled={exporting || !selectedTrimestre}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {exporting ? "Exportando..." : "Exportar Excel"}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Loading */}
      {loadingData && (
        <div className="flex items-center justify-center py-10">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-slate-400 border-t-transparent" />
        </div>
      )}

      {/* Stats */}
      {historico && !loadingData && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Total" value={historico.total} color="slate" />
            <StatCard label="OK" value={historico.ok} color="green" />
            <StatCard label="Cancelados" value={historico.cancelados} color="red" />
            <StatCard
              label="Asistencia"
              value={`${historico.total > 0 ? Math.round((historico.ok / historico.total) * 100) : 0}%`}
              color="blue"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <input
              type="text"
              placeholder="Buscar empresa..."
              value={filtroEmpresa}
              onChange={(e) => setFiltroEmpresa(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm w-64 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="Todos">Estado: Todos</option>
              <option value="OK">OK</option>
              <option value="CANCELADO">Cancelados</option>
            </select>
            <select
              value={filtroPrograma}
              onChange={(e) => setFiltroPrograma(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="Todos">Programa: Todos</option>
              <option value="EF">EF</option>
              <option value="IT">IT</option>
            </select>
            <span className="text-xs text-slate-500 ml-auto">
              {filteredRegistros.length} de {historico.registros.length} registros
            </span>
          </div>

          {/* Table */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto max-h-[600px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0">
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Fecha</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Dia</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Horario</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Empresa</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Taller</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Prog</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Estado</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Ciudad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRegistros.map((r) => {
                    const colors = ESTADO_COLORS[r.estado] || ESTADO_COLORS.OK;
                    return (
                      <tr
                        key={r.id}
                        className={`hover:bg-slate-50 ${r.estado === "CANCELADO" ? "bg-red-50/30" : ""}`}
                      >
                        <td className="px-4 py-2.5 whitespace-nowrap text-slate-700">
                          {formatDate(r.fecha)}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">{r.dia}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">{r.horario}</td>
                        <td className="px-3 py-2.5 text-slate-800 font-medium">{r.empresa_nombre}</td>
                        <td className="px-3 py-2.5 text-slate-600">{r.taller_nombre}</td>
                        <td className="px-3 py-2.5 text-center">
                          <Badge variant="secondary" className="text-[10px]">
                            {r.programa}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colors.bg} ${colors.text}`}>
                            {r.estado}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-slate-500">{r.ciudad || "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: "slate" | "green" | "red" | "blue";
}) {
  const colorClasses = {
    slate: "bg-slate-100 text-slate-800",
    green: "bg-green-100 text-green-700",
    red: "bg-red-100 text-red-700",
    blue: "bg-blue-100 text-blue-700",
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${colorClasses[color].split(" ")[1]}`}>
        {value}
      </div>
    </div>
  );
}

"use client";

import { useState, useCallback } from "react";
import { getTrimestreAnterior } from "@/utils/trimestres";
import {
  actionCalcularFrecuencias,
  actionConfirmarFrecuencias,
} from "@/actions/frecuencias-actions";
import { usePlanningStatus } from "@/hooks/use-planning-status";
import type {
  FrecuenciaOutput,
  FrecuenciaEmpresa,
  ConfirmarOutput,
} from "@/lib/api";
import { SemaforoBadge } from "./SemaforoBadge";
import { PrioridadBadge } from "./PrioridadBadge";
import { WarningsPanel } from "./WarningsPanel";
import { RecortesPanel } from "./RecortesPanel";

// ── Types ────────────────────────────────────────────────────

interface EmpresaEditable extends FrecuenciaEmpresa {
  talleres_ef_edit: number;
  talleres_it_edit: number;
  modificado: boolean;
}

type Paso = "config" | "revision" | "confirmado";

// ── Component ────────────────────────────────────────────────

export function FrecuenciasWizard() {
  const { status, loading: loadingStatus } = usePlanningStatus();
  const trimestre = status?.trimestre_a_planificar || null;
  const esPlanificandoActivo = status?.activo_necesita_planificacion || false;

  const [paso, setPaso] = useState<Paso>("config");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Paso 2: revisión
  const [propuesta, setPropuesta] = useState<FrecuenciaOutput | null>(null);
  const [empresasEdit, setEmpresasEdit] = useState<EmpresaEditable[]>([]);

  // Paso 3: confirmado
  const [confirmacion, setConfirmacion] = useState<ConfirmarOutput | null>(
    null,
  );

  // Filtros (visuales — no afectan totales)
  const [searchQuery, setSearchQuery] = useState("");
  const [semaforoFilter, setSemaforoFilter] = useState<
    "TODOS" | "VERDE" | "AMBAR" | "ROJO"
  >("TODOS");
  const [soloModificadas, setSoloModificadas] = useState(false);

  // ── Paso 1: Calcular ────────────────────────────────────────

  const handleCalcular = useCallback(async () => {
    if (!trimestre) return;
    setLoading(true);
    setError(null);
    try {
      const trimestreAnt = getTrimestreAnterior(trimestre);
      const result = await actionCalcularFrecuencias(trimestre, trimestreAnt);
      if (!result.ok) throw new Error(result.error);

      setPropuesta(result.data);
      setEmpresasEdit(
        result.data.empresas.map((e) => ({
          ...e,
          talleres_ef_edit: e.talleres_ef,
          talleres_it_edit: e.talleres_it,
          modificado: false,
        })),
      );
      setPaso("revision");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [trimestre]);

  // ── Edición inline ──────────────────────────────────────────

  const handleEdit = useCallback(
    (empresaId: number, campo: "ef" | "it", valor: number) => {
      setEmpresasEdit((prev) =>
        prev.map((e) => {
          if (e.empresa_id !== empresaId) return e;
          const updated = { ...e };
          if (campo === "ef") updated.talleres_ef_edit = Math.max(0, valor);
          else updated.talleres_it_edit = Math.max(0, valor);
          updated.modificado =
            updated.talleres_ef_edit !== e.talleres_ef ||
            updated.talleres_it_edit !== e.talleres_it;
          return updated;
        }),
      );
    },
    [],
  );

  // ── Totales editados ────────────────────────────────────────

  const totalEfEdit = empresasEdit.reduce((s, e) => s + e.talleres_ef_edit, 0);
  const totalItEdit = empresasEdit.reduce((s, e) => s + e.talleres_it_edit, 0);
  const hayModificaciones = empresasEdit.some((e) => e.modificado);
  // Comparar contra los totales del TRIMESTRE (max_ef × semanas_disponibles)
  const maxEfTrimestre = propuesta?.max_ef_trimestre ?? propuesta?.max_ef ?? 14;
  const maxItTrimestre = propuesta?.max_it_trimestre ?? propuesta?.max_it ?? 6;
  const totalesOk =
    totalEfEdit <= maxEfTrimestre && totalItEdit <= maxItTrimestre;

  // ── Filtrado visual (no toca totales) ───────────────────────

  const empresasFiltradas = empresasEdit.filter((emp) => {
    if (
      searchQuery &&
      !emp.nombre.toLowerCase().includes(searchQuery.toLowerCase())
    )
      return false;
    if (semaforoFilter !== "TODOS" && emp.semaforo !== semaforoFilter)
      return false;
    if (soloModificadas && !emp.modificado) return false;
    return true;
  });

  const hayFiltroActivo =
    searchQuery !== "" || semaforoFilter !== "TODOS" || soloModificadas;

  // ── Paso 3: Confirmar ───────────────────────────────────────

  const handleConfirmar = useCallback(async () => {
    if (!trimestre) return;
    setLoading(true);
    setError(null);
    try {
      const empresas = empresasEdit.map((e) => ({
        empresa_id: e.empresa_id,
        talleres_ef: e.talleres_ef_edit,
        talleres_it: e.talleres_it_edit,
      }));
      const result = await actionConfirmarFrecuencias(trimestre, empresas);
      if (!result.ok) throw new Error(result.error);

      setConfirmacion(result.data);
      setPaso("confirmado");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [trimestre, empresasEdit]);

  // ── Reset ───────────────────────────────────────────────────

  const handleReset = () => {
    setPaso("config");
    setPropuesta(null);
    setEmpresasEdit([]);
    setConfirmacion(null);
    setError(null);
    setSearchQuery("");
    setSemaforoFilter("TODOS");
    setSoloModificadas(false);
  };

  // ── Render ──────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Fase 1 — Frecuencias
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Calcula y confirma cuántos talleres EF/IT por empresa
          </p>
        </div>
        {paso !== "config" && (
          <button
            onClick={handleReset}
            className="text-sm text-slate-500 hover:text-slate-700 underline underline-offset-2"
          >
            ← Nuevo cálculo
          </button>
        )}
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 text-xs font-medium">
        {(["config", "revision", "confirmado"] as Paso[]).map((p, i) => {
          const labels = ["Configurar", "Revisar y ajustar", "Confirmado"];
          const isActive = paso === p;
          const isPast =
            (p === "config" && paso !== "config") ||
            (p === "revision" && paso === "confirmado");
          return (
            <div key={p} className="flex items-center gap-2">
              {i > 0 && <div className="h-px w-8 bg-slate-200" />}
              <div
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 transition-colors ${
                  isActive
                    ? "bg-slate-900 text-white"
                    : isPast
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-400"
                }`}
              >
                {isPast && (
                  <svg
                    className="h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={3}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m4.5 12.75 6 6 9-13.5"
                    />
                  </svg>
                )}
                {labels[i]}
              </div>
            </div>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── PASO 1: Configurar ───────────────────────────────── */}
      {paso === "config" && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {loadingStatus ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <svg
                className="h-4 w-4 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Cargando configuracion...
            </div>
          ) : trimestre ? (
            <>
              <h2 className="text-sm font-semibold text-slate-700 mb-4">
                Trimestre a Planificar
              </h2>
              {/* Info banner when planning the activo trimestre */}
              {esPlanificandoActivo && (
                <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <p className="text-sm text-blue-700">
                    <strong>Nota:</strong> Planificando el trimestre activo (
                    {trimestre}) porque aun no tiene frecuencias confirmadas.
                    Una vez completado, podras operarlo desde la pagina de
                    Operacion.
                  </p>
                </div>
              )}
              <div className="flex items-end gap-4">
                <div
                  className={`rounded-lg border px-4 py-2 ${
                    esPlanificandoActivo
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-blue-200 bg-blue-50"
                  }`}
                >
                  <span
                    className={`text-lg font-bold ${
                      esPlanificandoActivo
                        ? "text-emerald-800"
                        : "text-blue-800"
                    }`}
                  >
                    {trimestre}
                  </span>
                  <span
                    className={`ml-2 text-xs ${
                      esPlanificandoActivo
                        ? "text-emerald-600"
                        : "text-blue-600"
                    }`}
                  >
                    ({esPlanificandoActivo ? "activo" : "siguiente"})
                  </span>
                </div>
                <div className="text-xs text-slate-400">
                  vs. trimestre anterior: {getTrimestreAnterior(trimestre)}
                </div>
              </div>
              <button
                onClick={handleCalcular}
                disabled={loading}
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-slate-800 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <svg
                      className="h-4 w-4 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Calculando...
                  </>
                ) : (
                  "Calcular frecuencias"
                )}
              </button>
            </>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <h3 className="text-sm font-semibold text-amber-800 mb-2">
                No hay trimestre para planificar
              </h3>
              <p className="text-sm text-amber-700">
                {status?.activo_tiene_frecuencias &&
                status?.activo_tiene_calendario
                  ? "El trimestre activo ya esta planificado. Configura el trimestre siguiente desde el Dashboard para continuar."
                  : "Configura el trimestre activo y/o siguiente desde el Dashboard para poder calcular frecuencias."}
              </p>
              <a
                href="/dashboard"
                className="mt-3 inline-block text-sm font-medium text-amber-800 underline underline-offset-2 hover:text-amber-900"
              >
                Ir al Dashboard
              </a>
            </div>
          )}
        </div>
      )}

      {/* ── PASO 2: Revisión ─────────────────────────────────── */}
      {paso === "revision" && propuesta && (
        <>
          {/* Resumen */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Total EF"
              value={totalEfEdit}
              max={maxEfTrimestre}
              ok={totalEfEdit <= maxEfTrimestre}
            />
            <StatCard
              label="Total IT"
              value={totalItEdit}
              max={maxItTrimestre}
              ok={totalItEdit <= maxItTrimestre}
            />
            <StatCard
              label="Total"
              value={totalEfEdit + totalItEdit}
              max={maxEfTrimestre + maxItTrimestre}
              ok={totalesOk}
            />
            <StatCard label="Status" value={propuesta.status} isStatus />
          </div>

          {/* Warnings */}
          <WarningsPanel warnings={propuesta.warnings} />

          {/* Recortes */}
          <RecortesPanel recortes={propuesta.recortes} />

          {/* Filtros (visuales — totales siguen siendo globales) */}
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            {/* Search input */}
            <div className="relative flex-1 min-w-[240px]">
              <svg
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar empresa..."
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
            </div>

            {/* Semáforo dropdown */}
            <select
              value={semaforoFilter}
              onChange={(e) =>
                setSemaforoFilter(e.target.value as typeof semaforoFilter)
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
            >
              <option value="TODOS">Semáforo: Todos</option>
              <option value="VERDE">Semáforo: Verde</option>
              <option value="AMBAR">Semáforo: Ámbar</option>
              <option value="ROJO">Semáforo: Rojo</option>
            </select>

            {/* Solo modificadas */}
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                checked={soloModificadas}
                onChange={(e) => setSoloModificadas(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-slate-700 focus:ring-slate-400"
              />
              Solo modificadas
            </label>

            {/* Counter */}
            <div className="ml-auto text-xs text-slate-500 tabular-nums">
              Mostrando{" "}
              <span className="font-semibold text-slate-700">
                {empresasFiltradas.length}
              </span>{" "}
              de{" "}
              <span className="font-semibold text-slate-700">
                {empresasEdit.length}
              </span>
            </div>
          </div>

          {/* Tabla editable */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Empresa
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Semáforo
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Score
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Prioridad
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider w-20">
                      EF
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider w-20">
                      IT
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Ajuste
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Info
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {empresasFiltradas.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-4 py-12 text-center text-sm text-slate-400"
                      >
                        No hay empresas que coincidan con los filtros activos.
                      </td>
                    </tr>
                  ) : (
                    empresasFiltradas.map((emp) => (
                      <tr
                        key={emp.empresa_id}
                        className={`transition-colors ${
                          emp.modificado
                            ? "bg-blue-50/50"
                            : "hover:bg-slate-50/50"
                        }`}
                      >
                        {/* Nombre */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-800">
                              {emp.nombre}
                            </span>
                            {emp.es_comodin && (
                              <span className="rounded bg-violet-100 px-1 py-0.5 text-[10px] font-semibold text-violet-600">
                                COMODÍN
                              </span>
                            )}
                          </div>
                          {emp.ciudades_activas.length > 0 && (
                            <div className="mt-0.5 text-[11px] text-slate-400">
                              {emp.ciudades_activas.join(", ")}
                            </div>
                          )}
                        </td>

                        {/* Semáforo */}
                        <td className="px-3 py-3 text-center">
                          <SemaforoBadge semaforo={emp.semaforo} />
                        </td>

                        {/* Score */}
                        <td className="px-3 py-3 text-center">
                          <span className="font-mono text-sm font-semibold text-slate-700">
                            {emp.score}
                          </span>
                        </td>

                        {/* Prioridad */}
                        <td className="px-3 py-3 text-center">
                          <PrioridadBadge prioridad={emp.prioridad_reduccion} />
                        </td>

                        {/* EF editable */}
                        <td className="px-3 py-3 text-center">
                          <input
                            type="number"
                            min={0}
                            max={14}
                            value={emp.talleres_ef_edit}
                            onChange={(e) =>
                              handleEdit(
                                emp.empresa_id,
                                "ef",
                                parseInt(e.target.value) || 0,
                              )
                            }
                            className={`w-14 rounded border px-2 py-1 text-center text-sm font-mono transition-colors focus:outline-none focus:ring-1 focus:ring-slate-400 ${
                              emp.talleres_ef_edit !== emp.talleres_ef
                                ? "border-blue-400 bg-blue-50 text-blue-700"
                                : "border-slate-200 bg-white text-slate-700"
                            }`}
                          />
                        </td>

                        {/* IT editable */}
                        <td className="px-3 py-3 text-center">
                          <input
                            type="number"
                            min={0}
                            max={6}
                            value={emp.talleres_it_edit}
                            onChange={(e) =>
                              handleEdit(
                                emp.empresa_id,
                                "it",
                                parseInt(e.target.value) || 0,
                              )
                            }
                            className={`w-14 rounded border px-2 py-1 text-center text-sm font-mono transition-colors focus:outline-none focus:ring-1 focus:ring-slate-400 ${
                              emp.talleres_it_edit !== emp.talleres_it
                                ? "border-blue-400 bg-blue-50 text-blue-700"
                                : "border-slate-200 bg-white text-slate-700"
                            }`}
                          />
                        </td>

                        {/* Total */}
                        <td className="px-3 py-3 text-center">
                          <span className="font-mono text-sm font-bold text-slate-800">
                            {emp.talleres_ef_edit + emp.talleres_it_edit}
                          </span>
                        </td>

                        {/* Ajuste */}
                        <td className="px-3 py-3 text-center">
                          {emp.ajuste_desempeno !== 0 && (
                            <span
                              className={`text-xs font-semibold ${
                                emp.ajuste_desempeno < 0
                                  ? "text-red-600"
                                  : "text-emerald-600"
                              }`}
                            >
                              {emp.ajuste_desempeno > 0 ? "+" : ""}
                              {emp.ajuste_desempeno}
                            </span>
                          )}
                        </td>

                        {/* Info */}
                        <td className="px-4 py-3">
                          {emp.restricciones.length > 0 && (
                            <div className="space-y-0.5">
                              {emp.restricciones.map((r, i) => (
                                <div
                                  key={i}
                                  className="text-[11px] text-slate-500"
                                >
                                  <span
                                    className={`font-medium ${r.tipo === "HARD" ? "text-red-500" : "text-amber-500"}`}
                                  >
                                    {r.clave}
                                  </span>
                                  : {r.valor}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>

                {/* Footer totals */}
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50">
                    <td
                      colSpan={4}
                      className="px-4 py-3 text-right text-xs font-bold text-slate-600 uppercase"
                    >
                      Totales
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={`font-mono text-sm font-bold ${totalEfEdit === maxEfTrimestre ? "text-emerald-600" : "text-red-600"}`}
                      >
                        {totalEfEdit}/{maxEfTrimestre}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={`font-mono text-sm font-bold ${totalItEdit === maxItTrimestre ? "text-emerald-600" : "text-red-600"}`}
                      >
                        {totalItEdit}/{maxItTrimestre}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={`font-mono text-sm font-bold ${totalesOk ? "text-emerald-600" : "text-red-600"}`}
                      >
                        {totalEfEdit + totalItEdit}/
                        {maxEfTrimestre + maxItTrimestre}
                      </span>
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {hayFiltroActivo && (
            <div className="text-xs text-slate-500 italic -mt-3 px-1">
              Totales calculados sobre las {empresasEdit.length} empresas (el
              filtro activo oculta algunas filas).
            </div>
          )}

          {/* Validation + Confirm */}
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-500">
              {hayModificaciones && (
                <span className="text-blue-600 font-medium">
                  ● Hay cambios manuales sin confirmar
                </span>
              )}
              {!totalesOk && (
                <span className="text-red-600 font-medium ml-3">
                  ⚠ Los totales no cuadran con el modelo ({propuesta.max_ef} EF
                  + {propuesta.max_it} IT)
                </span>
              )}
            </div>
            <button
              onClick={handleConfirmar}
              disabled={loading || !totalesOk}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <svg
                    className="h-4 w-4 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Confirmando...
                </>
              ) : (
                "✓ Confirmar frecuencias"
              )}
            </button>
          </div>
        </>
      )}

      {/* ── PASO 3: Confirmado ───────────────────────────────── */}
      {paso === "confirmado" && confirmacion && (
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100">
                <svg
                  className="h-5 w-5 text-emerald-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m4.5 12.75 6 6 9-13.5"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-emerald-800">
                  Frecuencias confirmadas — {confirmacion.trimestre}
                </h3>
                <p className="mt-1 text-sm text-emerald-700">
                  {confirmacion.total_ef} EF + {confirmacion.total_it} IT ={" "}
                  {confirmacion.total_ef + confirmacion.total_it} talleres
                </p>
              </div>
            </div>
          </div>

          {/* Tabla resumen */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">
                    Empresa
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600">
                    EF
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600">
                    IT
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {confirmacion.empresas.map((e) => (
                  <tr key={e.empresa_id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-2 font-medium text-slate-800">
                      {e.nombre}
                    </td>
                    <td className="px-3 py-2 text-center font-mono text-slate-700">
                      {e.talleres_ef}
                    </td>
                    <td className="px-3 py-2 text-center font-mono text-slate-700">
                      {e.talleres_it}
                    </td>
                    <td className="px-3 py-2 text-center font-mono font-bold text-slate-800">
                      {e.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* CTA */}
          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Nuevo cálculo
            </button>
            <a
              href={`/planificacion/calendario?trimestre=${trimestre}`}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
            >
              Continuar a Fase 2 — Calendario →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Stat card helper ─────────────────────────────────────────

function StatCard({
  label,
  value,
  max,
  ok,
  isStatus,
}: {
  label: string;
  value: string | number;
  max?: number;
  ok?: boolean;
  isStatus?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span
          className={`text-xl font-bold tabular-nums ${
            isStatus
              ? value === "OK"
                ? "text-emerald-600"
                : "text-red-600"
              : ok
                ? "text-slate-900"
                : "text-red-600"
          }`}
        >
          {value}
        </span>
        {max !== undefined && (
          <span className="text-xs text-slate-400">/ {max}</span>
        )}
      </div>
    </div>
  );
}

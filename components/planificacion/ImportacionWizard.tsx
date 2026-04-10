/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { getTrimestres, getTrimestreActual, getTrimestreAnterior } from "@/utils/trimestres";
import {
  importarEmpresas,
  importarHistorico,
  obtenerEstadoImportacion,
  type ImportEmpresasResult,
  type ImportHistoricoResult,
  type EstadoImportacion,
} from "@/lib/api";

// ── Estado badge ────────────────────────────────────────────

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
        ok
          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
          : "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-emerald-500" : "bg-amber-400"}`}
      />
      {label}
    </span>
  );
}

// ── Stat card ───────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center text-lg">
        {icon}
      </div>
      <div>
        <p className="text-2xl font-semibold text-slate-900">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}

// ── File drop zone ──────────────────────────────────────────

function FileDropZone({
  onFile,
  file,
  accept,
  label,
}: {
  onFile: (f: File) => void;
  file: File | null;
  accept: string;
  label: string;
}) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) onFile(f);
    },
    [onFile]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`
        relative cursor-pointer rounded-xl border-2 border-dashed p-8
        transition-all duration-200 text-center
        ${
          dragOver
            ? "border-blue-400 bg-blue-50"
            : file
              ? "border-emerald-300 bg-emerald-50"
              : "border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-white"
        }
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
      {file ? (
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="font-medium text-slate-700">{file.name}</p>
          <p className="text-xs text-slate-500">
            {(file.size / 1024).toFixed(1)} KB — Click para cambiar
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center">
            <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <p className="font-medium text-slate-600">{label}</p>
          <p className="text-xs text-slate-400">Arrastra el archivo aquí o haz click</p>
        </div>
      )}
    </div>
  );
}

// ── Resultado panel ─────────────────────────────────────────

function ResultPanel({
  result,
  type,
}: {
  result: ImportEmpresasResult | ImportHistoricoResult;
  type: "empresas" | "historico";
}) {
  const isEmpresas = type === "empresas";
  const r = result as any;

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 className="font-semibold text-emerald-800">Importación completada</h3>
      </div>

      {isEmpresas ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-slate-800">{r.total_empresas}</p>
            <p className="text-xs text-slate-500">Total</p>
          </div>
          <div className="bg-white rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-blue-600">{r.creadas}</p>
            <p className="text-xs text-slate-500">Nuevas</p>
          </div>
          <div className="bg-white rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-amber-600">{r.actualizadas}</p>
            <p className="text-xs text-slate-500">Actualizadas</p>
          </div>
          <div className="bg-white rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-slate-600">{r.empresa_ciudad_links}</p>
            <p className="text-xs text-slate-500">Empresa-Ciudad</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-slate-800">{r.total_filas}</p>
            <p className="text-xs text-slate-500">Filas Excel</p>
          </div>
          <div className="bg-white rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-emerald-600">{r.importadas_ok}</p>
            <p className="text-xs text-slate-500">OK</p>
          </div>
          <div className="bg-white rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-red-500">{r.importadas_cancelado}</p>
            <p className="text-xs text-slate-500">Cancelados</p>
          </div>
          <div className="bg-white rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-slate-400">{r.vacantes_ignoradas}</p>
            <p className="text-xs text-slate-500">Vacantes ignoradas</p>
          </div>
        </div>
      )}

      {/* Errores de matching */}
      {!isEmpresas && (r.empresas_no_encontradas?.length > 0 || r.talleres_no_encontrados?.length > 0) && (
        <div className="space-y-2">
          {r.empresas_no_encontradas?.length > 0 && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3">
              <p className="text-xs font-medium text-red-700 mb-1">Empresas no encontradas en BD:</p>
              <p className="text-xs text-red-600">{r.empresas_no_encontradas.join(", ")}</p>
            </div>
          )}
          {r.talleres_no_encontrados?.length > 0 && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3">
              <p className="text-xs font-medium text-red-700 mb-1">Talleres no encontrados:</p>
              <p className="text-xs text-red-600">{r.talleres_no_encontrados.join(", ")}</p>
            </div>
          )}
        </div>
      )}

      {/* Warnings */}
      {r.warnings?.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-amber-700">Avisos:</p>
          {r.warnings.map((w: string, i: number) => (
            <p key={i} className="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1">
              {w}
            </p>
          ))}
        </div>
      )}

      {/* Ciudades creadas (solo empresas) */}
      {isEmpresas && r.ciudades_creadas?.length > 0 && (
        <p className="text-xs text-emerald-700">
          Ciudades nuevas: {r.ciudades_creadas.join(", ")}
        </p>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════

export default function ImportacionWizard() {
  const [trimestre, setTrimestre] = useState(() => getTrimestreActual());
  const [estado, setEstado] = useState<EstadoImportacion | null>(null);
  const [loadingEstado, setLoadingEstado] = useState(true);

  // Tab
  const [tab, setTab] = useState<"empresas" | "historico">("empresas");

  // Empresas
  const [fileEmpresas, setFileEmpresas] = useState<File | null>(null);
  const [loadingEmpresas, setLoadingEmpresas] = useState(false);
  const [resultEmpresas, setResultEmpresas] = useState<ImportEmpresasResult | null>(null);
  const [errorEmpresas, setErrorEmpresas] = useState<string | null>(null);

  // Histórico
  const [fileHistorico, setFileHistorico] = useState<File | null>(null);
  const [trimestreHist, setTrimestreHist] = useState(() => getTrimestreAnterior(getTrimestreActual()));
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [resultHistorico, setResultHistorico] = useState<ImportHistoricoResult | null>(null);
  const [errorHistorico, setErrorHistorico] = useState<string | null>(null);

  // ── Cargar estado ─────────────────────────────────────────
  const cargarEstado = useCallback(async () => {
    setLoadingEstado(true);
    try {
      const data = await obtenerEstadoImportacion(trimestre);
      setEstado(data);
    } catch {
      // silently fail
    } finally {
      setLoadingEstado(false);
    }
  }, [trimestre]);

  useEffect(() => {
    cargarEstado();
  }, [cargarEstado]);

  // ── Importar empresas ─────────────────────────────────────
  const handleImportarEmpresas = async () => {
    if (!fileEmpresas) return;
    setLoadingEmpresas(true);
    setErrorEmpresas(null);
    setResultEmpresas(null);
    try {
      const result = await importarEmpresas(fileEmpresas, trimestre);
      setResultEmpresas(result);
      cargarEstado();
    } catch (e: any) {
      setErrorEmpresas(e.message);
    } finally {
      setLoadingEmpresas(false);
    }
  };

  // ── Importar histórico ────────────────────────────────────
  const handleImportarHistorico = async () => {
    if (!fileHistorico) return;
    setLoadingHistorico(true);
    setErrorHistorico(null);
    setResultHistorico(null);
    try {
      const result = await importarHistorico(fileHistorico, trimestreHist);
      setResultHistorico(result);
      cargarEstado();
    } catch (e: any) {
      setErrorHistorico(e.message);
    } finally {
      setLoadingHistorico(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Importación de datos
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Carga masiva de empresas y cierre de calendarios trimestrales
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">Trimestre:</label>
          <select
            value={trimestre}
            onChange={(e) => setTrimestre(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm
                       bg-white text-slate-800 focus:ring-2 focus:ring-blue-500
                       focus:border-blue-500 outline-none"
          >
            {getTrimestres().map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Estado actual */}
      {!loadingEstado && estado && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800">
              Estado: {estado.trimestre}
            </h2>
            <div className="flex gap-2">
              <StatusBadge
                ok={estado.listo_fase_1}
                label={estado.listo_fase_1 ? "Listo Fase 1" : "Faltan datos"}
              />
              <StatusBadge
                ok={estado.listo_fase_2}
                label={estado.listo_fase_2 ? "Listo Fase 2" : "Sin frecuencias"}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon="🏢" label="Empresas activas" value={estado.empresas_activas} />
            <StatCard icon="⚙️" label="Config trimestral" value={estado.config_trimestral} />
            <StatCard icon="🌍" label="Ciudades" value={estado.ciudades} />
            <StatCard icon="🔗" label="Empresa-Ciudad" value={estado.empresa_ciudad} />
            <StatCard icon="📊" label="Frecuencias" value={estado.frecuencias} />
            <StatCard icon="📋" label="Histórico" value={estado.historico} />
            <StatCard icon="🚫" label="Restricciones" value={estado.restricciones} />
            <StatCard icon="📅" label="Sem. excluidas" value={estado.semanas_excluidas} />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab("empresas")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
            tab === "empresas"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          📥 Importar Empresas
        </button>
        <button
          onClick={() => setTab("historico")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
            tab === "historico"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          📅 Cerrar calendario
        </button>
      </div>

      {/* Tab: Empresas */}
      {tab === "empresas" && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <div>
            <h2 className="font-semibold text-slate-800 mb-1">
              Excel Maestro de Empresas
            </h2>
            <p className="text-sm text-slate-500">
              Sube el Excel con la hoja &quot;Empresas&quot;. El sistema hace upsert
              (crea nuevas o actualiza existentes por nombre, case-insensitive).
              También carga ciudades, empresa-ciudad y configTrimestral.
            </p>
          </div>

          <FileDropZone
            onFile={setFileEmpresas}
            file={fileEmpresas}
            accept=".xlsx,.xls"
            label="Excel maestro (.xlsx)"
          />

          <div className="flex items-center gap-3">
            <button
              onClick={handleImportarEmpresas}
              disabled={!fileEmpresas || loadingEmpresas}
              className={`
                px-5 py-2.5 rounded-lg text-sm font-medium
                transition-all duration-200
                ${
                  !fileEmpresas || loadingEmpresas
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 shadow-sm"
                }
              `}
            >
              {loadingEmpresas ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Importando…
                </span>
              ) : (
                "Importar empresas"
              )}
            </button>
            <p className="text-xs text-slate-400">
              Trimestre: <span className="font-medium text-slate-600">{trimestre}</span>
            </p>
          </div>

          {errorEmpresas && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-700">{errorEmpresas}</p>
            </div>
          )}

          {resultEmpresas && <ResultPanel result={resultEmpresas} type="empresas" />}
        </div>
      )}

      {/* Tab: Histórico (Cerrar calendario) */}
      {tab === "historico" && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <div>
            <h2 className="font-semibold text-slate-800 mb-1">
              Cerrar calendario trimestral
            </h2>
            <p className="text-sm text-slate-500">
              Sube el Excel del calendario exportado y completado. El sistema importa
              las filas con estado OK y CANCELADO como histórico. Las vacantes sin
              empresa se ignoran.
            </p>
          </div>

          {/* Flujo visual */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-600 mb-3">Flujo de cierre</p>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="flex items-center gap-1.5 rounded-full bg-blue-100 text-blue-700 px-2.5 py-1 font-medium">
                1. Exportar
              </span>
              <svg className="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="flex items-center gap-1.5 rounded-full bg-amber-100 text-amber-700 px-2.5 py-1 font-medium">
                2. Completar
              </span>
              <svg className="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 text-emerald-700 px-2.5 py-1 font-medium">
                3. Importar aquí
              </span>
            </div>
            <p className="mt-3 text-[11px] text-slate-400">
              Desde Calendario → Exportar Excel → completar vacantes y marcar OK/CANCELADO → subir aquí para cerrar el trimestre.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm text-slate-600">Trimestre a cerrar:</label>
            <select
              value={trimestreHist}
              onChange={(e) => setTrimestreHist(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm
                         bg-white text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {getTrimestres().map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <FileDropZone
            onFile={setFileHistorico}
            file={fileHistorico}
            accept=".xlsx,.xls,.csv"
            label="Calendario completado (.xlsx)"
          />

          <div className="flex items-center gap-3">
            <button
              onClick={handleImportarHistorico}
              disabled={!fileHistorico || loadingHistorico}
              className={`
                px-5 py-2.5 rounded-lg text-sm font-medium
                transition-all duration-200
                ${
                  !fileHistorico || loadingHistorico
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 shadow-sm"
                }
              `}
            >
              {loadingHistorico ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Importando…
                </span>
              ) : (
                "Cerrar trimestre"
              )}
            </button>
            <p className="text-xs text-slate-400">
              Reemplaza el histórico existente de <span className="font-medium text-slate-600">{trimestreHist}</span>
            </p>
          </div>

          {errorHistorico && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-700">{errorHistorico}</p>
            </div>
          )}

          {resultHistorico && <ResultPanel result={resultHistorico} type="historico" />}
        </div>
      )}

      {/* Info del flujo */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-5">
        <h3 className="font-medium text-slate-700 mb-2">Flujo completo de planificación</h3>
        <ol className="text-sm text-slate-600 space-y-1.5">
          <li className="flex items-start gap-2">
            <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-bold">1</span>
            <span><strong>Importar empresas</strong> — Sube el Excel maestro con empresas, ciudades y config trimestral.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-bold">2</span>
            <span><strong>Fase 1: Frecuencias</strong> — Calcula y confirma cuántos talleres EF/IT por empresa.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-bold">3</span>
            <span><strong>Fase 2: Calendario</strong> — Genera el calendario con el solver. Exporta Excel con vacantes.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="shrink-0 w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-xs flex items-center justify-center font-bold">4</span>
            <span><strong>Operación</strong> — Completa vacantes, confirma con empresas, marca OK/CANCELADO en el Excel.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-xs flex items-center justify-center font-bold">5</span>
            <span><strong>Cerrar calendario</strong> — Sube el Excel completado aquí. Queda como histórico para el próximo trimestre.</span>
          </li>
        </ol>
      </div>
    </div>
  );
}
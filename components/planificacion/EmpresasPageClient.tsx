/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { toast } from "sonner";
import {
  type Empresa,
  type EmpresaInput,
  type EmpresaUpdateInput,
  type EmpresaDetalleCompleto,
  getEmpresas,
  getEmpresaDetalle,
  crearEmpresa,
  editarEmpresa,
  toggleEmpresaActiva,
} from "@/actions/empresas-actions";

// ── Constants ────────────────────────────────────────────────

const SEMAFORO_STYLE: Record<
  string,
  { bg: string; text: string; dot: string; label: string }
> = {
  VERDE: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
    label: "Verde",
  },
  AMBAR: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    dot: "bg-amber-500",
    label: "Ámbar",
  },
  ROJO: {
    bg: "bg-red-50",
    text: "text-red-700",
    dot: "bg-red-500",
    label: "Rojo",
  },
};

const TIPO_STYLE: Record<string, string> = {
  EF: "bg-slate-100 text-slate-700",
  IT: "bg-violet-100 text-violet-700",
  AMBAS: "bg-blue-100 text-blue-700",
};

const PRIORIDAD_STYLE: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  ALTA: {
    bg: "bg-red-100",
    text: "text-red-700",
    label: "Alta (recortar primero)",
  },
  MEDIA: { bg: "bg-amber-100", text: "text-amber-700", label: "Media" },
  BAJA: {
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    label: "Baja (protegida)",
  },
};

type Modo = "lista" | "detalle" | "crear" | "editar";

// ══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════

export function EmpresasPageClient() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroActiva, setFiltroActiva] = useState<boolean | null>(true);
  const [filtroTipo, setFiltroTipo] = useState<string | null>(null);
  const [filtroSemaforo, setFiltroSemaforo] = useState<string | null>(null);

  const [modo, setModo] = useState<Modo>("lista");
  const [empresaSel, setEmpresaSel] = useState<EmpresaDetalleCompleto | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();

  // ── Load empresas ──────────────────────────────────────────

  const cargarEmpresas = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getEmpresas({
        activa: filtroActiva ?? undefined,
        tipo: filtroTipo ?? undefined,
        semaforo: filtroSemaforo ?? undefined,
        search: search || undefined,
      });
      setEmpresas(data);
    } catch (e: any) {
      toast.error(e.message || "Error al cargar empresas");
    }
    setLoading(false);
  }, [filtroActiva, filtroTipo, filtroSemaforo, search]);

  useEffect(() => {
    (async () => {
      await cargarEmpresas();
    })();
  }, [cargarEmpresas]);

  // ── Handlers ───────────────────────────────────────────────

  async function handleVerDetalle(id: number) {
    try {
      const detalle = await getEmpresaDetalle(id);
      setEmpresaSel(detalle);
      setModo("detalle");
    } catch (e: any) {
      toast.error(e.message || "Error al cargar detalle");
    }
  }

  function handleCrear(data: EmpresaInput) {
    startTransition(async () => {
      const res = await crearEmpresa(data);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Empresa "${res.data.nombre}" creada`);
      setModo("lista");
      cargarEmpresas();
    });
  }

  function handleEditar(data: EmpresaUpdateInput) {
    if (!empresaSel) return;
    startTransition(async () => {
      const res = await editarEmpresa(empresaSel.empresa.id, data);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Empresa actualizada");
      // Recargar detalle
      const detalle = await getEmpresaDetalle(empresaSel.empresa.id);
      setEmpresaSel(detalle);
      setModo("detalle");
      cargarEmpresas();
    });
  }

  function handleToggle(id: number) {
    startTransition(async () => {
      const res = await toggleEmpresaActiva(id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        res.data.activa ? "Empresa activada" : "Empresa desactivada",
      );
      cargarEmpresas();
      // Si estamos en detalle de esta empresa, recargar
      if (empresaSel?.empresa.id === id) {
        const detalle = await getEmpresaDetalle(id);
        setEmpresaSel(detalle);
      }
    });
  }

  // ── Stats ──────────────────────────────────────────────────

  const stats = {
    total: empresas.length,
    verdes: empresas.filter((e) => e.semaforo === "VERDE").length,
    ambar: empresas.filter((e) => e.semaforo === "AMBAR").length,
    rojas: empresas.filter((e) => e.semaforo === "ROJO").length,
    comodines: empresas.filter((e) => e.esComodin).length,
  };

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Empresas
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Gestión de datos maestros · {stats.total} empresa
            {stats.total !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {modo !== "lista" && (
            <button
              onClick={() => {
                setModo("lista");
                setEmpresaSel(null);
              }}
              className="text-sm text-slate-500 hover:text-slate-700 underline underline-offset-2"
            >
              ← Volver a lista
            </button>
          )}
          {modo === "lista" && (
            <button
              onClick={() => setModo("crear")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4.5v15m7.5-7.5h-15"
                />
              </svg>
              Nueva empresa
            </button>
          )}
        </div>
      </div>

      {/* ═══ LISTA ═══ */}
      {modo === "lista" && (
        <>
          {/* Stats mini */}
          <div className="flex gap-3">
            <MiniStat label="Total" value={stats.total} />
            <MiniStat label="Verdes" value={stats.verdes} color="emerald" />
            <MiniStat label="Ámbar" value={stats.ambar} color="amber" />
            <MiniStat label="Rojas" value={stats.rojas} color="red" />
            <MiniStat label="Comodines" value={stats.comodines} color="blue" />
          </div>

          {/* Filtros */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-60">
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
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar empresa..."
                className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-slate-500"
              />
            </div>

            {/* Filtro activa */}
            <select
              value={
                filtroActiva === null
                  ? "todas"
                  : filtroActiva
                    ? "activas"
                    : "inactivas"
              }
              onChange={(e) => {
                const v = e.target.value;
                setFiltroActiva(v === "todas" ? null : v === "activas");
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
            >
              <option value="todas">Todas</option>
              <option value="activas">Activas</option>
              <option value="inactivas">Inactivas</option>
            </select>

            {/* Filtro tipo */}
            <select
              value={filtroTipo || ""}
              onChange={(e) => setFiltroTipo(e.target.value || null)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
            >
              <option value="">Tipo: Todos</option>
              <option value="EF">EF</option>
              <option value="IT">IT</option>
              <option value="AMBAS">AMBAS</option>
            </select>

            {/* Filtro semáforo */}
            <select
              value={filtroSemaforo || ""}
              onChange={(e) => setFiltroSemaforo(e.target.value || null)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
            >
              <option value="">Semáforo: Todos</option>
              <option value="VERDE">Verde</option>
              <option value="AMBAR">Ámbar</option>
              <option value="ROJO">Rojo</option>
            </select>
          </div>

          {/* Tabla */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Spinner />{" "}
                <span className="ml-2 text-sm text-slate-500">Cargando...</span>
              </div>
            ) : empresas.length === 0 ? (
              <div className="py-16 text-center text-sm text-slate-400">
                No se encontraron empresas con los filtros actuales.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600">
                      Empresa
                    </th>
                    <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-600">
                      Tipo
                    </th>
                    <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-600">
                      Semáforo
                    </th>
                    <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-600">
                      Score
                    </th>
                    <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-600">
                      Reducción
                    </th>
                    <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-600">
                      Flags
                    </th>
                    <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-600">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {empresas.map((emp) => {
                    const sem =
                      SEMAFORO_STYLE[emp.semaforo] || SEMAFORO_STYLE.AMBAR;
                    const prio =
                      PRIORIDAD_STYLE[emp.prioridadReduccion] ||
                      PRIORIDAD_STYLE.MEDIA;
                    return (
                      <tr
                        key={emp.id}
                        className={`cursor-pointer transition-colors ${emp.activa ? "hover:bg-slate-50" : "opacity-50 hover:opacity-70"}`}
                        onClick={() => handleVerDetalle(emp.id)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`h-2.5 w-2.5 rounded-full shrink-0 ${sem.dot}`}
                            />
                            <span className="font-medium text-slate-800">
                              {emp.nombre}
                            </span>
                            {!emp.activa && (
                              <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500">
                                INACTIVA
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${TIPO_STYLE[emp.tipo] || "bg-slate-100 text-slate-600"}`}
                          >
                            {emp.tipo}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${sem.bg} ${sem.text}`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${sem.dot}`}
                            />
                            {sem.label}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="font-mono text-xs font-semibold text-slate-700">
                            {emp.scoreV3.toFixed(1)}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${prio.bg} ${prio.text}`}
                          >
                            {emp.prioridadReduccion}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {emp.esComodin && (
                              <span
                                className="rounded bg-sky-100 px-1 py-0.5 text-[9px] font-bold text-sky-700"
                                title="Comodín"
                              >
                                🔄
                              </span>
                            )}
                            {emp.aceptaExtras && (
                              <span
                                className="rounded bg-emerald-100 px-1 py-0.5 text-[9px] font-bold text-emerald-700"
                                title="Acepta extras"
                              >
                                +
                              </span>
                            )}
                            {emp.tieneBolsa && (
                              <span
                                className="rounded bg-purple-100 px-1 py-0.5 text-[9px] font-bold text-purple-700"
                                title="Tiene bolsa"
                              >
                                💼
                              </span>
                            )}
                          </div>
                        </td>
                        <td
                          className="px-3 py-3 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => handleToggle(emp.id)}
                            disabled={isPending}
                            className={`rounded px-2 py-1 text-[10px] font-medium transition-colors ${
                              emp.activa
                                ? "border border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                                : "border border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                            }`}
                          >
                            {emp.activa ? "Desactivar" : "Activar"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ═══ DETALLE ═══ */}
      {modo === "detalle" && empresaSel && (
        <EmpresaDetalle
          detalle={empresaSel}
          onEditar={() => setModo("editar")}
          onToggle={() => handleToggle(empresaSel.empresa.id)}
          isPending={isPending}
        />
      )}

      {/* ═══ CREAR ═══ */}
      {modo === "crear" && (
        <EmpresaForm
          titulo="Nueva empresa"
          onSubmit={handleCrear}
          onCancel={() => setModo("lista")}
          loading={isPending}
        />
      )}

      {/* ═══ EDITAR ═══ */}
      {modo === "editar" && empresaSel && (
        <EmpresaForm
          titulo={`Editar: ${empresaSel.empresa.nombre}`}
          initial={empresaSel.empresa}
          onSubmit={handleEditar}
          onCancel={() => setModo("detalle")}
          loading={isPending}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// DETALLE
// ══════════════════════════════════════════════════════════════

function EmpresaDetalle({
  detalle,
  onEditar,
  onToggle,
  isPending,
}: {
  detalle: EmpresaDetalleCompleto;
  onEditar: () => void;
  onToggle: () => void;
  isPending: boolean;
}) {
  const emp = detalle.empresa;
  const sem = SEMAFORO_STYLE[emp.semaforo] || SEMAFORO_STYLE.AMBAR;
  const prio = PRIORIDAD_STYLE[emp.prioridadReduccion] || PRIORIDAD_STYLE.MEDIA;

  return (
    <div className="space-y-5">
      {/* Card principal */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className={`h-4 w-4 rounded-full ${sem.dot}`} />
              <h2 className="text-lg font-bold text-slate-900">{emp.nombre}</h2>
              {!emp.activa && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                  INACTIVA
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {emp.tipo} · Score {emp.scoreV3.toFixed(1)} · Fiabilidad{" "}
              {(emp.fiabilidadReciente * 100).toFixed(0)}%
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onEditar}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              Editar
            </button>
            <button
              onClick={onToggle}
              disabled={isPending}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                emp.activa
                  ? "border border-red-200 text-red-600 hover:bg-red-50"
                  : "border border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
              }`}
            >
              {emp.activa ? "Desactivar" : "Activar"}
            </button>
          </div>
        </div>

        {/* Datos grid */}
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <DetailField
            label="Semáforo"
            value={sem.label}
            badge={`${sem.bg} ${sem.text}`}
          />
          <DetailField
            label="Tipo"
            value={emp.tipo}
            badge={TIPO_STYLE[emp.tipo]}
          />
          <DetailField
            label="Reducción"
            value={prio.label}
            badge={`${prio.bg} ${prio.text}`}
          />
          <DetailField
            label="Turno"
            value={emp.turnoPreferido || "Sin preferencia"}
          />
          <DetailField label="Comodín" value={emp.esComodin ? "Sí" : "No"} />
          <DetailField
            label="Acepta extras"
            value={
              emp.aceptaExtras ? `Sí (max ${emp.maxExtrasTrimestre})` : "No"
            }
          />
          <DetailField label="Bolsa" value={emp.tieneBolsa ? "Sí" : "No"} />
          <DetailField label="Score V3" value={emp.scoreV3.toFixed(2)} />
        </div>

        {emp.notas && (
          <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-3">
            <span className="text-[10px] font-medium uppercase text-slate-400">
              Notas
            </span>
            <p className="mt-1 text-sm text-slate-600">{emp.notas}</p>
          </div>
        )}
      </div>

      {/* Restricciones */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">
          Restricciones ({detalle.restricciones.length})
        </h3>
        {detalle.restricciones.length === 0 ? (
          <p className="text-sm text-slate-400">
            Sin restricciones configuradas
          </p>
        ) : (
          <div className="space-y-2">
            {detalle.restricciones.map((r: any) => (
              <div
                key={r.id}
                className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2"
              >
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    r.tipo === "HARD"
                      ? "bg-red-100 text-red-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {r.tipo}
                </span>
                <span className="text-sm font-medium text-slate-700">
                  {r.clave}
                </span>
                <span className="font-mono text-sm text-slate-600">
                  = {r.valor}
                </span>
                {r.descripcion && (
                  <span className="text-xs text-slate-400 italic">
                    ({r.descripcion})
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ciudades */}
      {detalle.ciudades.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">
            Ciudades
          </h3>
          <div className="flex gap-2 flex-wrap">
            {detalle.ciudades.map((c: any) => (
              <span
                key={c.id}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  c.activaReciente
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-slate-50 text-slate-500"
                }`}
              >
                {c.nombre} {c.activaReciente ? "✓" : ""}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Histórico reciente */}
      {detalle.historico_reciente.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">
            Histórico reciente
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {detalle.historico_reciente.map((h: any) => (
              <div
                key={h.trimestre}
                className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"
              >
                <span className="text-sm font-semibold text-slate-700">
                  {h.trimestre}
                </span>
                <div className="flex gap-3 text-xs">
                  <span className="text-emerald-600">{h.ok} OK</span>
                  <span className="text-red-600">
                    {h.cancelados} cancelados
                  </span>
                  <span className="text-slate-400">{h.total} total</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// FORM (crear + editar)
// ══════════════════════════════════════════════════════════════

function EmpresaForm({
  titulo,
  initial,
  onSubmit,
  onCancel,
  loading,
}: {
  titulo: string;
  initial?: any;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [form, setForm] = useState({
    nombre: initial?.nombre || "",
    tipo: initial?.tipo || "AMBAS",
    semaforo: initial?.semaforo || "AMBAR",
    scoreV3: initial?.scoreV3?.toString() || "0",
    fiabilidadReciente: initial?.fiabilidadReciente?.toString() || "0",
    esComodin: initial?.esComodin ?? false,
    aceptaExtras: initial?.aceptaExtras ?? false,
    maxExtrasTrimestre: initial?.maxExtrasTrimestre?.toString() || "0",
    prioridadReduccion: initial?.prioridadReduccion || "MEDIA",
    tieneBolsa: initial?.tieneBolsa ?? false,
    turnoPreferido: initial?.turnoPreferido || "",
    notas: initial?.notas || "",
  });

  function set(field: string, value: any) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit() {
    if (!form.nombre.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    const data: any = {
      nombre: form.nombre.trim(),
      tipo: form.tipo,
      semaforo: form.semaforo,
      scoreV3: parseFloat(form.scoreV3) || 0,
      fiabilidadReciente: parseFloat(form.fiabilidadReciente) || 0,
      esComodin: form.esComodin,
      aceptaExtras: form.aceptaExtras,
      maxExtrasTrimestre: parseInt(form.maxExtrasTrimestre) || 0,
      prioridadReduccion: form.prioridadReduccion,
      tieneBolsa: form.tieneBolsa,
      turnoPreferido: form.turnoPreferido || null,
      notas: form.notas || null,
    };
    onSubmit(data);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-700 mb-5">{titulo}</h2>

      <div className="space-y-5">
        {/* Nombre */}
        <FormField label="Nombre *" hint="Nombre único de la empresa">
          <input
            type="text"
            value={form.nombre}
            onChange={(e) => set("nombre", e.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-500"
            placeholder="Ej: Accenture"
          />
        </FormField>

        {/* Row: Tipo + Semáforo + Prioridad */}
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Tipo">
            <select
              value={form.tipo}
              onChange={(e) => set("tipo", e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-500"
            >
              <option value="EF">EF</option>
              <option value="IT">IT</option>
              <option value="AMBAS">AMBAS</option>
            </select>
          </FormField>

          <FormField label="Semáforo">
            <select
              value={form.semaforo}
              onChange={(e) => set("semaforo", e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-500"
            >
              <option value="VERDE">Verde</option>
              <option value="AMBAR">Ámbar</option>
              <option value="ROJO">Rojo</option>
            </select>
          </FormField>

          <FormField label="Prioridad reducción">
            <select
              value={form.prioridadReduccion}
              onChange={(e) => set("prioridadReduccion", e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-500"
            >
              <option value="BAJA">Baja (protegida)</option>
              <option value="MEDIA">Media</option>
              <option value="ALTA">Alta (recortar primero)</option>
            </select>
          </FormField>
        </div>

        {/* Row: Scores */}
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Score V3" hint="0-100">
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={form.scoreV3}
              onChange={(e) => set("scoreV3", e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </FormField>

          <FormField label="Fiabilidad reciente" hint="0-1">
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={form.fiabilidadReciente}
              onChange={(e) => set("fiabilidadReciente", e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </FormField>

          <FormField label="Turno preferido">
            <select
              value={form.turnoPreferido}
              onChange={(e) => set("turnoPreferido", e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-500"
            >
              <option value="">Sin preferencia</option>
              <option value="mañana">Mañana</option>
              <option value="tarde">Tarde</option>
            </select>
          </FormField>
        </div>

        {/* Row: Flags */}
        <div className="grid gap-4 sm:grid-cols-4">
          <CheckboxField
            label="Es comodín"
            checked={form.esComodin}
            onChange={(v) => set("esComodin", v)}
            hint="Puede sustituir cancelaciones"
          />
          <CheckboxField
            label="Acepta extras"
            checked={form.aceptaExtras}
            onChange={(v) => set("aceptaExtras", v)}
            hint="Acepta talleres extra"
          />
          <CheckboxField
            label="Tiene bolsa"
            checked={form.tieneBolsa}
            onChange={(v) => set("tieneBolsa", v)}
            hint="Bolsa de voluntarios"
          />
          <FormField label="Max extras/trim.">
            <input
              type="number"
              min="0"
              max="10"
              value={form.maxExtrasTrimestre}
              onChange={(e) => set("maxExtrasTrimestre", e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </FormField>
        </div>

        {/* Notas */}
        <FormField
          label="Notas"
          hint="Información adicional para el planificador"
        >
          <textarea
            value={form.notas}
            onChange={(e) => set("notas", e.target.value)}
            rows={3}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-500"
            placeholder="Ej: Contacto preferido María García, tlf 600..."
          />
        </FormField>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Spinner />
                Guardando...
              </>
            ) : initial ? (
              "Guardar cambios"
            ) : (
              "Crear empresa"
            )}
          </button>
          <button
            onClick={onCancel}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════

function DetailField({
  label,
  value,
  badge,
}: {
  label: string;
  value: string;
  badge?: string;
}) {
  return (
    <div>
      <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
        {label}
      </span>
      {badge ? (
        <div className="mt-1">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge}`}
          >
            {value}
          </span>
        </div>
      ) : (
        <div className="mt-1 text-sm font-medium text-slate-800">{value}</div>
      )}
    </div>
  );
}

function FormField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

function CheckboxField({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-slate-200 p-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
      />
      <div>
        <span className="text-sm font-medium text-slate-700">{label}</span>
        {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  const cls =
    color === "emerald"
      ? "text-emerald-600"
      : color === "amber"
        ? "text-amber-600"
        : color === "red"
          ? "text-red-600"
          : color === "blue"
            ? "text-blue-600"
            : "text-slate-800";
  return (
    <div className="flex-1 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
        {label}
      </div>
      <div className={`mt-0.5 text-lg font-bold ${cls}`}>{value}</div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
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
  );
}

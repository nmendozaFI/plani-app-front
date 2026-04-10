"use client";

import { useState, useEffect, useCallback } from "react";

import type { TallerOut, TallerCreate } from "@/lib/api";
import { actionCrearTaller, actionEditarTaller, actionEliminarTaller, actionObtenerTalleres } from "@/actions/talleres-actions";

// ── Constants ────────────────────────────────────────────────

const DIAS = ["L", "M", "X", "J", "V"] as const;
const DIAS_LABEL: Record<string, string> = {
  L: "Lunes", M: "Martes", X: "Miércoles", J: "Jueves", V: "Viernes",
};
const HORARIOS = ["09:30-11:30", "12:00-14:00", "15:00-17:00"];
const TURNOS = ["mañana", "tarde"];

// ── Component ────────────────────────────────────────────────

export function TalleresCrud() {
  const [talleres, setTalleres] = useState<TallerOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtroPrograma, setFiltroPrograma] = useState<string>("");
  const [mostrarInactivos, setMostrarInactivos] = useState(false);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<TallerOut | null>(null);
  const [formData, setFormData] = useState<TallerCreate>(emptyForm());
  const [saving, setSaving] = useState(false);

  // Confirm delete
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  // ── Load ───────────────────────────────────────────────────

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await actionObtenerTalleres(
      filtroPrograma || undefined,
      !mostrarInactivos
    );
    if (err) setError(err);
    else setTalleres(data ?? []);
    setLoading(false);
  }, [filtroPrograma, mostrarInactivos]);

  useEffect(() => {
    (async () => { await cargar(); })();
  }, [cargar]);

  // ── Handlers ───────────────────────────────────────────────

  const handleNuevo = () => {
    setEditando(null);
    setFormData(emptyForm());
    setShowForm(true);
  };

  const handleEditar = (t: TallerOut) => {
    setEditando(t);
    setFormData({
      nombre: t.nombre,
      programa: t.programa,
      dia_semana: t.dia_semana,
      horario: t.horario,
      turno: t.turno,
      es_contratante: t.es_contratante,
      descripcion: t.descripcion,
      activo: t.activo,
    });
    setShowForm(true);
  };

  const handleCancelar = () => {
    setShowForm(false);
    setEditando(null);
    setFormData(emptyForm());
  };

  const handleGuardar = async () => {
    setSaving(true);
    setError(null);

    if (!formData.nombre?.trim()) {
      setError("El nombre es obligatorio");
      setSaving(false);
      return;
    }

    if (editando) {
      const { error: err } = await actionEditarTaller(editando.id, formData);
      if (err) setError(err);
      else handleCancelar();
    } else {
      const { error: err } = await actionCrearTaller(formData);
      if (err) setError(err);
      else handleCancelar();
    }
    setSaving(false);
    cargar();
  };

  const handleEliminar = async (id: number) => {
    const { error: err } = await actionEliminarTaller(id);
    if (err) setError(err);
    setConfirmDelete(null);
    cargar();
  };

  const handleToggleActivo = async (t: TallerOut) => {
    await actionEditarTaller(t.id, { activo: !t.activo });
    cargar();
  };

  // ── Stats ──────────────────────────────────────────────────

  const totalEF = talleres.filter((t) => t.programa === "EF").length;
  const totalIT = talleres.filter((t) => t.programa === "IT").length;
  const activos = talleres.filter((t) => t.activo).length;

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Talleres
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Catálogo de slots fijos · 14 EF + 6 IT por semana
          </p>
        </div>
        <button
          onClick={handleNuevo}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-slate-800"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nuevo taller
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total" value={talleres.length} />
        <StatCard label="EF" value={totalEF} color="slate" />
        <StatCard label="IT" value={totalIT} color="violet" />
        <StatCard label="Activos" value={activos} color="emerald" />
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-slate-700">
            {editando ? `Editar taller #${editando.id}` : "Nuevo taller"}
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Nombre */}
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="block text-xs font-medium text-slate-500 mb-1">Nombre *</label>
              <input
                type="text"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                placeholder="Ej: CV + Entrevista"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              />
            </div>

            {/* Programa */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Programa *</label>
              <select
                value={formData.programa}
                onChange={(e) => setFormData({ ...formData, programa: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              >
                <option value="EF">EF — Empleo y Formación</option>
                <option value="IT">IT — Inserción Tecnológica</option>
              </select>
            </div>

            {/* Día */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Día de la semana</label>
              <select
                value={formData.dia_semana ?? ""}
                onChange={(e) => setFormData({ ...formData, dia_semana: e.target.value || null })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              >
                <option value="">Sin asignar</option>
                {DIAS.map((d) => (
                  <option key={d} value={d}>{DIAS_LABEL[d]}</option>
                ))}
              </select>
            </div>

            {/* Horario */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Horario</label>
              <select
                value={formData.horario ?? ""}
                onChange={(e) => setFormData({ ...formData, horario: e.target.value || null })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              >
                <option value="">Sin asignar</option>
                {HORARIOS.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            {/* Turno */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Turno</label>
              <select
                value={formData.turno ?? ""}
                onChange={(e) => setFormData({ ...formData, turno: e.target.value || null })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              >
                <option value="">Automático</option>
                {TURNOS.map((t) => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>

            {/* Es contratante */}
            <div className="flex items-center gap-2 pt-5">
              <input
                type="checkbox"
                id="es_contratante"
                checked={formData.es_contratante ?? false}
                onChange={(e) => setFormData({ ...formData, es_contratante: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
              />
              <label htmlFor="es_contratante" className="text-sm text-slate-700">
                Es contratante
              </label>
            </div>

            {/* Descripción */}
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-xs font-medium text-slate-500 mb-1">Descripción</label>
              <input
                type="text"
                value={formData.descripcion ?? ""}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value || null })}
                placeholder="Opcional"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              />
            </div>

            {/* Activo */}
            {editando && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="activo"
                  checked={formData.activo ?? true}
                  onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                />
                <label htmlFor="activo" className="text-sm text-slate-700">Activo</label>
              </div>
            )}
          </div>

          {/* Botones */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleGuardar}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Spinner /> Guardando...
                </>
              ) : editando ? (
                "Guardar cambios"
              ) : (
                "Crear taller"
              )}
            </button>
            <button
              onClick={handleCancelar}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex items-center gap-3">
        <select
          value={filtroPrograma}
          onChange={(e) => setFiltroPrograma(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        >
          <option value="">Todos los programas</option>
          <option value="EF">Solo EF</option>
          <option value="IT">Solo IT</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={mostrarInactivos}
            onChange={(e) => setMostrarInactivos(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
          />
          Mostrar inactivos
        </label>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
          <span className="ml-2 text-sm text-slate-500">Cargando talleres...</span>
        </div>
      ) : talleres.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <p className="text-sm text-slate-500">No hay talleres{filtroPrograma ? ` de tipo ${filtroPrograma}` : ""}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Nombre</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Programa</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Día</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Horario</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Turno</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Estado</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {talleres.map((t) => (
                  <tr
                    key={t.id}
                    className={`transition-colors ${
                      !t.activo ? "bg-slate-50/50 opacity-60" : "hover:bg-slate-50/50"
                    }`}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">{t.id}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-800">{t.nombre}</span>
                        {t.es_contratante && (
                          <span className="rounded bg-amber-100 px-1 py-0.5 text-[10px] font-semibold text-amber-700">
                            CONTRATANTE
                          </span>
                        )}
                      </div>
                      {t.descripcion && (
                        <div className="mt-0.5 text-[11px] text-slate-400">{t.descripcion}</div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          t.programa === "EF"
                            ? "bg-slate-100 text-slate-700"
                            : "bg-violet-100 text-violet-700"
                        }`}
                      >
                        {t.programa}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center text-slate-700">
                      {t.dia_semana ? DIAS_LABEL[t.dia_semana] ?? t.dia_semana : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center font-mono text-xs text-slate-600">
                      {t.horario ?? <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-3 text-center text-slate-600 capitalize">
                      {t.turno ?? <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <button
                        onClick={() => handleToggleActivo(t)}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                          t.activo
                            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                            : "bg-red-100 text-red-600 hover:bg-red-200"
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${t.activo ? "bg-emerald-500" : "bg-red-400"}`} />
                        {t.activo ? "Activo" : "Inactivo"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleEditar(t)}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                          title="Editar"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round"
                              d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                          </svg>
                        </button>
                        {confirmDelete === t.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleEliminar(t.id)}
                              className="rounded-md bg-red-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-red-700 transition-colors"
                            >
                              Confirmar
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="rounded-md px-2 py-1 text-[11px] font-medium text-slate-500 hover:text-slate-700"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(t.id)}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                            title="Eliminar"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round"
                                d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>

              {/* Footer */}
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50">
                  <td colSpan={2} className="px-4 py-3 text-right text-xs font-bold text-slate-600 uppercase">
                    Totales
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className="font-mono text-xs font-bold text-slate-600">
                      {totalEF} EF · {totalIT} IT
                    </span>
                  </td>
                  <td colSpan={5} className="px-3 py-3 text-center text-xs text-slate-400">
                    {activos} activos / {talleres.length} total
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────

function emptyForm(): TallerCreate {
  return {
    nombre: "",
    programa: "EF",
    dia_semana: null,
    horario: null,
    turno: null,
    es_contratante: false,
    descripcion: null,
    activo: true,
  };
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  const cls =
    color === "emerald" ? "text-emerald-600"
    : color === "violet" ? "text-violet-600"
    : "text-slate-900";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className="mt-1">
        <span className={`text-xl font-bold tabular-nums ${cls}`}>{value}</span>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
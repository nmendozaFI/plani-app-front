"use client";

import { useState, useMemo, useTransition } from "react";
import { toast } from "sonner";
import { RestriccionesCrud } from "./RestriccionesCrud";
import type { Restriccion } from "@/actions/restricciones-actions";

// ── Props ────────────────────────────────────────────────────

interface Props {
  empresas: { id: number; nombre: string }[];
  restricciones: Restriccion[];
  talleres: { id: number; nombre: string; programa: string }[];
}

// ── Component ────────────────────────────────────────────────

export function RestriccionesPageClient({ empresas, restricciones, talleres }: Props) {
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<"todas" | "con" | "sin">("todas");
  const [importando, setImportando] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Agrupar restricciones por empresa
  const restriccionesPorEmpresa = useMemo(() => {
    const map: Record<number, Restriccion[]> = {};
    for (const r of restricciones) {
      if (!map[r.empresa_id]) map[r.empresa_id] = [];
      map[r.empresa_id].push(r);
    }
    return map;
  }, [restricciones]);

  // Filtrar y ordenar empresas
  const empresasFiltradas = useMemo(() => {
    let result = [...empresas];

    // Búsqueda por nombre
    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase();
      result = result.filter((e) => e.nombre.toLowerCase().includes(q));
    }

    // Filtro por estado
    if (filtro === "con") {
      result = result.filter((e) => (restriccionesPorEmpresa[e.id]?.length ?? 0) > 0);
    } else if (filtro === "sin") {
      result = result.filter((e) => !restriccionesPorEmpresa[e.id]?.length);
    }

    // Ordenar: con restricciones primero, luego alfabético
    result.sort((a, b) => {
      const aHas = (restriccionesPorEmpresa[a.id]?.length ?? 0) > 0 ? 0 : 1;
      const bHas = (restriccionesPorEmpresa[b.id]?.length ?? 0) > 0 ? 0 : 1;
      if (aHas !== bHas) return aHas - bHas;
      return a.nombre.localeCompare(b.nombre);
    });

    return result;
  }, [empresas, busqueda, filtro, restriccionesPorEmpresa]);

  const conRestricciones = empresas.filter(
    (e) => (restriccionesPorEmpresa[e.id]?.length ?? 0) > 0
  ).length;

  // ── Import Excel ───────────────────────────────────────────

  async function handleImportExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportando(true);
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API}/api/restricciones/importar`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Error ${res.status}`);
      }

      const result = await res.json();
      toast.success(
        `Importadas ${result.creadas} restricciones` +
        (result.actualizadas ? `, ${result.actualizadas} actualizadas` : "") +
        (result.errores?.length ? `. ${result.errores.length} errores.` : "")
      );

      // Recargar página para reflejar cambios
      window.location.reload();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setImportando(false);
      // Reset input
      e.target.value = "";
    }
  }

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Restricciones por empresa
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {conRestricciones} empresa{conRestricciones !== 1 ? "s" : ""} con restricciones
            {" · "}
            {restricciones.length} restricción{restricciones.length !== 1 ? "es" : ""} total
          </p>
        </div>

        {/* Importar Excel */}
        <div className="shrink-0">
          <label
            className={`inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 cursor-pointer transition-colors ${
              importando ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
            </svg>
            {importando ? "Importando..." : "Importar Excel"}
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImportExcel}
              className="hidden"
              disabled={importando}
            />
          </label>
        </div>
      </div>

      {/* Búsqueda + Filtros */}
      <div className="flex items-center gap-3">
        {/* Buscador */}
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
            fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar empresa..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 py-2 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
          {busqueda && (
            <button
              onClick={() => setBusqueda("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Filtro */}
        <select
          value={filtro}
          onChange={(e) => setFiltro(e.target.value as typeof filtro)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        >
          <option value="todas">Todas ({empresas.length})</option>
          <option value="con">Con restricciones ({conRestricciones})</option>
          <option value="sin">Sin restricciones ({empresas.length - conRestricciones})</option>
        </select>
      </div>

      {/* Resultados */}
      <div className="text-xs text-slate-400">
        {empresasFiltradas.length === empresas.length
          ? `${empresas.length} empresas`
          : `${empresasFiltradas.length} de ${empresas.length} empresas`}
      </div>

      {/* Info Excel format */}
      {importando && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          Procesando archivo...
        </div>
      )}

      {/* Grid de empresas */}
      {empresasFiltradas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <p className="text-sm text-slate-500">
            {busqueda
              ? `No se encontraron empresas con "${busqueda}"`
              : "No hay empresas que mostrar"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {empresasFiltradas.map((empresa) => (
            <RestriccionesCrud
              key={empresa.id}
              empresaId={empresa.id}
              empresaNombre={empresa.nombre}
              restriccionesIniciales={restriccionesPorEmpresa[empresa.id] ?? []}
              talleres={talleres.map((t) => ({
                id: t.id,
                nombre: t.nombre,
                programa: t.programa,
              }))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { obtenerConfigVista } from "@/lib/api";
import type { ConfigVistaResponse, ConfigFilaVista } from "@/types/config-import";

/**
 * V32 — Configuración del trimestre a simple vista (solo lectura).
 * Muestra las MISMAS filas/columnas que el Excel (vienen del backend, que
 * reusa plantilla.py). La edición sigue siendo por Excel: un solo camino de
 * escritura.
 */
export function ConfigVistaTabla({ trimestre }: { trimestre: string }) {
  const [data, setData] = useState<ConfigVistaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(true);

  // filtros
  const [q, setQ] = useState("");
  const [soloActivas, setSoloActivas] = useState(false);
  const [conReglas, setConReglas] = useState(false);
  const [sinTalleres, setSinTalleres] = useState(false);
  const [soloEP, setSoloEP] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await obtenerConfigVista(trimestre));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al cargar la configuración");
    } finally {
      setLoading(false);
    }
  }, [trimestre]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const filas = useMemo(() => {
    if (!data) return [];
    const term = q.trim().toLowerCase();
    return data.filas.filter((f) => {
      if (soloActivas && !f.activa) return false;
      if (conReglas && !f.tiene_reglas) return false;
      if (sinTalleres && !f.sin_talleres) return false;
      if (soloEP && !f.es_ep) return false;
      if (term && !f.empresa.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [data, q, soloActivas, conReglas, sinTalleres, soloEP]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <button
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold text-slate-800">
          Configuración actual (solo lectura)
        </span>
        <span className="text-xs text-slate-400">{abierto ? "▲ ocultar" : "▼ ver"}</span>
      </button>

      {abierto && (
        <div className="border-t border-slate-100 p-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          {loading && <div className="text-xs text-slate-400">Cargando…</div>}

          {data && !loading && (
            <>
              {/* Cabecera de totales */}
              <div className="mb-3 flex flex-wrap gap-2 text-xs">
                <Total
                  label="EF pedidos / capacidad"
                  valor={`${data.total_ef_pedido} / ${data.capacidad_ef}`}
                  alerta={data.total_ef_pedido > data.capacidad_ef}
                />
                <Total
                  label="IT pedidos / capacidad"
                  valor={`${data.total_it_pedido} / ${data.capacidad_it}`}
                  alerta={data.total_it_pedido > data.capacidad_it}
                />
                <Total label="Activas" valor={`${data.n_activas} / ${data.n_empresas}`} />
                <Total label="EP" valor={`${data.n_ep}`} />
                <Total label="Con reglas" valor={`${data.n_con_reglas}`} />
              </div>

              {/* Filtros */}
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={q}
                  placeholder="Buscar empresa…"
                  onChange={(e) => setQ(e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                />
                <Chip on={soloActivas} onClick={() => setSoloActivas((v) => !v)}>Solo activas</Chip>
                <Chip on={conReglas} onClick={() => setConReglas((v) => !v)}>Con reglas</Chip>
                <Chip on={sinTalleres} onClick={() => setSinTalleres((v) => !v)}>Sin talleres</Chip>
                <Chip on={soloEP} onClick={() => setSoloEP((v) => !v)}>Solo EP</Chip>
                <span className="text-xs text-slate-400">{filas.length} empresa(s)</span>
              </div>

              {/* Tabla */}
              <div className="overflow-x-auto rounded-lg border border-slate-100">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-left text-slate-500">
                      {data.headers_editables.map((h) => (
                        <th key={h} className="whitespace-nowrap px-2 py-1.5 font-medium">{h}</th>
                      ))}
                      {data.headers_grises.map((h) => (
                        <th key={h} className="whitespace-nowrap bg-slate-100 px-2 py-1.5 font-medium text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f) => (
                      <Fila
                        key={f.empresa}
                        f={f}
                        headersEditables={data.headers_editables}
                        headersGrises={data.headers_grises}
                      />
                    ))}
                    {filas.length === 0 && (
                      <tr>
                        <td colSpan={data.headers_editables.length + data.headers_grises.length}
                          className="px-2 py-4 text-center text-slate-400">
                          Sin resultados con esos filtros.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[11px] text-slate-400">
                Columnas grises = solo lectura. Para editar, descargá la plantilla y volvé a subirla.
                Las empresas con <span className="font-medium">regla</span> tienen reglas permanentes (Días/Franja/Taller fijo).
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Fila({ f, headersEditables, headersGrises }: {
  f: ConfigFilaVista;
  headersEditables: string[];
  headersGrises: string[];
}) {
  return (
    <tr className={`border-t border-slate-100 ${f.activa ? "" : "opacity-50"}`}>
      {headersEditables.map((h, i) => (
        <td key={h} className="whitespace-nowrap px-2 py-1.5 text-slate-700">
          {i === 0 ? (
            <span className="flex items-center gap-1.5">
              <span className="font-medium">{String(f.valores[h] ?? "")}</span>
              {f.tiene_reglas && (
                <span className="rounded bg-purple-100 px-1 py-0.5 text-[9px] font-medium text-purple-700">regla</span>
              )}
              {f.es_ep && (
                <span className="rounded bg-emerald-100 px-1 py-0.5 text-[9px] font-medium text-emerald-700">EP</span>
              )}
            </span>
          ) : (
            String(f.valores[h] ?? "")
          )}
        </td>
      ))}
      {headersGrises.map((h) => (
        <td key={h} className="whitespace-nowrap bg-slate-50 px-2 py-1.5 text-slate-400">
          {String(f.grises[h] ?? "")}
        </td>
      ))}
    </tr>
  );
}

function Total({ label, valor, alerta }: { label: string; valor: string; alerta?: boolean }) {
  return (
    <span className={`rounded-lg border px-3 py-1.5 ${alerta ? "border-amber-300 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
      <span className="text-slate-400">{label}: </span>
      <span className="font-semibold">{valor}</span>
    </span>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium ${
        on ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

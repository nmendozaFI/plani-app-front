/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useCallback, useEffect, type ReactNode } from "react";
import {
  descargarPlantillaConfig,
  importarConfigTrimestre,
  listarTrimestresEstado,
  inicializarConfigTrimestral,
} from "@/lib/api";
import type {
  PlanConfigResponse,
  TrimestreEstado,
} from "@/types/config-import";
import { ConfigVistaTabla } from "@/components/planificacion/ConfigVistaTabla";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

export function ConfiguracionTrimestrePage() {
  const [trimestres, setTrimestres] = useState<TrimestreEstado[]>([]);
  const [trimestre, setTrimestre] = useState<string | null>(null);
  const [loadingTrimestres, setLoadingTrimestres] = useState(true);

  const [file, setFile] = useState<File | null>(null);
  const [plan, setPlan] = useState<PlanConfigResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmApply, setConfirmApply] = useState(false);

  useEffect(() => {
    listarTrimestresEstado()
      .then((res) => {
        setTrimestres(res.trimestres);
        setTrimestre(
          (cur) =>
            cur ?? res.a_planificar ?? res.activo ?? res.trimestres[0]?.trimestre ?? null,
        );
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Error al cargar trimestres"),
      )
      .finally(() => setLoadingTrimestres(false));
  }, []);

  const trimestreInfo = trimestres.find((t) => t.trimestre === trimestre) ?? null;
  const cerrado = trimestreInfo?.estado === "cerrado";
  const enOperacion = trimestreInfo?.estado === "en_operacion";

  // Inicializar/clonar la CT de un trimestre nuevo (no sobrescribe la existente).
  const [origen, setOrigen] = useState<string>("");
  const [initializing, setInitializing] = useState(false);
  const [initMsg, setInitMsg] = useState<string | null>(null);
  const [vistaKey, setVistaKey] = useState(0);

  const cambiarTrimestre = useCallback((t: string) => {
    // Cambiar de trimestre invalida el plan/archivo (era de otro trimestre).
    setTrimestre(t);
    setPlan(null);
    setFile(null);
    setError(null);
    setInitMsg(null);
    setOrigen(trimestreAnterior(t) ?? "");
  }, []);

  // Preseleccionar el trimestre anterior como origen cuando cambian los datos.
  useEffect(() => {
    if (trimestre) setOrigen((cur) => cur || (trimestreAnterior(trimestre) ?? ""));
  }, [trimestre]);

  const handleInicializar = useCallback(async () => {
    if (!trimestre || initializing) return;
    setInitializing(true);
    setInitMsg(null);
    setError(null);
    try {
      const res = await inicializarConfigTrimestral(trimestre, origen || undefined);
      setInitMsg(
        `Inicializado: ${res.clonadas} clonada(s) desde ${origen || "(default)"}, ` +
          `${res.nuevas} nueva(s). Total CT: ${res.total_configs}.`,
      );
      setVistaKey((k) => k + 1); // refresca la vista de config
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al inicializar");
    } finally {
      setInitializing(false);
    }
  }, [trimestre, origen, initializing]);

  const totalCambios = plan
    ? plan.por_empresa.reduce((s, e) => s + e.cambios.length, 0)
    : 0;
  const puedeAplicar =
    !!plan && !plan.bloqueado && !plan.aplicado && plan.por_empresa.length > 0 && !cerrado;

  const handleDescargar = useCallback(async () => {
    if (!trimestre) return;
    setDownloading(true); setError(null);
    try {
      const blob = await descargarPlantillaConfig(trimestre);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `config_trimestre_${trimestre}.xlsx`;
      a.click();
    } catch (e: any) { setError(e.message); }
    finally { setDownloading(false); }
  }, [trimestre]);

  const handleRevisar = useCallback(async () => {
    if (!trimestre || !file || loading) return;
    setLoading(true); setError(null); setPlan(null);
    try {
      const res = await importarConfigTrimestre(trimestre, file, true);
      setPlan(res);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [trimestre, file, loading]);

  const handleAplicar = useCallback(async () => {
    if (!trimestre || !file || loading) return;
    setConfirmApply(false);
    setLoading(true); setError(null);
    try {
      const res = await importarConfigTrimestre(trimestre, file, false);
      setPlan(res);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [trimestre, file, loading]);

  if (!loadingTrimestres && !trimestre) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        No hay trimestres disponibles. Ajusta el trimestre activo/siguiente en el Dashboard.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {confirmApply && trimestre && plan && (
        <Dialog open onOpenChange={(o) => { if (!o) setConfirmApply(false); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Aplicar configuración a {trimestre}</DialogTitle>
              <DialogDescription>
                Se escribirán {totalCambios} cambio{totalCambios !== 1 ? "s" : ""} en{" "}
                {plan.por_empresa.length} empresa{plan.por_empresa.length !== 1 ? "s" : ""}.
                Días/Taller fijo/Franja son reglas permanentes (afectan a todos los trimestres).
                {enOperacion && (
                  <span className="mt-2 block font-medium text-amber-700">
                    Este trimestre está en operación: el calendario ya cargado no cambia.
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <button onClick={() => setConfirmApply(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">
                Cancelar
              </button>
              <button onClick={handleAplicar}
                className="px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800">
                Aplicar cambios
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Header + selector de trimestre */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Configuración del trimestre</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Descargá la plantilla, editala y volvé a subirla.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="trimestre-sel" className="text-xs font-medium text-slate-500">
            Trimestre
          </label>
          <select
            id="trimestre-sel"
            value={trimestre ?? ""}
            onChange={(e) => cambiarTrimestre(e.target.value)}
            disabled={loadingTrimestres || loading}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-mono font-semibold text-slate-800 disabled:opacity-50"
          >
            {trimestres.map((t) => (
              <option key={t.trimestre} value={t.trimestre}>
                {t.trimestre}
                {t.es_a_planificar ? "  · a planificar" : ""}
                {t.estado === "en_operacion" ? "  · en operación" : ""}
                {t.estado === "cerrado" ? "  · cerrado" : ""}
              </option>
            ))}
          </select>
          {trimestreInfo && <EstadoBadge estado={trimestreInfo.estado} />}
        </div>
      </div>

      {/* Aviso de estado del trimestre */}
      {cerrado && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          <span className="font-semibold">Trimestre cerrado.</span> Podés revisar cambios, pero no aplicarlos.
        </div>
      )}
      {enOperacion && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          <span className="font-semibold">Trimestre en operación.</span> Aplicar NO cambia el calendario ya cargado;
          sí cambia las reglas permanentes (Días/Franja/Taller fijo/Turno) y los datos de empresa.
        </div>
      )}

      {/* Inicializar / clonar CT (trimestre nuevo) */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="text-sm font-semibold text-slate-800">¿Trimestre nuevo? Inicializar configuración</div>
        <p className="mt-1 text-xs text-slate-500">
          Crea la configuración trimestral clonándola de otro trimestre (o vacía). No sobrescribe la
          que ya exista: solo agrega las empresas que falten.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label htmlFor="origen-sel" className="text-xs font-medium text-slate-500">Clonar desde</label>
          <select
            id="origen-sel"
            value={trimestres.some((t) => t.trimestre === origen) ? origen : ""}
            onChange={(e) => setOrigen(e.target.value)}
            disabled={initializing}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-mono disabled:opacity-50"
          >
            <option value="">(crear vacío)</option>
            {trimestres
              .filter((t) => t.trimestre !== trimestre)
              .map((t) => (
                <option key={t.trimestre} value={t.trimestre}>{t.trimestre}</option>
              ))}
          </select>
          <button
            onClick={handleInicializar}
            disabled={!trimestre || initializing}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {initializing ? "Inicializando…" : "Inicializar"}
          </button>
        </div>
        {initMsg && (
          <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            {initMsg}
          </div>
        )}
      </div>

      {/* Config a simple vista (solo lectura) */}
      {trimestre && <ConfigVistaTabla key={`${trimestre}:${vistaKey}`} trimestre={trimestre} />}

      {/* 4 acciones */}
      <div className="grid gap-3 sm:grid-cols-2">
        {/* 1 · Descargar */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm font-semibold text-slate-800">1 · Descargar plantilla</div>
          <p className="mt-1 text-xs text-slate-500">Con el estado actual prellenado. Editá la hoja «Empresas».</p>
          <button onClick={handleDescargar} disabled={!trimestre || downloading}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">
            {downloading ? "Generando…" : "⬇ Descargar plantilla"}
          </button>
        </div>

        {/* 2 · Subir + 3 · Revisar */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm font-semibold text-slate-800">2 · Subir y revisar</div>
          <p className="mt-1 text-xs text-slate-500">No escribe nada: solo muestra qué cambiaría.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input type="file" accept=".xlsx,.xls"
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPlan(null); }}
              className="text-xs" />
            <button onClick={handleRevisar} disabled={!file || loading}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              {loading ? "Revisando…" : "Revisar cambios"}
            </button>
          </div>
          {file && <p className="mt-2 text-xs text-slate-500 truncate">{file.name}</p>}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
      )}

      {/* Plan / resultado */}
      {plan && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-sm text-slate-700">
              {plan.aplicado
                ? <span className="font-semibold text-emerald-700">✓ Aplicado. </span>
                : plan.bloqueado
                  ? <span className="font-semibold text-red-700">Bloqueado por errores. </span>
                  : <span className="font-semibold text-slate-800">Vista previa. </span>}
              {plan.resumen}
            </div>
            {/* 4 · Aplicar */}
            <button onClick={() => setConfirmApply(true)} disabled={!puedeAplicar || loading}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed">
              4 · Aplicar cambios
            </button>
          </div>

          {/* Errores (primero) */}
          {plan.errores.length > 0 && (
            <Seccion titulo={`Errores (${plan.errores.length}) — hay que corregir el Excel`} tono="red">
              {plan.errores.map((er, i) => (
                <div key={i} className="text-xs text-red-800">
                  <span className="font-semibold">Fila {er.fila_excel} · {er.empresa}:</span> {er.mensaje}
                  {er.sugerencias.length > 0 && (
                    <span className="text-red-600"> → {er.sugerencias.join(", ")}</span>
                  )}
                </div>
              ))}
            </Seccion>
          )}

          {/* Avisos */}
          {plan.avisos.length > 0 && (
            <Seccion titulo={`Avisos (${plan.avisos.length}) — no bloquean`} tono="amber">
              {plan.avisos.map((a, i) => (
                <div key={i} className="text-xs text-amber-800">
                  <span className="font-semibold">{a.empresa}:</span> {a.mensaje}
                </div>
              ))}
            </Seccion>
          )}

          {/* Cambios por empresa */}
          {plan.por_empresa.length > 0 && (
            <Seccion titulo={`Cambios (${totalCambios}) en ${plan.por_empresa.length} empresa(s)`} tono="slate">
              {plan.por_empresa.map((e) => (
                <div key={`${e.empresa_id}-${e.nombre}`} className="rounded-lg border border-slate-100 bg-white px-3 py-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                    {e.nombre}
                    {e.es_nueva && <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700">nueva</span>}
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {e.cambios.map((c, j) => (
                      <div key={j} className="text-xs text-slate-600">
                        {c.campo}: <span className="text-slate-400">{c.antes}</span>
                        {" → "}
                        <span className="font-medium text-slate-800">{c.despues}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </Seccion>
          )}

          {plan.por_empresa.length === 0 && plan.errores.length === 0 && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
              Sin cambios: el archivo coincide con el estado actual.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function trimestreAnterior(t: string): string | null {
  const m = t.match(/^(\d{4})-Q([1-4])$/);
  if (!m) return null;
  let year = Number(m[1]);
  let q = Number(m[2]) - 1;
  if (q < 1) {
    q = 4;
    year -= 1;
  }
  return `${year}-Q${q}`;
}

function EstadoBadge({ estado }: { estado: TrimestreEstado["estado"] }) {
  const map: Record<TrimestreEstado["estado"], { txt: string; cls: string }> = {
    sin_planificar: { txt: "sin planificar", cls: "bg-slate-100 text-slate-600" },
    planificado: { txt: "planificado", cls: "bg-blue-100 text-blue-700" },
    en_operacion: { txt: "en operación", cls: "bg-amber-100 text-amber-800" },
    cerrado: { txt: "cerrado", cls: "bg-red-100 text-red-700" },
  };
  const { txt, cls } = map[estado];
  return (
    <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${cls}`}>{txt}</span>
  );
}

function Seccion({ titulo, tono, children }: {
  titulo: string;
  tono: "red" | "amber" | "slate";
  children: ReactNode;
}) {
  const borde = tono === "red" ? "border-red-200 bg-red-50/50"
    : tono === "amber" ? "border-amber-200 bg-amber-50/50"
    : "border-slate-200 bg-slate-50/50";
  return (
    <div className={`rounded-xl border ${borde} p-4`}>
      <div className="mb-2 text-sm font-semibold text-slate-800">{titulo}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

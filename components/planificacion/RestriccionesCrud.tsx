/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  type Restriccion,
  type RestriccionInput,
  crearRestriccion,
  editarRestriccion,
  borrarRestriccion,
} from "@/actions/restricciones-actions";

// ── Catálogo de claves para la UI ─────────────────────────────

const CLAVES = [
  {
    value: "solo_dia",
    label: "Solo día",
    descripcion: "La empresa solo puede impartir en un día concreto",
    tipo_default: "HARD" as const,
    render_valor: "dia",
  },
  {
    value: "solo_taller",
    label: "Solo taller",
    descripcion: "La empresa solo imparte un taller específico",
    tipo_default: "HARD" as const,
    render_valor: "taller",
  },
  {
    value: "no_comodin",
    label: "No usar como comodín",
    descripcion: "Excluir de sustituciones por cancelaciones",
    tipo_default: "SOFT" as const,
    render_valor: "fixed",
    valor_fijo: "true",
  },
  {
    value: "max_extras",
    label: "Máximo extras",
    descripcion: "Nº máximo de talleres extra por trimestre",
    tipo_default: "SOFT" as const,
    render_valor: "numero",
  },
] as const;

const DIAS = [
  { value: "L", label: "Lunes" },
  { value: "M", label: "Martes" },
  { value: "X", label: "Miércoles" },
  { value: "J", label: "Jueves" },
  { value: "V", label: "Viernes" },
];

const TIPO_BADGE: Record<string, string> = {
  HARD: "bg-red-100 text-red-700 border-red-200",
  SOFT: "bg-amber-100 text-amber-700 border-amber-200",
};

const CLAVE_LABEL: Record<string, string> = Object.fromEntries(
  CLAVES.map((c) => [c.value, c.label])
);

const DIA_LABEL: Record<string, string> = Object.fromEntries(
  DIAS.map((d) => [d.value, d.label])
);

// ── Props ─────────────────────────────────────────────────────

interface Props {
  empresaId: number;
  empresaNombre: string;
  restriccionesIniciales: Restriccion[];
  talleres: { id: number; nombre: string; programa: string }[];
}

// ── Formulario interno ────────────────────────────────────────

interface FormState {
  clave: string;
  tipo: "HARD" | "SOFT";
  valor: string;
  descripcion: string;
}

const FORM_VACIO: FormState = {
  clave: "solo_dia",
  tipo: "HARD",
  valor: "",
  descripcion: "",
};

function RestriccionForm({
  initial,
  onSubmit,
  onCancel,
  loading,
  talleres,
}: {
  initial: FormState;
  onSubmit: (f: FormState) => void;
  onCancel: () => void;
  loading: boolean;
  talleres: { id: number; nombre: string; programa: string }[];
}) {
  const [form, setForm] = useState<FormState>(initial);

  const claveMeta = CLAVES.find((c) => c.value === form.clave);

  function set(field: keyof FormState, value: string) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      // Al cambiar clave, resetear valor y tipo por defecto
      if (field === "clave") {
        const meta = CLAVES.find((c) => c.value === value);
        next.tipo = meta?.tipo_default ?? "HARD";
        next.valor = meta?.render_valor === "fixed" ? (meta as any).valor_fijo : "";
      }
      return next;
    });
  }

  function renderValorInput() {
    if (!claveMeta) return null;

    if (claveMeta.render_valor === "dia") {
      return (
        <select
          value={form.valor}
          onChange={(e) => set("valor", e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          required
        >
          <option value="">Selecciona un día...</option>
          {DIAS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      );
    }

    if (claveMeta.render_valor === "taller") {
      return (
        <select
          value={form.valor}
          onChange={(e) => set("valor", e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          required
        >
          <option value="">Selecciona un taller...</option>
          <optgroup label="EF">
            {talleres
              .filter((t) => t.programa === "EF")
              .map((t) => (
                <option key={t.id} value={t.nombre}>
                  {t.nombre}
                </option>
              ))}
          </optgroup>
          <optgroup label="IT">
            {talleres
              .filter((t) => t.programa === "IT")
              .map((t) => (
                <option key={t.id} value={t.nombre}>
                  {t.nombre}
                </option>
              ))}
          </optgroup>
        </select>
      );
    }

    if (claveMeta.render_valor === "numero") {
      return (
        <input
          type="number"
          min={0}
          max={10}
          value={form.valor}
          onChange={(e) => set("valor", e.target.value)}
          placeholder="Ej: 1"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          required
        />
      );
    }

    // fixed — no se muestra input, valor ya está seteado
    return (
      <p className="text-sm text-muted-foreground italic">
        Esta restricción no requiere valor adicional.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Clave */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Tipo de restricción</label>
        <select
          value={form.clave}
          onChange={(e) => set("clave", e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {CLAVES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        {claveMeta && (
          <p className="text-xs text-muted-foreground">{claveMeta.descripcion}</p>
        )}
      </div>

      {/* Valor */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Valor</label>
        {renderValorInput()}
      </div>

      {/* Tipo HARD / SOFT */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Prioridad</label>
        <div className="flex gap-3">
          {(["HARD", "SOFT"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => set("tipo", t)}
              className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                form.tipo === t
                  ? t === "HARD"
                    ? "border-red-300 bg-red-50 text-red-700"
                    : "border-amber-300 bg-amber-50 text-amber-700"
                  : "border-input bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              {t === "HARD" ? "🔴 Inviolable" : "🟡 Preferente"}
            </button>
          ))}
        </div>
      </div>

      {/* Descripción opcional */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">
          Nota interna{" "}
          <span className="font-normal text-muted-foreground">(opcional)</span>
        </label>
        <input
          type="text"
          value={form.descripcion}
          onChange={(e) => set("descripcion", e.target.value)}
          placeholder="Ej: Confirmado por email 12/03"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Botones */}
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-input px-4 py-2 text-sm hover:bg-muted transition-colors"
          disabled={loading}
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => onSubmit(form)}
          disabled={
            loading ||
            (claveMeta?.render_valor !== "fixed" && !form.valor.trim())
          }
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {loading ? "Guardando..." : "Guardar restricción"}
        </button>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────

export function RestriccionesCrud({
  empresaId,
  empresaNombre,
  restriccionesIniciales,
  talleres,
}: Props) {
  const [restricciones, setRestricciones] = useState<Restriccion[]>(
    restriccionesIniciales
  );
  const [modo, setModo] = useState<"lista" | "crear" | "editar">("lista");
  const [editando, setEditando] = useState<Restriccion | null>(null);
  const [confirmandoId, setConfirmandoId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  function formDesdeRestriccion(r: Restriccion): FormState {
    return {
      clave: r.clave,
      tipo: r.tipo,
      valor: r.valor,
      descripcion: r.descripcion ?? "",
    };
  }

  function handleCrear(form: FormState) {
    startTransition(async () => {
      const input: RestriccionInput = {
        tipo: form.tipo,
        clave: form.clave as RestriccionInput["clave"],
        valor: form.valor,
        descripcion: form.descripcion || undefined,
      };
      const res = await crearRestriccion(empresaId, input);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setRestricciones((prev) => [...prev, res.data]);
      setModo("lista");
      toast.success("Restricción añadida");
    });
  }

  function handleEditar(form: FormState) {
    if (!editando) return;
    startTransition(async () => {
      const input: RestriccionInput = {
        tipo: form.tipo,
        clave: form.clave as RestriccionInput["clave"],
        valor: form.valor,
        descripcion: form.descripcion || undefined,
      };
      const res = await editarRestriccion(editando.id, input);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setRestricciones((prev) =>
        prev.map((r) => (r.id === editando.id ? res.data : r))
      );
      setModo("lista");
      setEditando(null);
      toast.success("Restricción actualizada");
    });
  }

  function handleBorrar(id: number) {
    startTransition(async () => {
      const res = await borrarRestriccion(id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setRestricciones((prev) => prev.filter((r) => r.id !== id));
      setConfirmandoId(null);
      toast.success("Restricción eliminada");
    });
  }

  // ── Render lista ──────────────────────────────────────────

  function renderLista() {
    return (
      <div className="space-y-3">
        {restricciones.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-10 text-center">
            <p className="text-sm text-muted-foreground">
              Esta empresa no tiene restricciones configuradas.
            </p>
            <button
              onClick={() => setModo("crear")}
              className="mt-3 text-sm font-medium text-primary hover:underline"
            >
              + Añadir la primera
            </button>
          </div>
        ) : (
          restricciones.map((r) => (
            <div
              key={r.id}
              className="flex items-start justify-between rounded-lg border border-border bg-card p-4 gap-4"
            >
              {/* Info */}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${TIPO_BADGE[r.tipo]}`}
                  >
                    {r.tipo === "HARD" ? "🔴 Inviolable" : "🟡 Preferente"}
                  </span>
                  <span className="text-sm font-medium">
                    {CLAVE_LABEL[r.clave] ?? r.clave}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Valor:{" "}
                  <span className="font-mono text-foreground">
                    {r.clave === "solo_dia"
                      ? DIA_LABEL[r.valor] ?? r.valor
                      : r.valor}
                  </span>
                </p>
                {r.descripcion && (
                  <p className="text-xs text-muted-foreground italic">
                    {r.descripcion}
                  </p>
                )}
              </div>

              {/* Acciones */}
              <div className="flex items-center gap-1 shrink-0">
                {confirmandoId === r.id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">¿Eliminar?</span>
                    <button
                      onClick={() => handleBorrar(r.id)}
                      disabled={isPending}
                      className="rounded px-2 py-1 text-xs font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                    >
                      Sí
                    </button>
                    <button
                      onClick={() => setConfirmandoId(null)}
                      className="rounded px-2 py-1 text-xs border border-input hover:bg-muted"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setEditando(r);
                        setModo("editar");
                      }}
                      className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      title="Editar"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setConfirmandoId(r.id)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                      title="Eliminar"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}

        {restricciones.length > 0 && (
          <button
            onClick={() => setModo("crear")}
            className="w-full rounded-lg border border-dashed border-border py-2.5 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
          >
            + Añadir restricción
          </button>
        )}
      </div>
    );
  }

  // ── Render principal ──────────────────────────────────────

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h3 className="font-semibold text-foreground">{empresaNombre}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {restricciones.length === 0
              ? "Sin restricciones"
              : `${restricciones.length} restricción${restricciones.length > 1 ? "es" : ""}`}
          </p>
        </div>
        {modo !== "lista" && (
          <span className="text-sm text-muted-foreground">
            {modo === "crear" ? "Nueva restricción" : "Editando"}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-5">
        {modo === "lista" && renderLista()}
        {modo === "crear" && (
          <RestriccionForm
            initial={FORM_VACIO}
            onSubmit={handleCrear}
            onCancel={() => setModo("lista")}
            loading={isPending}
            talleres={talleres}
          />
        )}
        {modo === "editar" && editando && (
          <RestriccionForm
            initial={formDesdeRestriccion(editando)}
            onSubmit={handleEditar}
            onCancel={() => { setModo("lista"); setEditando(null); }}
            loading={isPending}
            talleres={talleres}
          />
        )}
      </div>
    </div>
  );
}
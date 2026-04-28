"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

import { actionListarEmpresasEP } from "@/actions/config-trimestral-actions";
import { actionCrearSlotExtra } from "@/actions/calendario-actions";
import type { EmpresaEP } from "@/types/config-trimestral";
import type { TallerOut } from "@/types/taller";

const DIAS_OPTIONS: { value: string; label: string }[] = [
  { value: "L", label: "Lunes" },
  { value: "M", label: "Martes" },
  { value: "X", label: "Miércoles" },
  { value: "J", label: "Jueves" },
  { value: "V", label: "Viernes" },
];

// Subset of SlotCalendario the modal needs for collision preview. Page client
// projects this from `calendario.slots` so the modal stays decoupled.
export interface SlotInfoMin {
  semana: number;
  dia: string;
  horario: string;
  empresa_id: number | null;
  empresa_nombre: string | null;
}

interface CrearExtraModalProps {
  trimestre: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  talleres: TallerOut[];
  slotsExistentes: SlotInfoMin[];
}

export function CrearExtraModal({
  trimestre,
  open,
  onOpenChange,
  onSuccess,
  talleres,
  slotsExistentes,
}: CrearExtraModalProps) {
  const [empresaId, setEmpresaId] = useState<number | null>(null);
  const [semana, setSemana] = useState<number | null>(null);
  const [dia, setDia] = useState<string | null>(null);
  const [horario, setHorario] = useState<string | null>(null);
  const [tallerId, setTallerId] = useState<number | null>(null);
  const [notas, setNotas] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Empresas EP cache (session): loaded on first open, kept across close/reopen
  // so the planner doesn't pay the round-trip every time.
  const [empresasEP, setEmpresasEP] = useState<EmpresaEP[]>([]);
  const [empresasEPLoading, setEmpresasEPLoading] = useState<boolean>(false);
  const [empresasEPError, setEmpresasEPError] = useState<string | null>(null);
  // Ref instead of state-in-deps: prevents the cancel-loop where toggling
  // loading=true would re-trigger the effect and cancel its own fetch. Also
  // dedupes Strict Mode's double-mount in dev.
  const fetchInFlight = useRef<boolean>(false);

  // Reset form fields when the modal closes; empresas EP cache is preserved.
  useEffect(() => {
    if (open) return;
    setEmpresaId(null);
    setSemana(null);
    setDia(null);
    setHorario(null);
    setTallerId(null);
    setNotas("");
    setSubmitting(false);
  }, [open]);

  // Load empresas EP on first open. Skips if already loaded or in error state.
  useEffect(() => {
    if (!open) return;
    if (empresasEP.length > 0) return;
    if (empresasEPError !== null) return;
    if (fetchInFlight.current) return;

    let cancelled = false;
    fetchInFlight.current = true;
    setEmpresasEPLoading(true);
    console.debug(`[CrearExtraModal] cargando empresas EP de ${trimestre}`);

    actionListarEmpresasEP(trimestre)
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          console.debug(
            `[CrearExtraModal] empresas EP cargadas: ${result.data.empresas.length}`,
          );
          setEmpresasEP(result.data.empresas);
          setEmpresasEPError(null);
        } else {
          console.debug(
            `[CrearExtraModal] error cargando empresas EP: ${result.error}`,
          );
          setEmpresasEPError(result.error);
        }
      })
      .finally(() => {
        fetchInFlight.current = false;
        if (!cancelled) setEmpresasEPLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, trimestre, empresasEP.length, empresasEPError]);

  // Horarios candidatos = unique horarios across existing slots + catalog talleres.
  const horariosOptions = useMemo(() => {
    const set = new Set<string>();
    for (const s of slotsExistentes) if (s.horario) set.add(s.horario);
    for (const t of talleres) if (t.horario) set.add(t.horario);
    return [...set].sort();
  }, [slotsExistentes, talleres]);

  // Talleres ordenados por programa, luego por nombre.
  const talleresSorted = useMemo(
    () =>
      [...talleres].sort((a, b) => {
        if (a.programa !== b.programa) return a.programa.localeCompare(b.programa);
        return a.nombre.localeCompare(b.nombre);
      }),
    [talleres],
  );

  // Programa derivado del taller seleccionado (read-only en UI).
  const programa = useMemo(() => {
    if (tallerId == null) return null;
    return talleres.find((t) => t.id === tallerId)?.programa ?? null;
  }, [tallerId, talleres]);

  // Preview de colisión: slots existentes en mismo (sem, dia, horario) con
  // empresa distinta a la seleccionada. Solo informativo — el backend valida.
  const colisiones = useMemo(() => {
    if (semana == null || !dia || !horario || empresaId == null) return null;
    return slotsExistentes.filter(
      (s) =>
        s.semana === semana &&
        s.dia === dia &&
        s.horario === horario &&
        s.empresa_id != null &&
        s.empresa_id !== empresaId,
    );
  }, [semana, dia, horario, empresaId, slotsExistentes]);

  const empresasColisionando = useMemo(() => {
    if (!colisiones) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const c of colisiones) {
      const name = c.empresa_nombre ?? "(sin empresa)";
      if (seen.has(name)) continue;
      seen.add(name);
      out.push(name);
    }
    return out;
  }, [colisiones]);

  const submitDisabled =
    empresaId == null ||
    semana == null ||
    semana < 1 ||
    semana > 13 ||
    !dia ||
    !horario ||
    tallerId == null ||
    submitting ||
    empresasEPLoading ||
    empresasEPError !== null;

  const handleSubmit = useCallback(async () => {
    if (
      empresaId == null ||
      semana == null ||
      !dia ||
      !horario ||
      tallerId == null
    )
      return;
    const taller = talleres.find((t) => t.id === tallerId);
    if (!taller) {
      toast.error("Taller seleccionado no encontrado en el catálogo");
      return;
    }
    const empresa = empresasEP.find((e) => e.id === empresaId);

    setSubmitting(true);
    const result = await actionCrearSlotExtra(trimestre, {
      empresa_id: empresaId,
      semana,
      dia,
      horario,
      taller_id: tallerId,
      programa: taller.programa as "EF" | "IT",
      notas: notas.trim() ? notas.trim() : null,
    });
    setSubmitting(false);

    if (result.ok) {
      toast.success(
        `EXTRA creado: ${empresa?.nombre ?? "(empresa)"} en S${semana} ${dia} ${horario}`,
      );
      onSuccess();
      onOpenChange(false);
    } else {
      toast.error(result.error);
    }
  }, [
    empresaId,
    semana,
    dia,
    horario,
    tallerId,
    notas,
    talleres,
    empresasEP,
    trimestre,
    onSuccess,
    onOpenChange,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Añadir EXTRA puntual</DialogTitle>
          <DialogDescription>
            Crea un slot EXTRA para una empresa con escuela propia. El backend
            valida que haya colisión existente con otra empresa en el mismo
            horario.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Empresa */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="extra-empresa">
              Empresa <span className="text-red-500">*</span>
            </label>
            {empresasEPError ? (
              <div className="text-xs text-red-700 border border-red-200 bg-red-50 rounded p-2">
                No se pudieron cargar empresas EP: {empresasEPError}
              </div>
            ) : (
              <Select
                value={empresaId == null ? "" : String(empresaId)}
                onValueChange={(v) => setEmpresaId(v ? Number(v) : null)}
                disabled={empresasEPLoading}
              >
                <SelectTrigger id="extra-empresa" className="w-full">
                  <SelectValue
                    placeholder={
                      empresasEPLoading
                        ? "Cargando empresas EP..."
                        : "Selecciona empresa con escuela propia"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {empresasEP.length === 0 && !empresasEPLoading ? (
                    <div className="px-2 py-1.5 text-xs text-slate-500">
                      No hay empresas EP en este trimestre.
                    </div>
                  ) : (
                    empresasEP.map((e) => (
                      <SelectItem key={e.id} value={String(e.id)}>
                        {e.nombre}{" "}
                        <span className="text-slate-500 text-xs">
                          ({e.tipo})
                        </span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Semana / Día / Horario */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="extra-semana">
                Semana <span className="text-red-500">*</span>
              </label>
              <Input
                id="extra-semana"
                type="number"
                min={1}
                max={13}
                value={semana == null ? "" : semana}
                onChange={(e) => {
                  const v = e.target.value;
                  setSemana(v === "" ? null : Number(v));
                }}
                placeholder="1..13"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="extra-dia">
                Día <span className="text-red-500">*</span>
              </label>
              <Select
                value={dia ?? ""}
                onValueChange={(v) => setDia(v ? v : null)}
              >
                <SelectTrigger id="extra-dia" className="w-full">
                  <SelectValue placeholder="Día" />
                </SelectTrigger>
                <SelectContent>
                  {DIAS_OPTIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="extra-horario">
                Horario <span className="text-red-500">*</span>
              </label>
              <Select
                value={horario ?? ""}
                onValueChange={(v) => setHorario(v ? v : null)}
              >
                <SelectTrigger id="extra-horario" className="w-full">
                  <SelectValue placeholder="HH:MM" />
                </SelectTrigger>
                <SelectContent>
                  {horariosOptions.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-slate-500">
                      Sin horarios disponibles.
                    </div>
                  ) : (
                    horariosOptions.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Collision preview (informative, does not block submit). */}
          {colisiones !== null &&
            (colisiones.length > 0 ? (
              <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
                <span className="font-medium">
                  ✓ {colisiones.length} colisión
                  {colisiones.length === 1 ? "" : "es"} existente
                  {colisiones.length === 1 ? "" : "s"}:
                </span>{" "}
                {empresasColisionando.join(", ")}
              </div>
            ) : (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                ⚠ Aún no hay otra empresa en este horario. El backend rechazará
                el EXTRA si no hay colisión.
              </div>
            ))}

          {/* Taller */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="extra-taller">
              Taller <span className="text-red-500">*</span>
            </label>
            <Select
              value={tallerId == null ? "" : String(tallerId)}
              onValueChange={(v) => setTallerId(v ? Number(v) : null)}
            >
              <SelectTrigger id="extra-taller" className="w-full">
                <SelectValue placeholder="Selecciona taller del catálogo" />
              </SelectTrigger>
              <SelectContent>
                {talleresSorted.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-slate-500">
                    Catálogo de talleres vacío.
                  </div>
                ) : (
                  talleresSorted.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.nombre}
                      <span className="text-slate-500 text-xs ml-2">
                        ({t.programa}
                        {t.dia_semana ? ` · ${t.dia_semana}` : ""}
                        {t.horario ? ` ${t.horario}` : ""})
                      </span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Programa (auto, read-only) */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Programa</label>
            <div className="text-sm rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              {programa ? (
                <>
                  <Badge variant="outline" className="mr-2">
                    {programa}
                  </Badge>
                  <span className="text-xs text-slate-500">
                    (auto desde taller)
                  </span>
                </>
              ) : (
                <span className="text-xs text-slate-500">
                  (selecciona un taller)
                </span>
              )}
            </div>
          </div>

          {/* Notas */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="extra-notas">
              Notas (opcional)
            </label>
            <Textarea
              id="extra-notas"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              placeholder="Razón del EXTRA, contexto operativo..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitDisabled}>
            {submitting ? "Creando..." : "Crear EXTRA"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

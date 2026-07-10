

"use client";

import { useState } from "react";
import { useSettings } from "@/hooks/use-settings";
import type { AppSettingsUpdate } from "@/types/settings";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, X, Plus } from "lucide-react";
import { toast } from "sonner";

// ── Helpers ──────────────────────────────────────────────────

function getNextQuarter(current: string): string {
  const [year, q] = current.split("-Q");
  const qNum = parseInt(q);
  if (qNum === 4) return `${parseInt(year) + 1}-Q1`;
  return `${year}-Q${qNum + 1}`;
}

function getQuarterOptions(activo: string): string[] {
  const options: string[] = [];
  let current = activo;
  for (let i = 0; i < 4; i++) {
    current = getNextQuarter(current);
    options.push(current);
  }
  return options;
}

function getPrevQuarter(current: string): string {
  const [year, q] = current.split("-Q");
  const qNum = parseInt(q);
  if (qNum === 1) return `${parseInt(year) - 1}-Q4`;
  return `${year}-Q${qNum - 1}`;
}

// Ventana de opciones para el activo: 2 anteriores + actual + 4 siguientes
function getActivoOptions(current: string): string[] {
  const opts: string[] = [];
  let c = current;
  for (let i = 0; i < 2; i++) { c = getPrevQuarter(c); opts.unshift(c); }
  opts.push(current);
  c = current;
  for (let i = 0; i < 4; i++) { c = getNextQuarter(c); opts.push(c); }
  return opts;
}

// ══════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════

export function TrimestreIndicator() {
  const { settings, loading, update } = useSettings();
  const [editing, setEditing] = useState(false);
  const [selectedValue, setSelectedValue] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [editingActivo, setEditingActivo] = useState(false);
  const [selectedActivo, setSelectedActivo] = useState("");

  if (loading) {
    return (
      <div className="animate-pulse rounded-lg bg-slate-100 h-12 w-32" />
    );
  }

  if (!settings) {
    return null;
  }

  const quarterOptions = getQuarterOptions(settings.trimestre_activo);

  const handleStartEdit = () => {
    setSelectedValue(settings.trimestre_siguiente || quarterOptions[0]);
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const result = await update({ trimestre_siguiente: selectedValue });
    setSaving(false);
    if (result.ok) {
      toast.success(`Trimestre siguiente configurado: ${selectedValue}`);
      setEditing(false);
    } else {
      toast.error(result.error || "Error al guardar");
    }
  };

  const handleClear = async () => {
    setSaving(true);
    const result = await update({ trimestre_siguiente: "" });
    setSaving(false);
    if (result.ok) {
      toast.success("Trimestre siguiente eliminado");
    } else {
      toast.error(result.error || "Error al eliminar");
    }
  };

  const handleCancel = () => {
    setEditing(false);
  };

  const handleStartEditActivo = () => {
    setSelectedActivo(settings.trimestre_activo);
    setEditingActivo(true);
  };

  const handleSaveActivo = async () => {
    setSaving(true);
    const payload: AppSettingsUpdate = { trimestre_activo: selectedActivo };
    if (selectedActivo === settings.trimestre_siguiente) payload.trimestre_siguiente = "";
    const result = await update(payload);
    setSaving(false);
    if (result.ok) {
      toast.success(`Trimestre activo: ${selectedActivo}`);
      setEditingActivo(false);
    } else {
      toast.error(result.error || "Error al guardar");
    }
  };

  const handleCancelActivo = () => setEditingActivo(false);

  // ── Editing mode ───────────────────────────────────────────

  if (editing) {
    return (
      <div className="flex items-center gap-3">
        {/* Active Quarter - always visible */}
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2">
          <div className="text-[10px] font-medium uppercase tracking-wider text-emerald-600">
            Activo
          </div>
          <div className="text-lg font-bold text-emerald-800">
            {settings.trimestre_activo}
          </div>
        </div>

        {/* Edit form */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">Siguiente:</span>
          <Select value={selectedValue} onValueChange={setSelectedValue}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {quarterOptions.map((q) => (
                <SelectItem key={q} value={q}>
                  {q}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "..." : "Guardar"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCancel}
            disabled={saving}
          >
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  // ── Display mode ───────────────────────────────────────────

  return (
    <div className="flex flex-col items-start gap-3">
      {/* Active Quarter */}
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2">
        <div className="text-[10px] font-medium uppercase tracking-wider text-emerald-600">
          Activo
        </div>
        {editingActivo ? (
          <div className="mt-1 flex items-center gap-2">
            <Select value={selectedActivo} onValueChange={setSelectedActivo}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getActivoOptions(settings.trimestre_activo).map((q) => (
                  <SelectItem key={q} value={q}>
                    {q}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={handleSaveActivo} disabled={saving}>
              {saving ? "..." : "Guardar"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancelActivo}
              disabled={saving}
            >
              Cancelar
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="text-lg font-bold text-emerald-800">
              {settings.trimestre_activo}
            </div>
            <button
              onClick={handleStartEditActivo}
              disabled={saving}
              className="p-1 rounded hover:bg-emerald-100 text-emerald-400 hover:text-emerald-700 transition-colors"
              title="Editar trimestre activo"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Next Quarter OR Configure button */}
      {settings.trimestre_siguiente ? (
        <div className="flex items-center gap-1">
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2">
            <div className="text-[10px] font-medium uppercase tracking-wider text-blue-600">
              Siguiente
            </div>
            <div className="text-lg font-bold text-blue-800">
              {settings.trimestre_siguiente}
            </div>
          </div>
          <div className="flex flex-col gap-0.5">
            <button
              onClick={handleStartEdit}
              disabled={saving || editingActivo}
              className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              title="Editar trimestre siguiente"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleClear}
              disabled={saving || editingActivo}
              className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
              title="Eliminar trimestre siguiente"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={handleStartEdit}
          disabled={saving || editingActivo}
          className="gap-1.5"
        >
          <Plus className="h-4 w-4" />
          Conf. siguiente trimestre
        </Button>
      )}
    </div>
  );
}

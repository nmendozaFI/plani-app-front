/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, Save, X, Copy, Plus, Search, Settings2, Download, Upload } from "lucide-react";
import { getTrimestreAnterior } from "@/utils/trimestres";
import {
  actionObtenerConfigsTrimestre,
  actionObtenerConfigResumen,
  actionActualizarConfigsBatch,
  actionInicializarConfigTrimestral,
  actionImportarConfigExcel,
} from "@/actions/config-trimestral-actions";
import { useSettings } from "@/hooks/use-settings";
import type {
  ConfigTrimestralOut,
  ConfigTrimestralResumen,
  ConfigBatchUpdateItem,
  ImportarConfigExcelResult,
} from "@/types/config-trimestral";
import { apiFetchBlob } from "@/lib/api-client";
const DIAS_SEMANA = ["L", "M", "X", "J", "V"];

export default function ConfigTrimestralPage() {
  const { settings, loading: loadingSettings } = useSettings();

  const [trimestre, setTrimestre] = useState<string | null>(null);
  const [configs, setConfigs] = useState<ConfigTrimestralOut[]>([]);
  const [resumen, setResumen] = useState<ConfigTrimestralResumen | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [initializing, setInitializing] = useState(false);

  // Dirty tracking: map of empresa_id -> modified fields
  const [modifiedRows, setModifiedRows] = useState<Map<number, ConfigBatchUpdateItem>>(new Map());

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTipo, setFilterTipo] = useState<string>("all");
  const [filterSinFreq, setFilterSinFreq] = useState(false);

  // Import modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportarConfigExcelResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Set trimestre when settings load
  useEffect(() => {
    if (settings && !trimestre) {
      setTrimestre(settings.trimestre_activo);
    }
  }, [settings, trimestre]);

  // Build trimestre options from settings (activo + siguiente if exists)
  const trimestreOptions = useMemo(() => {
    if (!settings) return [];
    const options = [{ value: settings.trimestre_activo, label: `${settings.trimestre_activo} (Activo)` }];
    if (settings.trimestre_siguiente) {
      options.push({ value: settings.trimestre_siguiente, label: `${settings.trimestre_siguiente} (Siguiente)` });
    }
    return options;
  }, [settings]);

  // Load data
  const loadData = useCallback(async () => {
    if (!trimestre) return;
    setLoading(true);
    try {
      const [configsResult, resumenResult] = await Promise.all([
        actionObtenerConfigsTrimestre(trimestre),
        actionObtenerConfigResumen(trimestre),
      ]);

      if (configsResult.error) {
        toast.error(configsResult.error);
        setConfigs([]);
      } else {
        setConfigs(configsResult.data?.configs || []);
      }

      if (resumenResult.error) {
        setResumen(null);
      } else {
        setResumen(resumenResult.data);
      }

      // Clear modifications when loading new data
      setModifiedRows(new Map());
    } catch (e) {
      toast.error("Error al cargar configuraciones");
    } finally {
      setLoading(false);
    }
  }, [trimestre]);

  useEffect(() => {
    if (trimestre) {
      loadData();
    }
  }, [loadData, trimestre]);

  // Filter configs
  const filteredConfigs = useMemo(() => {
    return configs.filter((c) => {
      if (searchTerm && !c.empresa_nombre.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      if (filterTipo !== "all" && c.tipo_participacion !== filterTipo) {
        return false;
      }
      if (filterSinFreq && (c.frecuencia_solicitada !== null && c.frecuencia_solicitada > 0)) {
        return false;
      }
      return true;
    });
  }, [configs, searchTerm, filterTipo, filterSinFreq]);

  // Get current value (modified or original)
  const getValue = (config: ConfigTrimestralOut, field: keyof ConfigBatchUpdateItem) => {
    const modified = modifiedRows.get(config.empresa_id);
    if (modified && modified[field] !== undefined) {
      return modified[field];
    }
    return config[field as keyof ConfigTrimestralOut];
  };

  // Handle field change
  const handleFieldChange = (empresaId: number, field: keyof ConfigBatchUpdateItem, value: unknown) => {
    setModifiedRows((prev) => {
      const next = new Map(prev);
      const existing = next.get(empresaId) || { empresa_id: empresaId };
      next.set(empresaId, { ...existing, [field]: value });
      return next;
    });
  };

  // Handle dias change (multi-select)
  const handleDiasChange = (empresaId: number, dia: string, checked: boolean) => {
    const config = configs.find((c) => c.empresa_id === empresaId);
    if (!config) return;

    const currentDias = (getValue(config, "disponibilidad_dias") as string || "L,M,X,J,V").split(",");
    let newDias: string[];
    if (checked) {
      newDias = [...new Set([...currentDias, dia])];
    } else {
      newDias = currentDias.filter((d) => d !== dia);
    }
    // Sort dias in order L,M,X,J,V
    newDias.sort((a, b) => DIAS_SEMANA.indexOf(a) - DIAS_SEMANA.indexOf(b));
    handleFieldChange(empresaId, "disponibilidad_dias", newDias.join(","));
  };

  // Save changes
  const handleSave = async () => {
    if (!trimestre || modifiedRows.size === 0) {
      toast.info("No hay cambios que guardar");
      return;
    }

    setSaving(true);
    try {
      const updates = Array.from(modifiedRows.values());
      const result = await actionActualizarConfigsBatch(trimestre, updates);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`${result.data?.updated} configuraciones actualizadas`);
        if (result.data?.errors && result.data.errors.length > 0) {
          result.data.errors.forEach((e) => toast.warning(e));
        }
        // Reload data
        await loadData();
      }
    } catch (e) {
      toast.error("Error al guardar cambios");
    } finally {
      setSaving(false);
    }
  };

  // Discard changes
  const handleDiscard = () => {
    setModifiedRows(new Map());
    toast.info("Cambios descartados");
  };

  // Initialize configs
  const handleInitialize = async (clone: boolean) => {
    if (!trimestre) return;
    setInitializing(true);
    try {
      const origenTrimestre = clone ? getTrimestreAnterior(trimestre) : undefined;
      const result = await actionInicializarConfigTrimestral(trimestre, origenTrimestre);

      if (result.error) {
        toast.error(result.error);
      } else {
        const { clonadas, nuevas, warnings } = result.data || {};
        if (clonadas && clonadas > 0) {
          toast.success(`${clonadas} configuraciones clonadas desde ${origenTrimestre}`);
        }
        if (nuevas && nuevas > 0) {
          toast.success(`${nuevas} configuraciones creadas por defecto`);
        }
        warnings?.forEach((w) => toast.warning(w));
        await loadData();
      }
    } catch (e) {
      toast.error("Error al inicializar configuraciones");
    } finally {
      setInitializing(false);
    }
  };

  // Export to Excel
  const handleExport = useCallback(async () => {
    if (!trimestre) return;
    try {
      const blob = await apiFetchBlob(`/api/config-trimestral/${trimestre}/exportar-excel`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `config_trimestral_${trimestre}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Excel exportado");
    } catch (e) {
      toast.error("Error al exportar Excel");
    }
  }, [trimestre]);

  // Import file handler (dry run preview)
  const handleImportFile = useCallback(async (file: File) => {
    if (!trimestre) return;
    setImporting(true);
    setImportResult(null);
    try {
      const result = await actionImportarConfigExcel(trimestre, file, true);
      if (result.error) throw new Error(result.error);
      setImportResult(result.data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al procesar Excel";
      toast.error(msg);
      setShowImportModal(false);
    } finally {
      setImporting(false);
    }
  }, [trimestre]);

  // Apply import changes
  const handleApplyImport = useCallback(async (file: File) => {
    if (!trimestre || !importResult) return;
    setImporting(true);
    try {
      const result = await actionImportarConfigExcel(trimestre, file, false);
      if (result.error) throw new Error(result.error);
      toast.success(`${result.data?.aplicados} configuraciones actualizadas`);
      if (result.data?.warnings && result.data.warnings.length > 0) {
        result.data.warnings.slice(0, 3).forEach((w) => toast.warning(w));
      }
      setShowImportModal(false);
      setImportResult(null);
      await loadData();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al aplicar cambios";
      toast.error(msg);
    } finally {
      setImporting(false);
    }
  }, [trimestre, importResult, loadData]);

  const isRowModified = (empresaId: number) => modifiedRows.has(empresaId);

  if (loadingSettings) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!settings || !trimestre) {
    return (
      <div className="text-center py-12 text-red-600">
        No se pudo cargar la configuración del trimestre activo
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings2 className="h-6 w-6" />
            Configuracion Trimestral
          </h1>
          <p className="text-muted-foreground">
            Preferencias de empresas para el trimestre
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={loading || configs.length === 0}
          >
            <Download className="h-4 w-4 mr-1" />
            Exportar Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setShowImportModal(true);
              setImportResult(null);
            }}
            disabled={loading || configs.length === 0}
          >
            <Upload className="h-4 w-4 mr-1" />
            Importar Excel
          </Button>
          {trimestreOptions.length > 1 ? (
            <Select value={trimestre} onValueChange={setTrimestre}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {trimestreOptions.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2">
              <span className="text-sm font-semibold text-slate-700">{trimestre}</span>
              <span className="ml-2 text-xs text-slate-500">(Activo)</span>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : configs.length === 0 ? (
        /* Initialize Panel */
        <Card>
          <CardHeader>
            <CardTitle>Sin configuraciones para {trimestre}</CardTitle>
            <CardDescription>
              Inicializa las configuraciones para este trimestre
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-4">
            <Button
              variant="default"
              onClick={() => handleInitialize(true)}
              disabled={initializing}
            >
              {initializing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Copy className="h-4 w-4 mr-2" />
              )}
              Clonar desde {getTrimestreAnterior(trimestre)}
            </Button>
            <Button
              variant="outline"
              onClick={() => handleInitialize(false)}
              disabled={initializing}
            >
              {initializing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Crear por defecto
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary & Actions Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>{resumen?.total_configs || configs.length} empresas configuradas</span>
              <span className="text-amber-600">
                {resumen?.sin_frecuencia || 0} sin frecuencia
              </span>
              {resumen?.escuela_propia ? (
                <span>{resumen.escuela_propia} escuela propia</span>
              ) : null}
            </div>
            {modifiedRows.size > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {modifiedRows.size} cambios pendientes
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDiscard}
                  disabled={saving}
                >
                  <X className="h-4 w-4 mr-1" />
                  Descartar
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  Guardar ({modifiedRows.size})
                </Button>
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar empresa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterTipo} onValueChange={setFilterTipo}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="EF">EF</SelectItem>
                <SelectItem value="IT">IT</SelectItem>
                <SelectItem value="AMBAS">AMBAS</SelectItem>
              </SelectContent>
            </Select>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={filterSinFreq}
                onCheckedChange={(c) => setFilterSinFreq(!!c)}
              />
              Sin frecuencia
            </label>
          </div>

          {/* Table */}
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Empresa</th>
                    <th className="text-center p-3 font-medium w-24">Tipo</th>
                    <th className="text-center p-3 font-medium w-20">Freq</th>
                    <th className="text-center p-3 font-medium w-40">Dias</th>
                    <th className="text-center p-3 font-medium w-20">Turno</th>
                    <th className="text-center p-3 font-medium w-20">Vol.</th>
                    <th className="text-left p-3 font-medium">Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredConfigs.map((config) => (
                    <tr
                      key={config.id}
                      className={`border-b hover:bg-muted/30 ${
                        isRowModified(config.empresa_id)
                          ? "border-l-4 border-l-amber-400 bg-amber-50/50"
                          : ""
                      }`}
                    >
                      <td className="p-3 font-medium">{config.empresa_nombre}</td>
                      <td className="p-3 text-center">
                        <Select
                          value={getValue(config, "tipo_participacion") as string}
                          onValueChange={(v) =>
                            handleFieldChange(config.empresa_id, "tipo_participacion", v)
                          }
                        >
                          <SelectTrigger className="h-8 w-20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="EF">EF</SelectItem>
                            <SelectItem value="IT">IT</SelectItem>
                            <SelectItem value="AMBAS">AMBAS</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-3 text-center">
                        <Input
                          type="number"
                          min={0}
                          max={20}
                          className="h-8 w-16 text-center"
                          value={getValue(config, "frecuencia_solicitada") as number || ""}
                          onChange={(e) =>
                            handleFieldChange(
                              config.empresa_id,
                              "frecuencia_solicitada",
                              e.target.value ? parseInt(e.target.value) : null
                            )
                          }
                        />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-1">
                          {DIAS_SEMANA.map((dia) => {
                            const currentDias = (
                              (getValue(config, "disponibilidad_dias") as string) || "L,M,X,J,V"
                            ).split(",");
                            const isChecked = currentDias.includes(dia);
                            return (
                              <label
                                key={dia}
                                className={`flex items-center justify-center w-7 h-7 text-xs font-medium rounded cursor-pointer border ${
                                  isChecked
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-background border-input hover:bg-muted"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  className="sr-only"
                                  checked={isChecked}
                                  onChange={(e) =>
                                    handleDiasChange(config.empresa_id, dia, e.target.checked)
                                  }
                                />
                                {dia}
                              </label>
                            );
                          })}
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <Select
                          value={(getValue(config, "turno_preferido") as string) || "-"}
                          onValueChange={(v) =>
                            handleFieldChange(
                              config.empresa_id,
                              "turno_preferido",
                              v === "-" ? null : v
                            )
                          }
                        >
                          <SelectTrigger className="h-8 w-16">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="-">-</SelectItem>
                            <SelectItem value="M">M</SelectItem>
                            <SelectItem value="T">T</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-3 text-center">
                        <Input
                          type="number"
                          min={0}
                          className="h-8 w-14 text-center"
                          value={getValue(config, "voluntarios_disponibles") as number || ""}
                          onChange={(e) =>
                            handleFieldChange(
                              config.empresa_id,
                              "voluntarios_disponibles",
                              e.target.value ? parseInt(e.target.value) : 0
                            )
                          }
                        />
                      </td>
                      <td className="p-3">
                        <Input
                          className="h-8"
                          placeholder="Notas..."
                          value={(getValue(config, "notas") as string) || ""}
                          onChange={(e) =>
                            handleFieldChange(config.empresa_id, "notas", e.target.value)
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredConfigs.length === 0 && (
              <div className="py-8 text-center text-muted-foreground">
                No se encontraron empresas con los filtros aplicados
              </div>
            )}
          </Card>
        </>
      )}

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImportFile(file);
          e.target.value = "";
        }}
      />

      {/* Import Modal */}
      {showImportModal && (
        <ImportConfigModal
          trimestre={trimestre || ""}
          importing={importing}
          importResult={importResult}
          fileInputRef={fileInputRef}
          onClose={() => {
            setShowImportModal(false);
            setImportResult(null);
          }}
          onApply={handleApplyImport}
        />
      )}
    </div>
  );
}

// ── Import Modal Component ─────────────────────────────────────

function ImportConfigModal({
  trimestre,
  importing,
  importResult,
  fileInputRef,
  onClose,
  onApply,
}: {
  trimestre: string;
  importing: boolean;
  importResult: ImportarConfigExcelResult | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onClose: () => void;
  onApply: (file: File) => void;
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith(".xlsx") || file.name.endsWith(".xls"))) {
      setSelectedFile(file);
    }
  };

  // When file is selected, trigger preview (dry run)
  useEffect(() => {
    if (selectedFile && !importResult && !importing) {
      const input = fileInputRef.current;
      if (input) {
        const dt = new DataTransfer();
        dt.items.add(selectedFile);
        input.files = dt.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
  }, [selectedFile, importResult, importing, fileInputRef]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Importar Excel</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Soporta formato propio del sistema o el Excel del planificador
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1">
          {!importResult && !importing && (
            <div
              className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-blue-400 hover:bg-blue-50/50 transition-colors cursor-pointer"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => document.getElementById("import-config-file-input")?.click()}
            >
              <input
                id="import-config-file-input"
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileSelect}
              />
              <div className="text-4xl mb-3">📥</div>
              <p className="text-sm font-medium text-slate-700 mb-1">
                Arrastra el Excel aqui o haz click para seleccionar
              </p>
              <p className="text-xs text-slate-500">
                Acepta formato propio (exportado) o formato planificador (frecuencias2026.xlsx)
              </p>
            </div>
          )}

          {importing && (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-4" />
              <p className="text-sm text-slate-600">Analizando Excel...</p>
            </div>
          )}

          {importResult && (
            <div className="space-y-4">
              {/* Format badge */}
              <div className="flex items-center gap-3">
                <Badge variant={importResult.formato_detectado === "ideal" ? "default" : "secondary"}>
                  Formato detectado: {importResult.formato_detectado === "ideal" ? "Sistema" : "Planificador"}
                </Badge>
                <span className="text-xs text-slate-500">
                  {importResult.total_procesados} filas procesadas
                </span>
              </div>

              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
                  <div className="text-xl font-bold text-slate-800">{importResult.total_procesados}</div>
                  <div className="text-[10px] uppercase text-slate-500">Filas</div>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-center">
                  <div className="text-xl font-bold text-blue-700">{importResult.preview.length}</div>
                  <div className="text-[10px] uppercase text-blue-600">Actualizaciones</div>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center">
                  <div className="text-xl font-bold text-amber-700">{importResult.warnings.length}</div>
                  <div className="text-[10px] uppercase text-amber-600">Advertencias</div>
                </div>
              </div>

              {/* Preview table */}
              {importResult.preview.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">
                    Vista previa de cambios
                  </h4>
                  <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b">
                          <th className="text-left p-2 font-medium">Empresa</th>
                          {importResult.formato_detectado === "legacy" ? (
                            <>
                              <th className="text-center p-2 font-medium w-14">EF</th>
                              <th className="text-center p-2 font-medium w-14">IT</th>
                            </>
                          ) : null}
                          <th className="text-center p-2 font-medium w-16">Freq</th>
                          <th className="text-center p-2 font-medium w-16">Tipo</th>
                          <th className="text-left p-2 font-medium">Notas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importResult.preview.slice(0, 20).map((item) => (
                          <tr key={item.empresa_id} className="border-b hover:bg-slate-50">
                            <td className="p-2 font-medium">{item.nombre}</td>
                            {importResult.formato_detectado === "legacy" ? (
                              <>
                                <td className="p-2 text-center text-blue-600">{item.detalle_ef || "-"}</td>
                                <td className="p-2 text-center text-green-600">{item.detalle_it || "-"}</td>
                              </>
                            ) : null}
                            <td className="p-2 text-center font-semibold">{item.frecuencia}</td>
                            <td className="p-2 text-center">{item.tipo || "-"}</td>
                            <td className="p-2 text-slate-500 truncate max-w-[200px]">{item.notas || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {importResult.preview.length > 20 && (
                      <div className="p-2 text-center text-xs text-slate-500 bg-slate-50">
                        ... y {importResult.preview.length - 20} mas
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Warnings */}
              {importResult.warnings.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-amber-700 mb-2">
                    Advertencias ({importResult.warnings.length})
                  </h4>
                  <div className="max-h-28 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50 p-2">
                    {importResult.warnings.map((w, i) => (
                      <div key={i} className="text-xs text-amber-800 py-0.5">{w}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* No changes */}
              {importResult.preview.length === 0 && (
                <div className="text-center py-4 text-slate-500">
                  No hay cambios para aplicar
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={importing}>
            Cancelar
          </Button>
          {importResult && importResult.preview.length > 0 && selectedFile && (
            <Button
              onClick={() => onApply(selectedFile)}
              disabled={importing}
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Aplicando...
                </>
              ) : (
                `Aplicar ${importResult.preview.length} cambios`
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

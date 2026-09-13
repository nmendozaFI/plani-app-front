/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, Save, X, Copy, Plus, Search, Settings2, ShieldCheck } from "lucide-react";
import { getTrimestreAnterior } from "@/utils/trimestres";
import {
  actionObtenerConfigsTrimestre,
  actionObtenerConfigResumen,
  actionActualizarConfigsBatch,
  actionInicializarConfigTrimestral,
  actionValidarConfigTrimestral,
} from "@/actions/config-trimestral-actions";
import { getRestricciones } from "@/actions/restricciones-actions";
import { useSettings } from "@/hooks/use-settings";
import type {
  ConfigTrimestralOut,
  ConfigTrimestralResumen,
  ConfigBatchUpdateItem,
  ValidarCTResponse,
} from "@/types/config-trimestral";
import { ValidacionCTModal } from "./ValidacionCTModal";
import type { Restriccion } from "@/types/restriccion";
const DIAS_SEMANA = ["L", "M", "X", "J", "V"];

// V16 — empresa rows show this badge if they have any active franja restriction.
function _resumenFranjas(rs: Restriccion[]): string {
  const horaria = rs.find((r) => r.clave === "franja_horaria");
  const porDia = rs.filter((r) => r.clave === "franja_por_dia");
  const partes: string[] = [];
  if (horaria) partes.push(`franja_horaria: ${horaria.valor}`);
  if (porDia.length > 0) {
    const detalle = porDia.map((r) => r.valor.replace(":", " ")).join(", ");
    partes.push(`franja_por_dia: ${detalle}`);
  }
  return partes.join(" · ");
}

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

  // V16: per-empresa franja restrictions for the QoL badge
  const [franjasPorEmpresa, setFranjasPorEmpresa] = useState<Map<number, Restriccion[]>>(new Map());

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTipo, setFilterTipo] = useState<string>("all");
  const [filterSinFreq, setFilterSinFreq] = useState(false);
  const [filterSoloEP, setFilterSoloEP] = useState(false);
  const [filterSoloPE, setFilterSoloPE] = useState(false); // V22 (Cambio A): filtro "Solo permite extras"


  // V27: pre-validación CT. `validacionResult` se queda como cache de la
  // última corrida — al cerrar y reabrir sin re-validar muestra lo último.
  // `empresaHighlightId` se setea al hacer click en una empresa del modal y
  // se limpia con setTimeout para que el highlight amber dure ~2s.
  const [validacionLoading, setValidacionLoading] = useState(false);
  const [validacionResult, setValidacionResult] = useState<ValidarCTResponse | null>(null);
  const [showValidacionModal, setShowValidacionModal] = useState(false);
  const [empresaHighlightId, setEmpresaHighlightId] = useState<number | null>(null);

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
      // V16: load restrictions in parallel to compute the franja badge map
      const [configsResult, resumenResult, restricciones] = await Promise.all([
        actionObtenerConfigsTrimestre(trimestre),
        actionObtenerConfigResumen(trimestre),
        getRestricciones().catch(() => [] as Restriccion[]),
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

      // V16: build empresaId -> [franja restrictions]
      const map = new Map<number, Restriccion[]>();
      for (const r of restricciones) {
        if (r.clave !== "franja_horaria" && r.clave !== "franja_por_dia") continue;
        const arr = map.get(r.empresa_id) || [];
        arr.push(r);
        map.set(r.empresa_id, arr);
      }
      setFranjasPorEmpresa(map);

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
      if (filterSinFreq) {
        // V24 (Cambio B, D2/D7): "sin frecuencia" pasa a significar "ambos
        // frecuencia_ef y frecuencia_it NULL o 0" — esas empresas se omiten
        // de la matriz semáforo. frecuencia_solicitada es cementerio.
        const ef = c.frecuencia_ef ?? 0;
        const it = c.frecuencia_it ?? 0;
        if (ef > 0 || it > 0) return false;
      }
      if (filterSoloEP && !c.escuela_propia) return false;
      if (filterSoloPE && !c.permite_extras) return false;
      return true;
    });
  }, [configs, searchTerm, filterTipo, filterSinFreq, filterSoloEP, filterSoloPE]);

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

  const isRowModified = (empresaId: number) => modifiedRows.has(empresaId);

  // V27: dispara la pre-validación CT y abre el modal con el resultado. El
  // modal es informativo — no bloquea generación. Aunque la CT esté vacía
  // (0 empresas) se muestra el modal en estado verde con resumen "0
  // empresas revisadas, sin inconsistencias".
  const handleValidar = useCallback(async () => {
    if (!trimestre || validacionLoading) return;
    setValidacionLoading(true);
    try {
      const result = await actionValidarConfigTrimestral(trimestre);
      if (!result.ok) throw new Error(result.error);
      setValidacionResult(result.data);
      setShowValidacionModal(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al validar configuración";
      toast.error(msg);
    } finally {
      setValidacionLoading(false);
    }
  }, [trimestre, validacionLoading]);

  // V27: click en una empresa del modal de validación → cierra el modal y
  // scrollea/resalta la fila. Si la empresa quedó fuera por filtros activos,
  // toast info para que la planificadora los limpie manualmente (más claro
  // que un wipe automático que sorprenda).
  const handleClickEmpresaEnTabla = useCallback(
    (empresaId: number) => {
      const visible = filteredConfigs.some((c) => c.empresa_id === empresaId);
      if (!visible) {
        const config = configs.find((c) => c.empresa_id === empresaId);
        const nombre = config?.empresa_nombre ?? `id=${empresaId}`;
        toast.info(`${nombre} está oculta por filtros activos; quitalos para verla.`);
        return;
      }
      const el = document.getElementById(`empresa-${empresaId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      setEmpresaHighlightId(empresaId);
      window.setTimeout(() => {
        setEmpresaHighlightId((prev) => (prev === empresaId ? null : prev));
      }, 2000);
    },
    [filteredConfigs, configs],
  );

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
      {/* V31 Capa 6: avisar que Frecuencias EF/IT se fijan en el flujo unificado */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs text-blue-800">
        Ojo: las Frecuencias EF/IT que se aplican al solver se fijan en{" "}
        <a href="/planificacion/configuracion" className="font-medium underline">Configuración del trimestre</a>{" "}
        (escribe la tabla que lee el solver <b>y</b> esta CT a la vez). Editarlas solo aquí puede desincronizar.
      </div>

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
            onClick={handleValidar}
            disabled={loading || validacionLoading || !trimestre}
            title="Detecta inconsistencias antes de generar el calendario"
          >
            {validacionLoading ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4 mr-1" />
            )}
            Validar configuración
          </Button>
          {/* V32 (B6): el Importar/Exportar Excel viejo (10 columnas) se retiró.
              Para configurar por archivo usá la pantalla nueva unificada. */}
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
              {resumen?.permite_extras ? (
                <span>{resumen.permite_extras} permite extras</span>
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
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={filterSoloEP}
                onCheckedChange={(c) => setFilterSoloEP(!!c)}
              />
              Solo EP
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={filterSoloPE}
                onCheckedChange={(c) => setFilterSoloPE(!!c)}
              />
              Solo PE
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
                    <th
                      className="text-center p-3 font-medium w-16"
                      title="Escuela propia — habilita a la empresa a tener slots DOBLE (semana intensiva) en este trimestre"
                    >
                      EP
                    </th>
                    <th
                      className="text-center p-3 font-medium w-16"
                      title="Permite Extras — habilita a la empresa a recibir slots EXTRA (sobre su frecuencia regular) en este trimestre"
                    >
                      PE
                    </th>
                    <th
                      className="text-center p-3 font-medium w-20"
                      title="Frecuencia EF — talleres EF asignados a la empresa este trimestre. Vacío = no participa en EF."
                    >
                      Freq EF
                    </th>
                    <th
                      className="text-center p-3 font-medium w-20"
                      title="Frecuencia IT — talleres IT asignados a la empresa este trimestre. Vacío = no participa en IT."
                    >
                      Freq IT
                    </th>
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
                      id={`empresa-${config.empresa_id}`}
                      className={`border-b hover:bg-muted/30 transition-colors ${
                        empresaHighlightId === config.empresa_id
                          ? "bg-amber-100 ring-2 ring-amber-300"
                          : isRowModified(config.empresa_id)
                            ? "border-l-4 border-l-amber-400 bg-amber-50/50"
                            : ""
                      }`}
                    >
                      <td className="p-3 font-medium">
                        <span className="inline-flex items-center gap-2">
                          {config.empresa_nombre}
                          {franjasPorEmpresa.get(config.empresa_id)?.length ? (
                            <Badge
                              variant="secondary"
                              title={_resumenFranjas(
                                franjasPorEmpresa.get(config.empresa_id) || []
                              )}
                              className="cursor-help text-[10px] font-normal"
                            >
                              ⚙ restr. horaria
                            </Badge>
                          ) : null}
                        </span>
                      </td>
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
                        <Checkbox
                          checked={(getValue(config, "escuela_propia") as boolean) ?? false}
                          onCheckedChange={(c) =>
                            handleFieldChange(config.empresa_id, "escuela_propia", !!c)
                          }
                        />
                      </td>
                      <td className="p-3 text-center">
                        <Checkbox
                          checked={(getValue(config, "permite_extras") as boolean) ?? false}
                          onCheckedChange={(c) =>
                            handleFieldChange(config.empresa_id, "permite_extras", !!c)
                          }
                        />
                      </td>
                      {/* V24 (Cambio B): inputs separados Freq EF y Freq IT.
                          Vacío = NULL en BD = empresa NO entra a la matriz
                          semáforo si AMBOS están vacíos (decisión D2). Uno
                          solo NULL = ese tipo en 0 (decisión D3). */}
                      <td className="p-3 text-center">
                        <Input
                          type="number"
                          min={0}
                          max={20}
                          className="h-8 w-16 text-center"
                          value={(getValue(config, "frecuencia_ef") as number | null | undefined) ?? ""}
                          onChange={(e) =>
                            handleFieldChange(
                              config.empresa_id,
                              "frecuencia_ef",
                              e.target.value === "" ? null : parseInt(e.target.value)
                            )
                          }
                        />
                      </td>
                      <td className="p-3 text-center">
                        <Input
                          type="number"
                          min={0}
                          max={20}
                          className="h-8 w-16 text-center"
                          value={(getValue(config, "frecuencia_it") as number | null | undefined) ?? ""}
                          onChange={(e) =>
                            handleFieldChange(
                              config.empresa_id,
                              "frecuencia_it",
                              e.target.value === "" ? null : parseInt(e.target.value)
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
                        {/* V32: el Turno vive en empresa.turnoPreferido (lo lee el
                            solver). Aquí queda de SOLO LECTURA para no escribir el
                            campo muerto CT.turnoPreferido. Se edita en «Configuración
                            del trimestre» o en «Empresas». */}
                        <span
                          className="text-sm text-slate-400"
                          title="El turno se configura en «Configuración del trimestre» o en «Empresas»"
                        >
                          {(getValue(config, "turno_preferido") as string) || "—"}
                        </span>
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

      <ValidacionCTModal
        isOpen={showValidacionModal}
        result={validacionResult}
        onClose={() => setShowValidacionModal(false)}
        onClickEmpresa={handleClickEmpresaEnTabla}
      />
    </div>
  );
}

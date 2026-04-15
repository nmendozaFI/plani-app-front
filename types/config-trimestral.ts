/**
 * ConfigTrimestral types.
 * Per-company quarterly configuration.
 */

export interface ConfigTrimestralOut {
  id: number;
  empresa_id: number;
  empresa_nombre: string;
  tipo_participacion: string; // EF, IT, AMBAS
  escuela_propia: boolean;
  frecuencia_solicitada: number | null;
  disponibilidad_dias: string; // "L,M,X,J,V"
  turno_preferido: string | null; // "M", "T", null
  voluntarios_disponibles: number;
  preferencias_taller: string | null;
  notas: string | null;
}

export interface ConfigTrimestralUpdate {
  tipo_participacion?: string;
  escuela_propia?: boolean;
  frecuencia_solicitada?: number | null;
  disponibilidad_dias?: string;
  turno_preferido?: string | null;
  voluntarios_disponibles?: number;
  preferencias_taller?: string | null;
  notas?: string | null;
}

export interface ConfigBatchUpdateItem {
  empresa_id: number;
  tipo_participacion?: string;
  escuela_propia?: boolean;
  frecuencia_solicitada?: number | null;
  disponibilidad_dias?: string;
  turno_preferido?: string | null;
  voluntarios_disponibles?: number;
  preferencias_taller?: string | null;
  notas?: string | null;
}

export interface ConfigTrimestralListResponse {
  trimestre: string;
  total: number;
  configs: ConfigTrimestralOut[];
}

export interface ConfigTrimestralResumen {
  trimestre: string;
  total_configs: number;
  por_tipo: {
    EF: number;
    IT: number;
    AMBAS: number;
  };
  con_frecuencia: number;
  sin_frecuencia: number;
  escuela_propia: number;
}

export interface InicializarConfigResult {
  trimestre: string;
  total_configs: number;
  clonadas: number;
  nuevas: number;
  warnings: string[];
}

export interface CerrarTrimestreResult {
  trimestre: string;
  total_ok: number;
  total_cancelado: number;
  total_ignorado: number;
  preview: boolean;
}

export interface ImportPreviewItem {
  empresa_id: number;
  nombre: string;
  frecuencia: number;
  tipo: string | null;
  notas: string | null;
  detalle_ef: number | null;
  detalle_it: number | null;
}

export interface ImportarConfigExcelResult {
  trimestre: string;
  formato_detectado: "ideal" | "legacy";
  total_procesados: number;
  aplicados: number;
  preview: ImportPreviewItem[];
  warnings: string[];
  dry_run: boolean;
}

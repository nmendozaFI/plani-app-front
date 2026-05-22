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
  permite_extras: boolean; // V22 (Cambio A): gate para crear slots EXTRA
  frecuencia_solicitada: number | null; // V24 (Cambio B, D7): cementerio — backend lo deja pero ya no se lee/escribe en UI
  frecuencia_ef: number | null; // V24 (Cambio B): input planificadora para matriz semáforo
  frecuencia_it: number | null; // V24 (Cambio B): idem
  disponibilidad_dias: string; // "L,M,X,J,V"
  turno_preferido: string | null; // "M", "T", null
  voluntarios_disponibles: number;
  preferencias_taller: string | null;
  notas: string | null;
}

export interface ConfigTrimestralUpdate {
  tipo_participacion?: string;
  escuela_propia?: boolean;
  permite_extras?: boolean; // V22 (Cambio A)
  frecuencia_solicitada?: number | null;
  frecuencia_ef?: number | null; // V24 (Cambio B)
  frecuencia_it?: number | null; // V24 (Cambio B)
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
  permite_extras?: boolean; // V22 (Cambio A)
  frecuencia_solicitada?: number | null;
  frecuencia_ef?: number | null; // V24 (Cambio B)
  frecuencia_it?: number | null; // V24 (Cambio B)
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
  permite_extras: number; // V22 (Cambio A): count of CTs with permiteExtras=true
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

// V24 (Cambio B, B4.5): preview item del bulk CT importer en formato
// 10-columnas (Empresa | Freq EF | Freq IT | Tipo | Dias | Turno |
// Voluntarios | Escuela Propia | Permite Extras | Notas).
export interface ImportPreviewItem {
  empresa_id: number;
  nombre: string;
  frecuencia_ef: number | null;
  frecuencia_it: number | null;
  tipo: string | null;
  dias: string | null;
  turno: string | null; // "M" | "T" | null
  voluntarios: number | null;
  escuela_propia: boolean;
  permite_extras: boolean;
  notas: string | null;
}

export interface ImportarConfigExcelResult {
  trimestre: string;
  formato_detectado: "v24-split-efit"; // único formato aceptado en V24+
  total_procesados: number;
  aplicados: number;
  preview: ImportPreviewItem[];
  warnings: string[];
  dry_run: boolean;
}

// V21 / F3a: empresas elegibles EP. V25 Cambio C (Capa 3): el filtro pasó de
// `CT.escuelaPropia=true` al flag estructural `empresa.puedeSerEP=true`. El
// path mantiene `{trimestre}` por compat con frontend pero queda decorativo.
export interface EmpresaEP {
  id: number;
  nombre: string;
  tipo: "EF" | "IT" | "AMBAS";
  activa: boolean;
}

export interface ListaEmpresasEPResponse {
  trimestre: string;
  total: number;
  empresas: EmpresaEP[];
}

// V27: pre-validación de Config Trimestral. Las severidades vienen como
// strings literales del backend (no enums) para mantener el response simple.
// El `tipo` discrimina la sub-categoría dentro de la severidad.
export interface ValidacionItem {
  empresa_id: number;
  empresa_nombre: string;
  severidad: "error" | "warning";
  tipo: string;
  detalle: string;
  sugerencia: string;
}

export interface ValidarCTResponse {
  trimestre: string;
  total_empresas_revisadas: number;
  errores: ValidacionItem[];
  warnings: ValidacionItem[];
  resumen: string;
}

// V25 Cambio C (Capa 4): empresas elegibles para asignación DOBLE. Filtro:
// `empresa.puedeSerDoble=true AND empresa.activa=true`. Backend reusa la
// misma forma del response model (ListaEmpresasEPResponse) — aquí el type
// es independiente por claridad semántica (la página DOBLE no debería
// importar nada con "EP" en el nombre).
export interface EmpresaDoble {
  id: number;
  nombre: string;
  tipo: "EF" | "IT" | "AMBAS";
  activa: boolean;
}

export interface ListaEmpresasDobleResponse {
  trimestre: string;
  total: number;
  empresas: EmpresaDoble[];
}

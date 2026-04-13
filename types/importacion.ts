/**
 * Importacion (bulk import) types.
 * Extracted from lib/api.ts
 */

export interface ImportEmpresasResult {
  total_empresas: number;
  creadas: number;
  actualizadas: number;
  ciudades_creadas: string[];
  empresa_ciudad_links: number;
  config_trimestral_creadas: number;
  semanas_excluidas: number;
  warnings: string[];
}

export interface ImportHistoricoResult {
  trimestre: string;
  total_filas: number;
  importadas_ok: number;
  importadas_cancelado: number;
  vacantes_ignoradas: number;
  empresas_no_encontradas: string[];
  talleres_no_encontrados: string[];
  warnings: string[];
}

export interface EstadoImportacion {
  trimestre: string;
  empresas_activas: number;
  config_trimestral: number;
  frecuencias: number;
  historico: number;
  restricciones: number;
  ciudades: number;
  empresa_ciudad: number;
  semanas_excluidas: number;
  listo_fase_1: boolean;
  listo_fase_2: boolean;
}

export interface ClonarTrimestreResult {
  trimestre_origen: string;
  trimestre_destino: string;
  configs_clonadas: number;
  configs_ya_existentes: number;
  empresas_saltadas: string[];
  warnings: string[];
}

/**
 * Application Settings types.
 * Global settings for active quarter management.
 */

export interface AppSettings {
  trimestre_activo: string;
  trimestre_siguiente: string | null;
}

export interface AppSettingsUpdate {
  trimestre_activo?: string;
  trimestre_siguiente?: string | null;
}

export interface PromoverResult {
  success: boolean;
  message: string;
  settings: AppSettings;
}

/**
 * Planning status for UI decision-making.
 * Helps determine which trimestre to show in Frecuencias/Calendario pages.
 */
export interface PlanningStatus {
  trimestre_activo: string;
  trimestre_siguiente: string | null;
  activo_tiene_frecuencias: boolean;
  activo_tiene_calendario: boolean;
  siguiente_tiene_frecuencias: boolean;
  siguiente_tiene_calendario: boolean;
  /** Which trimestre should be planned next (may be activo if it needs planning) */
  trimestre_a_planificar: string | null;
  /** True if the activo trimestre still needs frecuencias or calendario */
  activo_necesita_planificacion: boolean;
}

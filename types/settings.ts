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

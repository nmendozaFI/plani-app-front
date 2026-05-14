-- V22 (Cambio A): introduce DOBLE en TipoAsignacion + permiteExtras en configTrimestral.
--
-- DOBLE: nueva categoría de Planificacion para "semana intensiva" de empresas con
-- escuelaPropia=true (IBERIA s3, VERISURE s8, LDA s9-10 en 2026-Q2). Ad-hoc, paralela
-- al solver, no consume frecuencia ni valida colisión. El bulk importer reconocerá
-- el literal DOBLE en la columna Tipo del Excel (decisión 7 del plan Cambio A).
--
-- permiteExtras (en configTrimestral): flag por trimestre que decide si una empresa
-- puede recibir slots EXTRA. Desacopla la regla AND-AND del bulk importer del gate
-- de creación de EXTRAs vía CRUD. Hereda al backfill de empresa.aceptaExtras.

-- AlterEnum
ALTER TYPE "TipoAsignacion" ADD VALUE IF NOT EXISTS 'DOBLE';

-- AlterTable
ALTER TABLE "configTrimestral"
ADD COLUMN IF NOT EXISTS "permiteExtras" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: hereda empresa.aceptaExtras a configs trimestrales existentes.
-- Idempotente: solo toca filas que están aún en el default (false) y cuya empresa
-- sí acepta extras. Re-ejecutarla no hace nada porque la próxima vez ya están en true.
UPDATE "configTrimestral" ct
   SET "permiteExtras" = true
  FROM "empresa" e
 WHERE ct."empresaId" = e.id
   AND e."aceptaExtras" = true
   AND ct."permiteExtras" = false;

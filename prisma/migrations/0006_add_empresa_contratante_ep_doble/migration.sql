-- V25 (Cambio C): añade 3 flags estructurales a empresa.
--
-- Contexto (RESUMEN_CONTEXTO_V25.md secs. 7-8, AUDITORIA_V25.md sec. 3):
--   - `esContratante`   : empresa con catálogo prioritario de 5 talleres. Habilita
--                          la regla C7 del solver (priorización taller.esContratante).
--   - `puedeSerEP`      : capacidad ESTRUCTURAL "puede ser Escuela Propia".
--                          Independiente de CT.escuelaPropia del trimestre. Habilita
--                          asignación manual a slot EP sin tocar CT.
--   - `puedeSerDoble`   : capacidad estructural análoga a puedeSerEP. Gate del
--                          endpoint nuevo /empresas-doble (Capa 3). El solver NO
--                          genera DOBLE automáticamente — decisión §11.3 V25.
--
-- Defaults a false: empresas existentes mantienen comportamiento (no contratante,
-- no EP, no doble) hasta que la planificadora marque los flags vía importer o UI.
--
-- Backfill: solo `puedeSerEP` se infiere del histórico. Si una empresa ha tenido
-- `escuelaPropia=true` en algún CT, se asume estructuralmente capaz de EP.
-- `puedeSerDoble` y `esContratante` NO se backfillean — son decisión explícita.

-- AlterTable
ALTER TABLE "empresa"
ADD COLUMN IF NOT EXISTS "esContratante"  BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "puedeSerEP"     BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "puedeSerDoble"  BOOLEAN NOT NULL DEFAULT false;

-- Backfill: empresa con CT.escuelaPropia=true (en cualquier trimestre) → puedeSerEP=true.
-- Idempotente: filtra empresas que aún están en el default.
UPDATE "empresa" e
   SET "puedeSerEP" = true
 WHERE e."puedeSerEP" = false
   AND EXISTS (
       SELECT 1 FROM "configTrimestral" ct
        WHERE ct."empresaId" = e.id
          AND ct."escuelaPropia" = true
   );

-- V17: collapse OK into CONFIRMADO on the planificacion table.
-- Operation page drops the OK state; execution tracking ("did the workshop
-- actually happen?") lives in the historicoTaller table (separate enum,
-- untouched by this migration).

UPDATE "planificacion"
   SET "estado" = 'CONFIRMADO'
 WHERE "estado" = 'OK';

"use client";

import { useCallback, useState } from "react";

/**
 * V26 — Hook compartido para abrir el modal de creación de slot desde una
 * franja libre del calendario mensual (botón "+ HH:MM" en cada celda).
 *
 * El modal recibe prellenados (semana, dia, horario, tipoSugerido):
 *   - tipoSugerido = "EF" | "IT": la otra mitad de la franja ya está ocupada,
 *     el modal bloquea el selector al tipo libre.
 *   - tipoSugerido = null: la franja está vacía, planificadora elige libremente.
 *
 * Espejo del patrón useSlotEditModal: el hook no conoce el shape del modal,
 * solo orquesta open/close/success. La cadena prefill → componente pasa por
 * `modalProps.prefill`.
 */

export interface CrearSlotPrefill {
  semana: number;
  dia: string;
  horario: string;
  /** Si la franja ya tiene 1 slot, su tipo. El modal bloquea el opuesto. */
  tipoSugerido: "EF" | "IT" | null;
}

export interface UseCrearSlotModalResult {
  openCrearModal: (prefill: CrearSlotPrefill) => void;
  modalProps: {
    isOpen: boolean;
    prefill: CrearSlotPrefill | null;
    onClose: () => void;
    onSuccess: () => void | Promise<void>;
  };
}

export interface UseCrearSlotModalOptions {
  /** Llamado tras un POST exitoso, antes de cerrar el modal. Refetchea el
   *  calendario (mismo callback que useSlotEditModal típicamente). */
  onRefresh: () => void | Promise<void>;
}

export function useCrearSlotModal({
  onRefresh,
}: UseCrearSlotModalOptions): UseCrearSlotModalResult {
  const [prefill, setPrefill] = useState<CrearSlotPrefill | null>(null);

  const openCrearModal = useCallback((next: CrearSlotPrefill) => {
    setPrefill(next);
  }, []);

  const handleClose = useCallback(() => {
    setPrefill(null);
  }, []);

  const handleSuccess = useCallback(async () => {
    await onRefresh();
    setPrefill(null);
  }, [onRefresh]);

  return {
    openCrearModal,
    modalProps: {
      isOpen: prefill !== null,
      prefill,
      onClose: handleClose,
      onSuccess: handleSuccess,
    },
  };
}

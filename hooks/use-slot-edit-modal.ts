"use client";

import { useCallback, useState } from "react";

import type { SlotCalendario } from "@/types/calendario";

/**
 * V26 — Hook compartido para abrir el modal de edición de un slot desde
 * cualquier vista (lista o calendario mensual).
 *
 * Centraliza el state isOpen + slot activo + callback de éxito. El llamador
 * pasa `onRefresh` (refetch del mes/semana visible). El hook devuelve:
 *   - `openEditModal(slot)`: abrir el modal con un slot dado.
 *   - `modalProps`: objeto listo para hacer spread en `<EditarSlotModal />`.
 *
 * No conoce el shape del modal, solo orquesta open/close/success. Si el modal
 * gana más props en el futuro (ej. `talleres` filtrados por programa), se
 * agregan acá y se hacen spread; el hook sigue siendo transparente.
 */

export interface UseSlotEditModalResult {
  openEditModal: (slot: SlotCalendario) => void;
  modalProps: {
    isOpen: boolean;
    slot: SlotCalendario | null;
    onClose: () => void;
    onSuccess: () => void | Promise<void>;
  };
}

export interface UseSlotEditModalOptions {
  /** Llamado tras un guardado/eliminación exitosos, antes de cerrar el modal.
   *  Típicamente refetchea el mes visible (mensual) o la semana visible (lista). */
  onRefresh: () => void | Promise<void>;
}

export function useSlotEditModal({
  onRefresh,
}: UseSlotEditModalOptions): UseSlotEditModalResult {
  const [slot, setSlot] = useState<SlotCalendario | null>(null);

  const openEditModal = useCallback((nextSlot: SlotCalendario) => {
    setSlot(nextSlot);
  }, []);

  const handleClose = useCallback(() => {
    setSlot(null);
  }, []);

  const handleSuccess = useCallback(async () => {
    await onRefresh();
    setSlot(null);
  }, [onRefresh]);

  return {
    openEditModal,
    modalProps: {
      isOpen: slot !== null,
      slot,
      onClose: handleClose,
      onSuccess: handleSuccess,
    },
  };
}

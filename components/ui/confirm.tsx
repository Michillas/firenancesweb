"use client";

import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";
import { AppModal } from "./app-modal";
import { Button } from "./kit";

interface ConfirmRequest {
  title: string;
  body?: string;
  confirmLabel?: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
}

const pending = createStore<{ request: ConfirmRequest | null }>(() => ({ request: null }));

// `await confirmAction({...})` from anywhere; the single <ConfirmHost/> in the shell renders it.
export function confirmAction(options: Omit<ConfirmRequest, "resolve">): Promise<boolean> {
  return new Promise((resolve) => {
    pending.getState().request?.resolve(false);
    pending.setState({ request: { ...options, resolve } });
  });
}

export function ConfirmHost() {
  const request = useStore(pending, (s) => s.request);
  const close = (ok: boolean) => {
    request?.resolve(ok);
    pending.setState({ request: null });
  };
  return (
    <AppModal
      isOpen={Boolean(request)}
      onOpenChange={(open) => !open && close(false)}
      title={request?.title}
      size="xs"
      footer={
        <>
          <Button variant="tertiary" onPress={() => close(false)}>
            Cancelar
          </Button>
          <Button variant={request?.danger ? "danger" : "primary"} onPress={() => close(true)}>
            {request?.confirmLabel ?? "Confirmar"}
          </Button>
        </>
      }
    >
      {request?.body && <p className="text-muted">{request.body}</p>}
    </AppModal>
  );
}

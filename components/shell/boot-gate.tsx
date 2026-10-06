"use client";

import { Spinner } from "@/components/ui";
import { useBootError, useBootReady } from "@/store/hydrate";

// Nothing renders until storage has been read, so screens never flash "empty" and then fill in.
export function BootGate({ children }: { children: React.ReactNode }) {
  const ready = useBootReady();
  const error = useBootError();
  if (!ready) {
    return (
      <div className="grid min-h-dvh place-items-center" role="status" aria-live="polite">
        <div className="flex flex-col items-center gap-3 text-muted">
          <Spinner size="lg" />
          <span className="text-sm font-medium tracking-wide">FireNances</span>
        </div>
      </div>
    );
  }
  return (
    <>
      {error && (
        <div role="alert" className="bg-danger px-4 py-2 text-center text-sm text-danger-foreground">
          No se ha podido abrir el almacenamiento local: {error}
        </div>
      )}
      {children}
    </>
  );
}

"use client";

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="grid min-h-dvh place-items-center p-6 text-center" role="alert">
      <div className="flex max-w-md flex-col items-center gap-4">
        <h1 className="text-2xl font-bold">Algo ha salido mal</h1>
        <p className="text-sm text-muted">{error.message}</p>
        <button type="button" onClick={reset} className="btn btn-primary">
          Reintentar
        </button>
        <p className="text-xs text-muted">Tus datos siguen guardados en este dispositivo.</p>
      </div>
    </div>
  );
}

"use client";

import { ThemeProvider } from "next-themes";
import { useEffect } from "react";
import { ToastHost } from "@/components/ui";
import { AppEffects } from "@/components/shell/app-effects";
import { BootGate } from "@/components/shell/boot-gate";
import { hydrateAll } from "@/store/hydrate";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void hydrateAll();
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <BootGate>
        <AppEffects />
        {children}
      </BootGate>
      <ToastHost closeLabel="Cerrar" />
    </ThemeProvider>
  );
}

"use client";

import { ThemeProvider } from "next-themes";
import { ToastHost } from "@/components/ui";

// Shared by the public site and the app. Storage, boot and live data start in the app layout only, so the
// public pages render on the server without waiting for IndexedDB.
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      {children}
      <ToastHost closeLabel="Cerrar" />
    </ThemeProvider>
  );
}

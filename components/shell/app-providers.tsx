"use client";

import { useEffect } from "react";
import { VISITED_KEY } from "@/lib/config";
import { useLocalValue } from "@/lib/use-local-value";
import { hydrateAll } from "@/store/hydrate";
import { AppEffects } from "./app-effects";
import { BootGate } from "./boot-gate";

// Everything that needs the local database: only the app routes mount it, never the public pages.
export function AppProviders({ children }: { children: React.ReactNode }) {
  const [visited, setVisited] = useLocalValue(VISITED_KEY, "");

  useEffect(() => {
    void hydrateAll();
  }, []);

  useEffect(() => {
    if (!visited) setVisited("1");
  }, [visited, setVisited]);

  return (
    <BootGate>
      <AppEffects />
      {children}
    </BootGate>
  );
}

"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { VISITED_KEY } from "@/lib/config";
import { useLocalValue } from "@/lib/use-local-value";

// Main call to action. Returning users (the app has been opened in this browser) go straight to their panel.
export function ReturningCta({ size = "md", className }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const [visited] = useLocalValue(VISITED_KEY, "");
  return (
    <Link href="/dashboard" className={cn("btn btn-primary", size === "sm" && "btn-sm", size === "lg" && "btn-lg", className)}>
      {visited ? "Ir a mi panel" : "Empezar gratis"}
      <ArrowRight size={size === "sm" ? 15 : 18} aria-hidden="true" />
    </Link>
  );
}

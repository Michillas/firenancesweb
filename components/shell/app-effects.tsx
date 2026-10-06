"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";
import { applyUiPrefs, saveUiPrefs } from "@/lib/ui-prefs";
import { loadAiCapabilities } from "@/store/ai";
import { useDoc } from "@/store/create-doc-store";
import { exposeDevTools } from "@/store/dev";
import { ensureFx } from "@/store/market";
import { settings } from "@/store/stores";

// Headless: keeps the document in sync with settings.
export function AppEffects() {
  const prefs = useDoc(settings);
  const { setTheme } = useTheme();

  useEffect(() => {
    const ui = { textScale: prefs.textScale, reduceMotion: prefs.reduceMotion, highContrast: prefs.highContrast };
    applyUiPrefs(ui);
    saveUiPrefs(ui);
  }, [prefs.textScale, prefs.reduceMotion, prefs.highContrast]);

  useEffect(() => {
    setTheme(prefs.theme);
  }, [prefs.theme, setTheme]);

  useEffect(() => {
    void ensureFx();
  }, [prefs.currency]);

  useEffect(() => {
    exposeDevTools();
    void loadAiCapabilities();
  }, []);

  return null;
}

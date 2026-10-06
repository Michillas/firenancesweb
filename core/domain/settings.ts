import { z } from "zod";
import { isoString } from "./base";

export const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "JPY", "SEK", "NOK", "DKK", "CAD", "AUD", "HKD", "CNY", "MXN", "ARS", "COP", "CLP"] as const;
export type Currency = (typeof CURRENCIES)[number];

const singleton = {
  id: z.string().default("singleton"),
  createdAt: isoString,
  updatedAt: isoString,
  deletedAt: isoString.nullable().optional(),
};

export const userSettingsSchema = z.object({
  ...singleton,
  displayName: z.string().default(""),
  // Base currency: every total is shown in it (other currencies are converted with daily FX rates).
  currency: z.enum(CURRENCIES).default("EUR"),
  theme: z.enum(["system", "light", "dark"]).default("dark"),
  textScale: z.number().min(0.85).max(1.4).default(1),
  reduceMotion: z.boolean().default(false),
  highContrast: z.boolean().default(false),
  // Hides amounts on screen (shoulder-surfing / screen sharing).
  privacyMode: z.boolean().default(false),
  weekStartsOn: z.union([z.literal(0), z.literal(1)]).default(1),
  // Spanish tax calendar extras for the self-employed (modelos 130 / 303).
  selfEmployed: z.boolean().default(false),
  showTaxCalendar: z.boolean().default(true),
  onboardingDone: z.boolean().default(false),
});
export type UserSettings = z.infer<typeof userSettingsSchema>;

export const AI_PROVIDER_IDS = ["openrouter", "gemini", "pollinations", "custom"] as const;
export type AIProviderId = (typeof AI_PROVIDER_IDS)[number];

export const providerConfigSchema = z.object({
  id: z.enum(AI_PROVIDER_IDS),
  enabled: z.boolean().default(true),
  apiKey: z.string().default(""),
  // `custom` only (Ollama, LM Studio, any OpenAI-compatible endpoint)
  baseUrl: z.string().default(""),
  model: z.string().default(""),
});
export type ProviderConfig = z.infer<typeof providerConfigSchema>;

// Secrets and per-machine choices. Never exported in backups.
export const deviceSettingsSchema = z.object({
  ...singleton,
  aiProviders: z.array(providerConfigSchema).default([]),
});
export type DeviceSettings = z.infer<typeof deviceSettingsSchema>;

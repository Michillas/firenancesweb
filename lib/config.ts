// The single place that reads public environment variables. NEXT_PUBLIC_* values are inlined at build time.
export const config = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "",
} as const;

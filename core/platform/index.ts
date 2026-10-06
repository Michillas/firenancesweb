import type { PlatformAdapter } from "./types";
import { createWebPlatform } from "./web";

export * from "./types";
export { createWebPlatform };

let cached: PlatformAdapter | null = null;

export function getPlatform(): PlatformAdapter {
  return (cached ??= createWebPlatform());
}

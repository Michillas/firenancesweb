import { z } from "zod";

export const isoString = z.string();

export const entityShape = {
  id: z.string(),
  createdAt: isoString,
  updatedAt: isoString,
  // Tombstone: soft-deleted rows stay in storage so sync can propagate the deletion.
  deletedAt: isoString.nullable().optional(),
};

export type EntityBase = {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
};

// crypto.randomUUID only exists in secure contexts (https / localhost); a LAN
// http:// deployment would crash on it, so fall back to getRandomValues / Math.random.
export function newId(prefix: string): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  let rand: string;
  if (c?.randomUUID) rand = c.randomUUID().replace(/-/g, "").slice(0, 16);
  else if (c?.getRandomValues) {
    const bytes = new Uint8Array(8);
    c.getRandomValues(bytes);
    rand = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  } else rand = Math.random().toString(16).slice(2).padEnd(16, "0").slice(0, 16);
  return `${prefix}_${rand}`;
}

export const nowIso = () => new Date().toISOString();

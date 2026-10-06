import { dataCollections, docs, plan, settings } from "./stores";
import { getStorage } from "./runtime";

export const BACKUP_VERSION = 1;

export interface BackupFile {
  app: "firenances";
  version: number;
  exportedAt: string;
  data: Record<string, unknown[]>;
}

// AI keys (device) and the market cache are intentionally excluded.
export function exportBackup(): BackupFile {
  const data: Record<string, unknown[]> = {};
  for (const c of dataCollections) data[c.name] = c.rawAll();
  for (const d of [settings, plan]) data[d.name] = d.rawAll();
  return { app: "firenances", version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data };
}

export class BackupError extends Error {}

export function importBackup(raw: unknown) {
  const file = raw as Partial<BackupFile>;
  if (file?.app !== "firenances" || typeof file.data !== "object" || !file.data) throw new BackupError("Not a FireNances backup");
  if ((file.version ?? 0) > BACKUP_VERSION) throw new BackupError("Backup was made by a newer version");
  for (const c of dataCollections) {
    const rows = file.data[c.name];
    if (Array.isArray(rows)) c.replaceAll(rows);
  }
  for (const d of [settings, plan]) {
    const rows = file.data[d.name];
    if (Array.isArray(rows)) d.replaceAll(rows);
  }
}

export async function wipeAllData() {
  const storage = getStorage();
  const { collections } = await import("./stores");
  await Promise.all([...collections.map((c) => storage.clearCollection(c.name)), ...docs.map((d) => storage.clearCollection(d.name))]);
  if (typeof window !== "undefined") window.location.reload();
}

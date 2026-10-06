import { createIdbDriver } from "../storage/idb";
import { createMemoryDriver } from "../storage/memory";
import type { StorageDriver } from "../storage/types";
import type { PlatformAdapter } from "./types";

export function createWebPlatform(): PlatformAdapter {
  return {
    kind: "web",
    createStorage(): StorageDriver {
      return typeof indexedDB === "undefined" ? createMemoryDriver() : createIdbDriver();
    },
    pickFiles(opts) {
      return new Promise((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.multiple = opts?.multiple ?? false;
        if (opts?.accept?.length) input.accept = opts.accept.join(",");
        input.onchange = () => resolve(Array.from(input.files ?? []));
        input.oncancel = () => resolve([]);
        input.click();
      });
    },
    async saveFile(filename, blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    },
    async requestNotificationPermission() {
      if (typeof Notification === "undefined") return "unsupported";
      return Notification.requestPermission();
    },
    async notify(title, body) {
      if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
      new Notification(title, { body });
    },
    openExternal(url) {
      window.open(url, "_blank", "noopener,noreferrer");
    },
  };
}

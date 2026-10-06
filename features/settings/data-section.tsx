"use client";

import { Download, FlaskConical, Trash2, Upload } from "lucide-react";
import { useRef } from "react";
import { Button, Card, confirmAction, toast } from "@/components/ui";
import { getPlatform } from "@/core/platform";
import { todayKey } from "@/core/logic/dates";
import { BackupError, exportBackup, importBackup, wipeAllData } from "@/store/backup";
import { useCollection } from "@/store/create-collection-store";
import { loadDemoData } from "@/store/demo";
import { accounts, transactions } from "@/store/stores";

export function DataSection() {
  const file = useRef<HTMLInputElement>(null);
  const hasData = useCollection(accounts).length + useCollection(transactions).length > 0;

  const exportData = () => {
    const blob = new Blob([JSON.stringify(exportBackup(), null, 2)], { type: "application/json" });
    void getPlatform().saveFile(`firenances-copia-${todayKey()}.json`, blob);
  };

  const onImport = async (f: File | undefined) => {
    if (!f) return;
    try {
      const raw = JSON.parse(await f.text());
      if (!(await confirmAction({ title: "¿Restaurar esta copia?", body: "Sustituirá todos los datos actuales de este navegador.", danger: true, confirmLabel: "Restaurar" }))) return;
      importBackup(raw);
      toast.success("Copia restaurada");
    } catch (e) {
      toast.danger(e instanceof BackupError || e instanceof SyntaxError ? "Ese archivo no es una copia de FireNances" : "No se pudo restaurar la copia");
    }
  };

  return (
    <Card className="gap-4">
      <Card.Header>
        <div>
          <Card.Title>Tus datos</Card.Title>
          <Card.Description>Todo vive en este navegador (IndexedDB). Haz copias de seguridad de vez en cuando.</Card.Description>
        </div>
      </Card.Header>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onPress={exportData}>
          <Download size={15} aria-hidden="true" /> Exportar copia
        </Button>
        <Button variant="secondary" onPress={() => file.current?.click()}>
          <Upload size={15} aria-hidden="true" /> Restaurar copia
        </Button>
        <input ref={file} type="file" accept="application/json,.json" className="sr-only" aria-label="Restaurar copia" onChange={(e) => { void onImport(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
      {!hasData && (
        <div className="flex flex-col gap-1.5 rounded-xl border border-border p-3">
          <p className="text-sm text-muted">¿Quieres ver cómo funciona? Carga seis meses de datos de ejemplo.</p>
          <Button size="sm" variant="secondary" className="self-start" onPress={() => { loadDemoData(); toast.success("Datos de ejemplo cargados"); }}>
            <FlaskConical size={14} aria-hidden="true" /> Cargar datos de ejemplo
          </Button>
        </div>
      )}
      <Button variant="danger" className="self-start" onPress={async () => (await confirmAction({ title: "¿Borrar todos los datos?", body: "Se eliminarán cuentas, movimientos, inversiones y ajustes de este navegador. Las claves de IA se conservan solo si no borras el almacenamiento del sitio.", danger: true, confirmLabel: "Borrar todo" })) && (await wipeAllData())}>
        <Trash2 size={15} aria-hidden="true" /> Borrar todos los datos
      </Button>
    </Card>
  );
}

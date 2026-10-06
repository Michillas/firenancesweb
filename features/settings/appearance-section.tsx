"use client";

import { Card, RangeField, Segmented, SelectInput, SwitchField } from "@/components/ui";
import { useDoc } from "@/store/create-doc-store";
import { settings } from "@/store/stores";

export function AppearanceSection() {
  const s = useDoc(settings);
  return (
    <Card className="gap-4">
      <Card.Header>
        <Card.Title>Apariencia y accesibilidad</Card.Title>
      </Card.Header>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-bold">Tema</span>
        <Segmented label="Tema" value={s.theme} onChange={(theme) => settings.patch({ theme })} options={[{ id: "system", label: "Sistema" }, { id: "light", label: "Claro" }, { id: "dark", label: "Oscuro" }]} className="self-start" />
      </div>
      <RangeField label="Tamaño del texto" value={Math.round(s.textScale * 100)} onChange={(v) => settings.patch({ textScale: v / 100 })} min={85} max={140} step={5} valueLabel={`${Math.round(s.textScale * 100)} %`} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SwitchField label="Modo privado" hint="Oculta los importes (útil al compartir pantalla)." isSelected={s.privacyMode} onChange={(v) => settings.patch({ privacyMode: v })} />
        <SwitchField label="Reducir animaciones" isSelected={s.reduceMotion} onChange={(v) => settings.patch({ reduceMotion: v })} />
        <SwitchField label="Alto contraste" isSelected={s.highContrast} onChange={(v) => settings.patch({ highContrast: v })} />
      </div>
      <SelectInput className="max-w-xs" label="La semana empieza en" value={String(s.weekStartsOn)} onChange={(v) => settings.patch({ weekStartsOn: v === "0" ? 0 : 1 })} options={[{ id: "1", label: "Lunes" }, { id: "0", label: "Domingo" }]} />
    </Card>
  );
}

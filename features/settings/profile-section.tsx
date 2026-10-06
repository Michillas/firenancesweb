"use client";

import { Card, SelectInput, SwitchField, TextInput } from "@/components/ui";
import { CURRENCIES, type Currency } from "@/core/domain/settings";
import { useDoc } from "@/store/create-doc-store";
import { ensureFx } from "@/store/market";
import { settings } from "@/store/stores";

export function ProfileSection() {
  const s = useDoc(settings);
  return (
    <Card className="gap-4">
      <Card.Header>
        <Card.Title>Perfil y preferencias</Card.Title>
      </Card.Header>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInput label="Tu nombre" value={s.displayName} onChange={(displayName) => settings.patch({ displayName })} placeholder="Cómo quieres que te llamemos" />
        <SelectInput
          label="Moneda principal"
          value={s.currency}
          onChange={(v) => {
            if (!v) return;
            settings.patch({ currency: v as Currency });
            void ensureFx(true);
          }}
          options={CURRENCIES.map((c) => ({ id: c, label: c }))}
        />
      </div>
      <p className="text-sm text-muted">Los importes en otras monedas se convierten con los tipos de cambio diarios del BCE.</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SwitchField label="Calendario fiscal español" hint="Renta, modelos 720/721, plan de pensiones…" isSelected={s.showTaxCalendar} onChange={(v) => settings.patch({ showTaxCalendar: v })} />
        <SwitchField label="Soy autónomo" hint="Añade los modelos 130 y 303 trimestrales." isSelected={s.selfEmployed} onChange={(v) => settings.patch({ selfEmployed: v })} />
      </div>
    </Card>
  );
}

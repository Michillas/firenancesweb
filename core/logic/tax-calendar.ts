import type { DayKey } from "./dates";

export interface TaxDate {
  id: string;
  date: DayKey;
  title: string;
  detail: string;
  // Approximate dates are announced each year by the Agencia Tributaria.
  approximate?: boolean;
  selfEmployedOnly?: boolean;
}

// Spanish personal-finance tax calendar. Dates that fall on a weekend move to the next working day
// in reality; we show the legal date and flag the approximate ones.
export function spanishTaxCalendar(year: number, opts: { selfEmployed: boolean }): TaxDate[] {
  const y = String(year);
  const list: TaxDate[] = [
    { id: `720-${y}`, date: `${y}-03-31`, title: "Modelo 720 / 721", detail: "Último día para declarar bienes (720) y criptomonedas (721) en el extranjero si superan 50.000 € a 31 de diciembre." },
    { id: `renta-start-${y}`, date: `${y}-04-02`, title: "Empieza la campaña de la Renta", detail: `Declaración de la Renta ${year - 1} por internet. Revisa el borrador: dividendos, ventas de fondos/acciones y aportaciones a planes de pensiones.`, approximate: true },
    { id: `renta-dom-${y}`, date: `${y}-06-25`, title: "Renta: último día con domiciliación", detail: "Si la declaración sale a pagar y quieres cargo en cuenta (o fraccionar 60/40)." },
    { id: `renta-end-${y}`, date: `${y}-06-30`, title: "Fin de la campaña de la Renta", detail: "Último día para presentar la declaración. El primer pago (60 % si fraccionas) se carga hoy." },
    { id: `renta-2nd-${y}`, date: `${y}-11-05`, title: "Renta: segundo plazo (40 %)", detail: "Cargo del segundo pago si fraccionaste la declaración." },
    { id: `pension-${y}`, date: `${y}-12-31`, title: "Último día para aportar al plan de pensiones", detail: "Las aportaciones (hasta 1.500 € individuales, más los planes de empleo) reducen la base imponible de este año." },
    { id: `harvest-${y}`, date: `${y}-12-15`, title: "Revisa plusvalías y minusvalías", detail: "Antes de fin de año: compensa ganancias con pérdidas (respeta la regla de los 2 meses de recompra). Los traspasos entre fondos no tributan." },
    { id: `donations-${y}`, date: `${y}-12-31`, title: "Donativos deducibles", detail: "Último día para que los donativos cuenten en la Renta de este año." },
  ];
  if (opts.selfEmployed) {
    const quarters: [string, string][] = [
      [`${y}-01-30`, `4T ${year - 1} (y resumen anual 390)`],
      [`${y}-04-20`, `1T ${year}`],
      [`${y}-07-20`, `2T ${year}`],
      [`${y}-10-20`, `3T ${year}`],
    ];
    for (const [date, label] of quarters) {
      list.push({ id: `130-${date}`, date, title: `Modelos 130 y 303 · ${label}`, detail: "Pago fraccionado del IRPF y liquidación del IVA trimestral.", selfEmployedOnly: true });
    }
  }
  return list.sort((a, b) => a.date.localeCompare(b.date));
}

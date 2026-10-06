import type { TxKind } from "../domain/finance";

// Bank exports differ wildly (";" vs ",", "1.234,56" vs "1,234.56", dd/mm/yyyy...): detect, don't assume.

export function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).slice(0, 10).join("\n");
  const counts = [";", ",", "\t", "|"].map((d) => ({ d, n: sample.split(d).length }));
  return counts.sort((a, b) => b.n - a.n)[0].d;
}

export function parseCsv(text: string, delimiter = detectDelimiter(text)): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const input = text.replace(/^﻿/, "");
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      row.push(cell.trim());
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i++;
      row.push(cell.trim());
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell.trim());
  if (row.some((c) => c !== "")) rows.push(row);
  return rows;
}

// "1.234,56 €", "-1,234.56", "(12.50)", "12,5" -> number (NaN when not a number).
export function parseAmount(raw: string): number {
  let s = raw.replace(/[€$£\s]|EUR|USD/gi, "").trim();
  if (!s) return NaN;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.endsWith("-")) {
    negative = true;
    s = s.slice(0, -1);
  }
  if (s.startsWith("-")) {
    negative = !negative;
    s = s.slice(1);
  } else if (s.startsWith("+")) s = s.slice(1);
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
  else if (lastDot > lastComma && lastComma !== -1) s = s.replace(/,/g, "");
  else if (lastComma === -1 && (s.match(/\./g)?.length ?? 0) > 1) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) ? (negative ? -n : n) : NaN;
}

// dd/mm/yyyy, dd-mm-yy, yyyy-mm-dd, dd.mm.yyyy -> YYYY-MM-DD (null when unparseable).
export function parseDate(raw: string): string | null {
  const s = raw.trim().slice(0, 10);
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (m) {
    const year = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return valid(year, +m[2], +m[1]);
  }
  return null;
}

function valid(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1970 || y > 2100) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export interface CsvMapping {
  date: number;
  description: number;
  amount: number | null;
  // Banks that split money in/out into two columns.
  debit: number | null;
  credit: number | null;
  merchant: number | null;
  // Running balance column, if the bank exports one.
  balance: number | null;
  headerRow: boolean;
}

const has = (h: string, words: string[]) => words.some((w) => h.includes(w));

export function detectMapping(rows: string[][]): CsvMapping | null {
  if (rows.length === 0) return null;
  const header = rows[0].map((h) => h.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""));
  const find = (words: string[]) => header.findIndex((h) => has(h, words));
  let date = find(["fecha operacion", "fecha", "date", "f. valor", "valor"]);
  let description = find(["concepto", "descripcion", "description", "detalle", "movimiento", "observaciones", "texto"]);
  let amount = find(["importe", "amount", "cantidad", "monto"]);
  const debit = find(["cargo", "debe", "debit", "salida", "gasto"]);
  const credit = find(["abono", "haber", "credit", "entrada", "ingreso"]);
  const merchant = find(["comercio", "merchant", "beneficiario", "establecimiento"]);
  const balance = find(["saldo", "balance", "disponible"]);
  const headerRow = date !== -1 || description !== -1 || amount !== -1;
  if (!headerRow) {
    // No header: infer from the first data row.
    const first = rows[0];
    date = first.findIndex((c) => parseDate(c) !== null);
    amount = first.findIndex((c, i) => i !== date && !Number.isNaN(parseAmount(c)) && /\d/.test(c));
    description = first.findIndex((c, i) => i !== date && i !== amount && c.length > 2);
  }
  if (date === -1 || description === -1 || (amount === -1 && (debit === -1 || credit === -1))) return null;
  return {
    date,
    description,
    amount: amount === -1 ? null : amount,
    debit: amount === -1 ? debit : null,
    credit: amount === -1 ? credit : null,
    merchant: merchant === -1 || merchant === description ? null : merchant,
    balance: balance === -1 || !headerRow ? null : balance,
    headerRow,
  };
}

export interface DraftTransaction {
  date: string;
  amount: number;
  kind: TxKind;
  description: string;
  merchant: string;
}

export function rowsToDrafts(rows: string[][], mapping: CsvMapping): DraftTransaction[] {
  const out: DraftTransaction[] = [];
  for (const row of mapping.headerRow ? rows.slice(1) : rows) {
    const date = parseDate(row[mapping.date] ?? "");
    if (!date) continue;
    let signed: number;
    if (mapping.amount != null) signed = parseAmount(row[mapping.amount] ?? "");
    else {
      const debit = parseAmount(row[mapping.debit!] ?? "");
      const credit = parseAmount(row[mapping.credit!] ?? "");
      signed = (Number.isNaN(credit) ? 0 : Math.abs(credit)) - (Number.isNaN(debit) ? 0 : Math.abs(debit));
    }
    if (Number.isNaN(signed) || signed === 0) continue;
    out.push({
      date,
      amount: Math.abs(signed),
      kind: signed < 0 ? "expense" : "income",
      description: (row[mapping.description] ?? "").replace(/\s+/g, " ").trim(),
      merchant: mapping.merchant != null ? (row[mapping.merchant] ?? "").trim() : "",
    });
  }
  return out;
}

// Balance after the most recent movement (for "set the account balance to the statement's").
export function closingBalance(rows: string[][], mapping: CsvMapping): number | null {
  if (mapping.balance == null) return null;
  let best: { date: string; index: number; value: number } | null = null;
  (mapping.headerRow ? rows.slice(1) : rows).forEach((row, index) => {
    const date = parseDate(row[mapping.date] ?? "");
    const value = parseAmount(row[mapping.balance!] ?? "");
    if (!date || Number.isNaN(value)) return;
    // Same day: banks list newest first, so the first row of that day wins.
    if (!best || date > best.date) best = { date, index, value };
  });
  return best ? (best as { value: number }).value : null;
}

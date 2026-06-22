// Builds SQL-Account-ready output matching the FISHCO template:
// ITEM CODE | DESCRIPTION | QTY | UOM | U/PRICE | SUB TOTAL
// SQL Account's XLS import requires numeric columns with no commas / no
// currency symbols (blank -> 0).

export const SQL_COLUMNS = [
  "ITEM CODE",
  "DESCRIPTION",
  "QTY",
  "UOM",
  "U/PRICE",
  "SUB TOTAL",
] as const;

export type ExportLine = {
  matchedCode: string | null;
  // The Hock Lee master-code description (what SQL Account should show). Falls
  // back to the raw invoice wording only when the line has no matched code yet.
  matchedDescription?: string | null;
  rawDescription: string;
  qty: number;
  uom: string;
  unitPrice: number;
  subtotal: number;
};

function num(n: number): number {
  if (!Number.isFinite(n)) return 0;
  // Avoid floating dust; keep up to 4 dp.
  return Math.round(n * 10000) / 10000;
}

/** A row as an array of cells in canonical column order (numbers stay numbers). */
export function toRow(line: ExportLine): (string | number)[] {
  // Prefer the master-code description; fall back to invoice wording if unmatched.
  const description =
    (line.matchedCode ? line.matchedDescription : null) ?? line.rawDescription ?? "";
  return [
    line.matchedCode ?? "",
    description,
    num(line.qty),
    line.uom || "KG",
    num(line.unitPrice),
    num(line.subtotal),
  ];
}

/** Tab-separated rows (NO header) for paste into SQL Account. */
export function toTSV(lines: ExportLine[]): string {
  return lines
    .map((l) => toRow(l).map((c) => String(c)).join("\t"))
    .join("\n");
}

/** Array-of-arrays (header + rows) for SheetJS aoa_to_sheet. */
export function toAoA(lines: ExportLine[]): (string | number)[][] {
  return [[...SQL_COLUMNS], ...lines.map(toRow)];
}

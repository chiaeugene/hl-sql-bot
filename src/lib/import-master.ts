import path from "node:path";
import * as XLSX from "xlsx";
import type { PrismaClient } from "@/generated/prisma/client";
import { normalizeText } from "@/lib/normalize";

export const MASTER_FILE = path.join(
  process.cwd(),
  "data",
  "HL SUPPLIER MASTER.xlsx"
);

type Row = { "ITEM CODE"?: unknown; DESCRIPTION?: unknown };

type AnyPrisma = Pick<
  PrismaClient,
  "supplier" | "supplierItem" | "supplierAlias" | "itemAlias"
>;

export type ImportResult = { suppliers: number; items: number };

/**
 * Import the supplier master Excel (one sheet per supplier) into the DB.
 * Idempotent: re-running replaces each supplier's items and re-seeds aliases.
 */
export async function importMasterFromExcel(
  prisma: AnyPrisma,
  file: string = MASTER_FILE
): Promise<ImportResult> {
  const wb = XLSX.readFile(file);
  let suppliers = 0;
  let items = 0;

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Row>(ws, { raw: false, defval: "" });

    const supplierName = sheetName.trim();
    const supplier = await prisma.supplier.upsert({
      where: { name: supplierName },
      update: {},
      create: { name: supplierName },
    });
    suppliers++;

    await prisma.supplierItem.deleteMany({ where: { supplierId: supplier.id } });

    const existingAlias = await prisma.supplierAlias.findFirst({
      where: { supplierId: supplier.id, text: supplierName.toUpperCase() },
    });
    if (!existingAlias) {
      await prisma.supplierAlias.create({
        data: { supplierId: supplier.id, text: supplierName.toUpperCase() },
      });
    }

    for (const row of rows) {
      const code = String(row["ITEM CODE"] ?? "").trim();
      const description = String(row["DESCRIPTION"] ?? "").trim();
      if (!code || !description) continue;

      const item = await prisma.supplierItem.create({
        data: { supplierId: supplier.id, code, description },
      });
      items++;

      const norm = normalizeText(description);
      if (norm) {
        await prisma.itemAlias.upsert({
          where: {
            supplierItemId_rawText: { supplierItemId: item.id, rawText: norm },
          },
          update: {},
          create: { supplierItemId: item.id, rawText: norm, source: "seed" },
        });
      }
    }
  }

  return { suppliers, items };
}

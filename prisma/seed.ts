import path from "node:path";
import "dotenv/config";
import * as XLSX from "xlsx";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { normalizeText } from "../src/lib/normalize";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

const MASTER_FILE = path.join(process.cwd(), "data", "HL SUPPLIER MASTER.xlsx");

type Row = { "ITEM CODE"?: unknown; DESCRIPTION?: unknown };

async function main() {
  console.log("Seeding from:", MASTER_FILE);
  const wb = XLSX.readFile(MASTER_FILE);

  let supplierCount = 0;
  let itemCount = 0;

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    // raw:false keeps codes like "0028" as text (preserves leading zeros).
    const rows = XLSX.utils.sheet_to_json<Row>(ws, { raw: false, defval: "" });

    const supplierName = sheetName.trim();
    const supplier = await prisma.supplier.upsert({
      where: { name: supplierName },
      update: {},
      create: { name: supplierName },
    });
    supplierCount++;

    // Reset this supplier's items so re-seeding is idempotent.
    await prisma.supplierItem.deleteMany({ where: { supplierId: supplier.id } });

    // A default header alias = the supplier name itself.
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
      itemCount++;

      // Seed a learned alias from the canonical description itself.
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
    console.log(`  ${supplierName}: ${rows.length} rows`);
  }

  console.log(`Done. ${supplierCount} suppliers, ${itemCount} items.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

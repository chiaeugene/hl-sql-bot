import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { matchDescription } from "../src/lib/match";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const fishco = await prisma.supplier.findFirst({ where: { name: "FISHCO" } });
  if (!fishco) throw new Error("FISHCO not seeded");

  const items = await prisma.supplierItem.findMany({
    where: { supplierId: fishco.id },
    select: { id: true, code: true, description: true },
  });
  const aliasRows = await prisma.itemAlias.findMany({
    where: { supplierItem: { supplierId: fishco.id } },
    select: { supplierItemId: true, rawText: true },
  });
  const aliases = aliasRows.map((a) => ({
    supplierItemId: a.supplierItemId,
    rawText: a.rawText,
  }));

  // Realistic invoice variations: Chinese-only, Malay-only, messy spacing.
  const tests: [string, string][] = [
    ["IKAN TEMENANG 甘文", "0028"], // exact
    ["甘文", "0028"], // Chinese only
    ["IKAN JENAHAK", "0009"], // Malay only
    ["黑鲳", "0004"], // Chinese only
    ["ikan jepun 日本", "0011"], // lowercase + partial
    ["SELAR PARI", "0115"],
    ["石过", "0015"], // partial Chinese of KERAPU 石过/石斑
    ["IKAN SELAR 色拉", "0022"],
  ];

  let pass = 0;
  for (const [desc, want] of tests) {
    const m = matchDescription(desc, items, aliases);
    const ok = m.matchedCode === want;
    if (ok) pass++;
    console.log(
      `${ok ? "PASS" : "FAIL"}  "${desc}"  ->  ${m.matchedCode ?? "—"} (${m.method}, ${m.confidence.toFixed(
        2
      )})  want ${want}`
    );
  }
  console.log(`\n${pass}/${tests.length} matched correctly`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

import { prisma } from "@/lib/db";
import { normalizeText } from "@/lib/normalize";
import { matchDescription, type MatchItem, type MatchAlias } from "@/lib/match";

export type ResolvedLine = {
  rawDescription: string;
  qty: number;
  uom: string;
  unitPrice: number;
  subtotal: number;
  matchedCode: string | null;
  matchedItemId: string | null;
  matchConfidence: number;
  matchMethod: string;
};

/** Load a supplier's catalogue + learned aliases for matching. */
export async function loadSupplierMatchData(
  supplierId: string
): Promise<{ items: MatchItem[]; aliases: MatchAlias[] }> {
  const items = await prisma.supplierItem.findMany({
    where: { supplierId },
    select: { id: true, code: true, description: true },
  });
  const aliasRows = await prisma.itemAlias.findMany({
    where: { supplierItem: { supplierId } },
    select: { supplierItemId: true, rawText: true },
  });
  return {
    items,
    aliases: aliasRows.map((a) => ({
      supplierItemId: a.supplierItemId,
      rawText: a.rawText,
    })),
  };
}

type RawLine = { description: string; qty: number; uom: string; unitPrice: number };

/** Pair each parsed line to a Hock Lee item code, scoped to one supplier. */
export async function resolveLines(
  supplierId: string | null,
  lines: RawLine[]
): Promise<ResolvedLine[]> {
  let items: MatchItem[] = [];
  let aliases: MatchAlias[] = [];
  if (supplierId) {
    const data = await loadSupplierMatchData(supplierId);
    items = data.items;
    aliases = data.aliases;
  }

  return lines.map((l) => {
    const qty = Number(l.qty) || 0;
    const unitPrice = Number(l.unitPrice) || 0;
    const m = supplierId
      ? matchDescription(l.description, items, aliases)
      : { matchedCode: null, matchedItemId: null, confidence: 0, method: "none" as const };
    return {
      rawDescription: l.description,
      qty,
      uom: l.uom || "KG",
      unitPrice,
      subtotal: Math.round(qty * unitPrice * 10000) / 10000,
      matchedCode: m.matchedCode,
      matchedItemId: m.matchedItemId,
      matchConfidence: m.confidence,
      matchMethod: m.method,
    };
  });
}

/** Persist a confirmed/corrected mapping so the same wording auto-matches later. */
export async function learnAlias(
  supplierItemId: string,
  rawDescription: string,
  source = "correction"
): Promise<void> {
  const rawText = normalizeText(rawDescription);
  if (!rawText) return;
  await prisma.itemAlias.upsert({
    where: { supplierItemId_rawText: { supplierItemId, rawText } },
    update: {},
    create: { supplierItemId, rawText, source },
  });
}

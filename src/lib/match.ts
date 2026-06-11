import { normalizeText, similarity } from "@/lib/normalize";

export type SupplierForMatch = {
  id: string;
  name: string;
  aliasTexts: string[];
};

/** Pick the supplier whose name/aliases best match the AI's supplier guess. */
export function matchSupplier(
  guess: string | null,
  suppliers: SupplierForMatch[]
): { supplierId: string | null; confidence: number } {
  if (!guess || suppliers.length === 0) {
    return { supplierId: null, confidence: 0 };
  }
  let best: { id: string; score: number } | null = null;
  for (const s of suppliers) {
    const candidates = [s.name, ...s.aliasTexts];
    const score = Math.max(...candidates.map((c) => similarity(guess, c)));
    if (!best || score > best.score) best = { id: s.id, score };
  }
  if (best && best.score >= 0.45) {
    return { supplierId: best.id, confidence: best.score };
  }
  return { supplierId: null, confidence: best ? best.score : 0 };
}

export type MatchCandidate = {
  itemId: string;
  code: string;
  description: string;
  score: number;
};

export type MatchResult = {
  matchedItemId: string | null;
  matchedCode: string | null;
  confidence: number; // 0..1
  method: "alias" | "fuzzy" | "none";
  candidates: MatchCandidate[]; // top suggestions for the review dropdown
};

export type MatchItem = {
  id: string;
  code: string;
  description: string;
};

export type MatchAlias = {
  supplierItemId: string;
  rawText: string; // already normalized
};

// Below this fuzzy score we don't auto-assign; the row is flagged for review.
export const FUZZY_ACCEPT = 0.62;

/**
 * Resolve one invoice description to a Hock Lee item code, scoped to one supplier.
 * Order: learned alias (exact) -> fuzzy similarity. Returns top candidates either way.
 */
export function matchDescription(
  rawDescription: string,
  items: MatchItem[],
  aliases: MatchAlias[]
): MatchResult {
  const norm = normalizeText(rawDescription);

  // 1) Learned alias exact hit.
  if (norm) {
    const alias = aliases.find((a) => a.rawText === norm);
    if (alias) {
      const item = items.find((i) => i.id === alias.supplierItemId);
      if (item) {
        return {
          matchedItemId: item.id,
          matchedCode: item.code,
          confidence: 1,
          method: "alias",
          candidates: [
            { itemId: item.id, code: item.code, description: item.description, score: 1 },
          ],
        };
      }
    }
  }

  // 2) Fuzzy similarity against this supplier's catalogue.
  const scored: MatchCandidate[] = items
    .map((i) => ({
      itemId: i.id,
      code: i.code,
      description: i.description,
      score: similarity(rawDescription, i.description),
    }))
    .sort((a, b) => b.score - a.score);

  const top = scored.slice(0, 5);
  const best = top[0];

  if (best && best.score >= FUZZY_ACCEPT) {
    return {
      matchedItemId: best.itemId,
      matchedCode: best.code,
      confidence: best.score,
      method: "fuzzy",
      candidates: top,
    };
  }

  return {
    matchedItemId: null,
    matchedCode: null,
    confidence: best ? best.score : 0,
    method: "none",
    candidates: top,
  };
}

// Text utilities for matching fish descriptions that mix Malay + Chinese.

// Strip a leading SQL item code if the invoice/text accidentally includes it.
const CODE_PREFIX = /^\s*\d{2,4}\s*[-:.)]?\s*/;

/** Normalize a description for storage/comparison as a learned alias key. */
export function normalizeText(input: string): string {
  if (!input) return "";
  let s = input.toString().trim();
  s = s.replace(CODE_PREFIX, "");
  s = s.toUpperCase();
  // Drop bracket noise and most punctuation but keep CJK + latin + digits + spaces.
  s = s.replace(/[()\[\]{}（）【】「」、，。．·,.;:'"/\\|*#~`^]+/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

/** Latin word tokens (Malay / English). */
export function latinTokens(s: string): string[] {
  const m = normalizeText(s).match(/[A-Z0-9]+/g);
  return m ? m.filter((t) => t.length > 1) : [];
}

/** Individual CJK (Chinese) characters. */
export function cjkChars(s: string): string[] {
  const m = s.match(/[一-鿿]/g);
  return m ? m : [];
}

function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 0;
  const sa = new Set(a);
  const sb = new Set(b);
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter++;
  const union = new Set([...sa, ...sb]).size;
  return union === 0 ? 0 : inter / union;
}

function containment(a: string[], b: string[]): number {
  // How much of the smaller set is contained in the larger.
  if (a.length === 0 || b.length === 0) return 0;
  const sa = new Set(a);
  const sb = new Set(b);
  const [small, big] = sa.size <= sb.size ? [sa, sb] : [sb, sa];
  let inter = 0;
  for (const x of small) if (big.has(x)) inter++;
  return inter / small.size;
}

/**
 * Similarity score 0..1 between an invoice description and a master description.
 * Considers Chinese characters and Malay tokens independently, then combines.
 */
export function similarity(invoiceDesc: string, masterDesc: string): number {
  const aC = cjkChars(invoiceDesc);
  const bC = cjkChars(masterDesc);
  const aL = latinTokens(invoiceDesc);
  const bL = latinTokens(masterDesc);

  const hasC = aC.length > 0 && bC.length > 0;
  const hasL = aL.length > 0 && bL.length > 0;

  const cjkScore = hasC ? 0.5 * jaccard(aC, bC) + 0.5 * containment(aC, bC) : 0;
  const latScore = hasL ? 0.5 * jaccard(aL, bL) + 0.5 * containment(aL, bL) : 0;

  if (hasC && hasL) {
    // Either side matching strongly is a good signal; reward the stronger one.
    return Math.max(cjkScore, latScore) * 0.7 + Math.min(cjkScore, latScore) * 0.3;
  }
  if (hasC) return cjkScore;
  if (hasL) return latScore;

  // Fallback: exact normalized equality.
  return normalizeText(invoiceDesc) === normalizeText(masterDesc) ? 1 : 0;
}

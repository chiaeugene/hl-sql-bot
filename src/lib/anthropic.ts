import Anthropic from "@anthropic-ai/sdk";

export type ParsedLine = {
  description: string; // fish name as written on the invoice (keep Malay + Chinese)
  qty: number;
  uom: string;
  unitPrice: number;
};

export type ParsedInvoice = {
  supplierGuess: string | null;
  invoiceNo: string | null;
  invoiceDate: string | null;
  lines: ParsedLine[];
};

export type SupportedMedia =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/gif"
  | "application/pdf";

const SYSTEM_PROMPT = `You read scanned fish-supplier invoices for a Malaysian fish distributor (Hock Lee).
Invoices come from different suppliers in different layouts. Fish names are written in a
mix of Malay (e.g. "IKAN TEMENANG", "BAWAL HITAM") and Chinese (e.g. "甘文", "黑鲳"),
often both together. Your job is to transcribe every line item faithfully.

Rules:
- Extract EVERY product/fish line. Do not merge or skip lines.
- Keep the description EXACTLY as printed, including both Malay and Chinese text if present.
- Do NOT invent or normalize item codes; transcribe descriptions only.
- qty and unitPrice are numbers only (no currency symbols, no commas). Use 0 if unreadable.
- uom is the unit of measure (usually "KG"). Default to "KG" if not shown.
- Identify the supplier from the header/letterhead. Return the supplier name text you see.
- Ignore totals, taxes, rounding and summary lines — only individual product rows.`;

const TOOL = {
  name: "submit_invoice",
  description: "Return the structured contents of the invoice.",
  input_schema: {
    type: "object" as const,
    properties: {
      supplierGuess: {
        type: ["string", "null"],
        description: "Supplier/company name as printed on the invoice header.",
      },
      invoiceNo: { type: ["string", "null"] },
      invoiceDate: { type: ["string", "null"] },
      lines: {
        type: "array",
        items: {
          type: "object",
          properties: {
            description: { type: "string" },
            qty: { type: "number" },
            uom: { type: "string" },
            unitPrice: { type: "number" },
          },
          required: ["description", "qty", "uom", "unitPrice"],
        },
      },
    },
    required: ["supplierGuess", "lines"],
  },
};

function buildClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env before using AI parsing."
    );
  }
  return new Anthropic({ apiKey });
}

/**
 * Send an invoice image/PDF (base64) to Claude and get structured line items.
 * `knownSuppliers` is passed as a hint to improve supplier identification.
 */
export async function parseInvoice(
  base64Data: string,
  mediaType: SupportedMedia,
  knownSuppliers: string[]
): Promise<ParsedInvoice> {
  const client = buildClient();
  const model = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

  const contentBlock =
    mediaType === "application/pdf"
      ? {
          type: "document" as const,
          source: {
            type: "base64" as const,
            media_type: "application/pdf" as const,
            data: base64Data,
          },
        }
      : {
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: mediaType,
            data: base64Data,
          },
        };

  const hint =
    knownSuppliers.length > 0
      ? `Known suppliers for this distributor (the invoice is most likely one of these): ${knownSuppliers.join(
          ", "
        )}.`
      : "";

  const message = await client.messages.create({
    model,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: [TOOL],
    tool_choice: { type: "tool", name: "submit_invoice" },
    messages: [
      {
        role: "user",
        content: [
          contentBlock,
          {
            type: "text",
            text: `Transcribe this invoice into structured line items. ${hint}`,
          },
        ],
      },
    ],
  });

  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Model did not return structured invoice data.");
  }

  const input = toolUse.input as Partial<ParsedInvoice>;
  const lines: ParsedLine[] = Array.isArray(input.lines)
    ? input.lines.map((l) => ({
        description: String(l.description ?? "").trim(),
        qty: Number.isFinite(l.qty) ? Number(l.qty) : 0,
        uom: String(l.uom ?? "KG").trim() || "KG",
        unitPrice: Number.isFinite(l.unitPrice) ? Number(l.unitPrice) : 0,
      }))
    : [];

  return {
    supplierGuess: input.supplierGuess ?? null,
    invoiceNo: input.invoiceNo ?? null,
    invoiceDate: input.invoiceDate ?? null,
    lines: lines.filter((l) => l.description.length > 0),
  };
}

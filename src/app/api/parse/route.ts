import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseInvoice, type SupportedMedia } from "@/lib/anthropic";
import { matchSupplier } from "@/lib/match";
import { resolveLines } from "@/lib/resolve";
import { uploadInvoiceFile } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 120;

const ALLOWED: Record<string, SupportedMedia> = {
  "image/jpeg": "image/jpeg",
  "image/jpg": "image/jpeg",
  "image/png": "image/png",
  "image/webp": "image/webp",
  "image/gif": "image/gif",
  "application/pdf": "application/pdf",
};

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "No file uploaded" }, { status: 400 });
  }

  const mediaType = ALLOWED[file.type];
  if (!mediaType) {
    return NextResponse.json(
      { ok: false, error: `Unsupported file type: ${file.type || "unknown"}` },
      { status: 400 }
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const base64 = bytes.toString("base64");

  // Persist the upload to Supabase Storage so the reviewer can see the original
  // next to the table — and so it survives redeploys.
  const id = randomUUID();
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const objectName = `${id}.${ext}`;
  let fileUrl: string | null = null;
  const stored = await uploadInvoiceFile(objectName, bytes, file.type);
  // served by src/app/uploads/[name]/route.ts (auth-gated, streams from Supabase)
  if (stored) fileUrl = `/uploads/${objectName}`;

  // Known suppliers help the model identify the letterhead.
  const suppliers = await prisma.supplier.findMany({
    select: { id: true, name: true, aliases: { select: { text: true } } },
  });

  let parsed;
  try {
    parsed = await parseInvoice(
      base64,
      mediaType,
      suppliers.map((s) => s.name)
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Parsing failed";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }

  // Identify the supplier, then pair each line to a Hock Lee code.
  const { supplierId } = matchSupplier(
    parsed.supplierGuess,
    suppliers.map((s) => ({
      id: s.id,
      name: s.name,
      aliasTexts: s.aliases.map((a) => a.text),
    }))
  );

  const resolved = await resolveLines(supplierId, parsed.lines);

  const invoice = await prisma.invoice.create({
    data: {
      supplierId,
      fileUrl,
      fileName: file.name,
      status: "parsed",
      rawAiJson: JSON.stringify(parsed),
      lines: {
        create: resolved.map((l, i) => ({
          position: i,
          rawDescription: l.rawDescription,
          qty: l.qty,
          uom: l.uom,
          unitPrice: l.unitPrice,
          subtotal: l.subtotal,
          matchedCode: l.matchedCode,
          matchedItemId: l.matchedItemId,
          matchConfidence: l.matchConfidence,
          matchMethod: l.matchMethod,
        })),
      },
    },
  });

  return NextResponse.json({ ok: true, invoiceId: invoice.id });
}

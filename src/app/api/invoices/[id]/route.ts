import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { learnAlias } from "@/lib/resolve";

export const runtime = "nodejs";

type IncomingLine = {
  id?: string;
  position: number;
  rawDescription: string;
  matchedCode: string | null;
  matchedItemId: string | null;
  qty: number;
  uom: string;
  unitPrice: number;
  subtotal: number;
  matchConfidence?: number;
  matchMethod?: string;
  wasEdited?: boolean;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const supplierId: string | null = body.supplierId ?? null;
  const status: string | undefined = body.status;
  const lines: IncomingLine[] = Array.isArray(body.lines) ? body.lines : [];

  const existing = await prisma.invoice.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  // Replace the line set, then re-create from the submitted rows.
  await prisma.invoiceLine.deleteMany({ where: { invoiceId: id } });
  await prisma.invoice.update({
    data: {
      supplierId,
      status: status ?? existing.status,
      lines: {
        create: lines.map((l, i) => ({
          position: l.position ?? i,
          rawDescription: l.rawDescription ?? "",
          matchedCode: l.matchedCode ?? null,
          matchedItemId: l.matchedItemId ?? null,
          qty: Number(l.qty) || 0,
          uom: l.uom || "KG",
          unitPrice: Number(l.unitPrice) || 0,
          subtotal: Number(l.subtotal) || 0,
          matchConfidence: l.matchConfidence ?? 0,
          matchMethod: l.matchMethod ?? "manual",
          wasEdited: l.wasEdited ?? false,
        })),
      },
    },
    where: { id },
  });

  // Learn: any line that ends up mapped to a known item teaches that wording.
  await Promise.all(
    lines
      .filter((l) => l.matchedItemId && l.rawDescription)
      .map((l) => learnAlias(l.matchedItemId as string, l.rawDescription))
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await prisma.invoice.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}

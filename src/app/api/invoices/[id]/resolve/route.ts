import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resolveLines } from "@/lib/resolve";

export const runtime = "nodejs";

// Re-pair the invoice's current descriptions against a (possibly different)
// supplier's catalogue. Used when the reviewer changes the supplier. Does not save.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const supplierId: string | null = body.supplierId ?? null;

  const lines = await prisma.invoiceLine.findMany({
    where: { invoiceId: id },
    orderBy: { position: "asc" },
  });

  const resolved = await resolveLines(
    supplierId,
    lines.map((l) => ({
      description: l.rawDescription,
      qty: l.qty,
      uom: l.uom,
      unitPrice: l.unitPrice,
    }))
  );

  return NextResponse.json({ ok: true, lines: resolved });
}

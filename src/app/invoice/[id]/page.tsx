import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import AppShell from "@/components/AppShell";
import InvoiceEditor, { type EditorLine } from "@/components/InvoiceEditor";

export const dynamic = "force-dynamic";

export default async function InvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ batch?: string }>;
}) {
  await requireAuth();
  const { id } = await params;
  const { batch: batchStr } = await searchParams;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { lines: { orderBy: { position: "asc" } } },
  });
  if (!invoice) notFound();

  const suppliers = await prisma.supplier.findMany({
    orderBy: { name: "asc" },
    include: {
      items: {
        orderBy: { code: "asc" },
        select: { id: true, code: true, description: true },
      },
    },
  });

  const itemsBySupplier: Record<
    string,
    { id: string; code: string; description: string }[]
  > = {};
  for (const s of suppliers) itemsBySupplier[s.id] = s.items;

  const initialLines: EditorLine[] = invoice.lines.map((l) => ({
    id: l.id,
    position: l.position,
    rawDescription: l.rawDescription,
    matchedCode: l.matchedCode,
    matchedItemId: l.matchedItemId,
    qty: l.qty,
    uom: l.uom,
    unitPrice: l.unitPrice,
    subtotal: l.subtotal,
    matchConfidence: l.matchConfidence,
    matchMethod: l.matchMethod,
  }));

  // Queue / batch navigation
  // batchStr is a comma-separated list of ALL invoice IDs in this upload session.
  const batchIds = batchStr ? batchStr.split(",").filter(Boolean) : [];
  const posInBatch = batchIds.indexOf(id);
  const batchTotal = batchIds.length;
  const hasBatch = batchTotal > 1;

  let queueLabel: string | undefined;
  let nextUrl: string | undefined;
  let prevUrl: string | undefined;

  if (hasBatch && posInBatch !== -1) {
    queueLabel = `Invoice ${posInBatch + 1} of ${batchTotal}`;
    if (posInBatch < batchTotal - 1) {
      const nextId = batchIds[posInBatch + 1];
      nextUrl = `/invoice/${nextId}?batch=${batchStr}`;
    }
    if (posInBatch > 0) {
      const prevId = batchIds[posInBatch - 1];
      prevUrl = `/invoice/${prevId}?batch=${batchStr}`;
    }
  }

  return (
    <AppShell wide>
      <div className="space-y-5">
        <nav className="flex items-center gap-1 text-sm text-slate-500">
          <Link href="/" className="transition-colors hover:text-slate-800">
            Dashboard
          </Link>
          <ChevronRight className="h-4 w-4 text-slate-300" />
          <span className="font-medium text-slate-800">
            {invoice.fileName || "Invoice"}
          </span>
          {queueLabel && (
            <>
              <ChevronRight className="h-4 w-4 text-slate-300" />
              <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-xs font-medium text-cyan-700">
                {queueLabel}
              </span>
            </>
          )}
        </nav>

        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Review &amp; export
          </h1>
          {hasBatch && (
            <div className="flex items-center gap-2">
              {prevUrl && (
                <Link
                  href={prevUrl}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  ← Previous
                </Link>
              )}
              {nextUrl ? (
                <Link
                  href={nextUrl}
                  className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white transition hover:bg-[var(--accent-hover)]"
                >
                  Next invoice →
                </Link>
              ) : (
                <Link
                  href="/"
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700"
                >
                  ✓ All done — Dashboard
                </Link>
              )}
            </div>
          )}
        </div>

        <InvoiceEditor
          invoiceId={invoice.id}
          fileUrl={invoice.fileUrl}
          fileName={invoice.fileName}
          initialSupplierId={invoice.supplierId}
          suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
          itemsBySupplier={itemsBySupplier}
          initialLines={initialLines}
        />
      </div>
    </AppShell>
  );
}

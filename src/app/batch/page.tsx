import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import AppShell from "@/components/AppShell";
import BatchEditor from "@/components/BatchEditor";

export const dynamic = "force-dynamic";

export default async function BatchPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  await requireAuth();
  const { ids: idsStr } = await searchParams;
  const ids = idsStr?.split(",").filter(Boolean) ?? [];

  const invoices = await prisma.invoice.findMany({
    where: { id: { in: ids } },
    include: {
      supplier: true,
      lines: { orderBy: { position: "asc" } },
    },
    // Preserve upload order
    orderBy: { createdAt: "asc" },
  });

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

  const batchInvoices = invoices.map((inv) => ({
    id: inv.id,
    fileName: inv.fileName,
    supplierId: inv.supplierId,
    supplierName: inv.supplier?.name ?? null,
    lines: inv.lines.map((l) => ({
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
    })),
  }));

  return (
    <AppShell wide>
      <div className="space-y-5">
        <nav className="flex items-center gap-1 text-sm text-slate-500">
          <Link href="/" className="transition-colors hover:text-slate-800">
            Dashboard
          </Link>
          <ChevronRight className="h-4 w-4 text-slate-300" />
          <span className="font-medium text-slate-800">
            Batch review ({invoices.length} invoices)
          </span>
        </nav>

        <BatchEditor
          invoices={batchInvoices}
          suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
          itemsBySupplier={itemsBySupplier}
        />
      </div>
    </AppShell>
  );
}

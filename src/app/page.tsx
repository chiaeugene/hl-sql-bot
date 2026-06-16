import Link from "next/link";
import {
  FileSpreadsheet,
  Clock,
  Anchor,
  Tags,
  ArrowRight,
  ChevronRight,
} from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import AppShell from "@/components/AppShell";
import UploadZone from "@/components/UploadZone";
import ClickableRow from "@/components/ClickableRow";

export const dynamic = "force-dynamic";

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    parsed: "bg-amber-50 text-amber-700 ring-amber-600/20",
    reviewed: "bg-cyan-50 text-cyan-700 ring-cyan-600/20",
    exported: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  };
  const cls = map[status] || "bg-slate-100 text-slate-600 ring-slate-500/20";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${cls}`}
    >
      {status}
    </span>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tint,
  href,
}: {
  icon: typeof Clock;
  label: string;
  value: number;
  tint: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="glass group flex items-center gap-4 rounded-2xl p-4 transition-all hover:shadow-lg hover:ring-2 hover:ring-[var(--accent)]/30 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
    >
      <span
        className={`grid h-11 w-11 place-items-center rounded-xl transition-transform group-hover:scale-110 ${tint}`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="flex-1">
        <div className="nums text-2xl font-semibold leading-none text-slate-900">
          {value}
        </div>
        <div className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">
          {label}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-slate-300 transition-colors group-hover:text-[var(--accent)]" />
    </Link>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  await requireAuth();
  const { filter } = await searchParams;
  const isPendingFilter = filter === "pending";

  const [invoices, totalInvoices, pending, supplierCount, itemCount] =
    await Promise.all([
      prisma.invoice.findMany({
        where: isPendingFilter ? { status: "parsed" } : undefined,
        orderBy: { createdAt: "desc" },
        take: isPendingFilter ? 50 : 8,
        include: { supplier: true, _count: { select: { lines: true } } },
      }),
      prisma.invoice.count(),
      prisma.invoice.count({ where: { status: "parsed" } }),
      prisma.supplier.count(),
      prisma.supplierItem.count(),
    ]);

  return (
    <AppShell>
      <header className="mb-7">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Dashboard
        </h1>
        <p className="text-slate-600">
          Turn supplier invoices into SQL-ready item codes.
        </p>
      </header>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={FileSpreadsheet}
          label="Invoices"
          value={totalInvoices}
          tint="bg-cyan-50 text-cyan-700"
          href="/#recent-invoices"
        />
        <StatCard
          icon={Clock}
          label="Pending review"
          value={pending}
          tint="bg-amber-50 text-amber-700"
          href="/?filter=pending#recent-invoices"
        />
        <StatCard
          icon={Anchor}
          label="Suppliers"
          value={supplierCount}
          tint="bg-sky-50 text-sky-700"
          href="/master"
        />
        <StatCard
          icon={Tags}
          label="Fish codes"
          value={itemCount}
          tint="bg-teal-50 text-teal-700"
          href="/master"
        />
      </div>

      {/* Upload */}
      <section className="glass mb-8 rounded-2xl p-6 sm:p-7">
        <h2 className="mb-1 text-lg font-semibold tracking-tight text-slate-900">
          New invoice
        </h2>
        <p className="mb-5 max-w-2xl text-sm text-slate-600">
          Upload a scanned invoice — the system reads it, detects the supplier, and
          pairs each fish to its Hock Lee code.
        </p>
        <UploadZone />
      </section>

      {/* Recent invoices */}
      <section id="recent-invoices" className="glass overflow-hidden rounded-2xl">
        <div className="flex items-center justify-between border-b border-white/50 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
              {isPendingFilter ? "Pending review" : "Recent invoices"}
            </h2>
            {isPendingFilter && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                {invoices.length} awaiting review
              </span>
            )}
          </div>
          {isPendingFilter && (
            <Link
              href="/"
              className="text-xs font-medium text-[var(--accent)] hover:underline"
            >
              Show all
            </Link>
          )}
        </div>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-500">
            <tr className="border-b border-white/50">
              <th className="px-5 py-3 text-left font-medium">File</th>
              <th className="px-5 py-3 text-left font-medium">Supplier</th>
              <th className="px-5 py-3 text-right font-medium">Lines</th>
              <th className="px-5 py-3 text-left font-medium">Status</th>
              <th className="px-5 py-3 text-right font-medium">When</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                  No invoices yet. Upload one above to get started.
                </td>
              </tr>
            )}
            {invoices.map((inv) => (
              <ClickableRow
                key={inv.id}
                href={`/invoice/${inv.id}`}
                className="group border-b border-white/40 transition-colors last:border-0 hover:bg-white/50"
              >
                <td className="px-5 py-3 font-medium text-[var(--accent-hover)]">
                  {inv.fileName || "invoice"}
                </td>
                <td className="px-5 py-3 text-slate-700">
                  {inv.supplier?.name || (
                    <span className="text-rose-500">Not detected</span>
                  )}
                </td>
                <td className="nums px-5 py-3 text-right text-slate-700">
                  {inv._count.lines}
                </td>
                <td className="px-5 py-3">
                  <StatusPill status={inv.status} />
                </td>
                <td className="nums px-5 py-3 text-right text-xs text-slate-500">
                  {inv.createdAt.toLocaleDateString()}
                </td>
                <td className="px-3 py-3 text-right">
                  <ArrowRight className="h-4 w-4 text-slate-300 transition-colors group-hover:text-[var(--accent)]" />
                </td>
              </ClickableRow>
            ))}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}

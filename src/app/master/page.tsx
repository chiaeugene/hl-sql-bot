import Link from "next/link";
import { Database, RefreshCw, Save, Trash2, Plus } from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import AppShell from "@/components/AppShell";
import {
  addItem,
  addSupplier,
  deleteItem,
  updateItem,
  reimportMaster,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function MasterPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  await requireAuth();
  const { s } = await searchParams;

  const suppliers = await prisma.supplier.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { items: true } } },
  });

  const selectedId = s || suppliers[0]?.id;
  const items = selectedId
    ? await prisma.supplierItem.findMany({
        where: { supplierId: selectedId },
        orderBy: { code: "asc" },
      })
    : [];
  const selected = suppliers.find((sup) => sup.id === selectedId);

  return (
    <AppShell>
      <div>
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-500">
              <Database className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                Code master
              </h1>
              <p className="text-sm text-slate-500">
                The fish → Hock Lee code list per supplier. Edits here improve future
                matching.
              </p>
            </div>
          </div>
          <form action={reimportMaster}>
            <button className="glass flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-white/80">
              <RefreshCw className="h-4 w-4" /> Re-import from Excel
            </button>
          </form>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-[240px_1fr]">
          {/* Suppliers */}
          <aside className="space-y-3">
            <div className="glass divide-y divide-white/50 overflow-hidden rounded-xl">
              {suppliers.map((sup) => {
                const active = sup.id === selectedId;
                return (
                  <Link
                    key={sup.id}
                    href={`/master?s=${sup.id}`}
                    className={`flex items-center justify-between px-3 py-2.5 text-sm transition-colors ${
                      active
                        ? "bg-slate-50 font-semibold text-slate-900"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {active && (
                        <span className="h-4 w-1 rounded-full bg-[var(--accent)]" />
                      )}
                      <span className={active ? "" : "pl-3"}>{sup.name}</span>
                    </span>
                    <span className="nums rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                      {sup._count.items}
                    </span>
                  </Link>
                );
              })}
            </div>
            <form action={addSupplier} className="flex gap-1.5">
              <input
                name="name"
                placeholder="New supplier"
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-sky-100"
              />
              <button className="cursor-pointer rounded-lg bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-700">
                Add
              </button>
            </form>
          </aside>

          {/* Items */}
          <section className="space-y-3">
            <h2 className="flex items-baseline gap-2 font-semibold text-slate-800">
              {selected?.name || "Select a supplier"}
              <span className="nums text-sm font-normal text-slate-400">
                {items.length} items
              </span>
            </h2>

            <div className="glass overflow-hidden rounded-xl">
              <div className="divide-y divide-white/50">
                {items.map((it) => (
                  <div
                    key={it.id}
                    className="flex items-center gap-2 px-3 py-2 transition-colors hover:bg-slate-50/60"
                  >
                    <form action={updateItem} className="flex flex-1 items-center gap-2">
                      <input type="hidden" name="id" value={it.id} />
                      <input
                        name="code"
                        defaultValue={it.code}
                        className="nums w-24 rounded-md border border-slate-200 px-2 py-1.5 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-sky-100"
                      />
                      <input
                        name="description"
                        defaultValue={it.description}
                        className="flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-sky-100"
                      />
                      <button
                        className="flex cursor-pointer items-center gap-1 rounded-md border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-white"
                        title="Save"
                      >
                        <Save className="h-3.5 w-3.5" /> Save
                      </button>
                    </form>
                    <form action={deleteItem}>
                      <input type="hidden" name="id" value={it.id} />
                      <button
                        className="cursor-pointer rounded-md p-1.5 text-slate-300 transition hover:bg-red-50 hover:text-red-500"
                        title="Delete"
                        aria-label="Delete item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </form>
                  </div>
                ))}
                {items.length === 0 && (
                  <div className="px-3 py-10 text-center text-slate-400">
                    No items yet.
                  </div>
                )}
              </div>
            </div>

            {selectedId && (
              <form
                action={addItem}
                className="flex items-center gap-2 rounded-xl border border-dashed border-cyan-300/60 bg-white/40 p-3"
              >
                <input type="hidden" name="supplierId" value={selectedId} />
                <input
                  name="code"
                  placeholder="Code (e.g. 0028)"
                  className="nums w-32 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-sky-100"
                />
                <input
                  name="description"
                  placeholder="Description (Malay + Chinese)"
                  className="flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-sky-100"
                />
                <button className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white transition hover:bg-[var(--accent-hover)]">
                  <Plus className="h-4 w-4" /> Add item
                </button>
              </form>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}

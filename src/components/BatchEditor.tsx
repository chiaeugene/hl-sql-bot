"use client";

import { useState, useMemo } from "react";
import {
  ClipboardCopy,
  Download,
  Save,
  GraduationCap,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toTSV, toAoA, type ExportLine } from "@/lib/sql-export";
import { FUZZY_ACCEPT } from "@/lib/match";

type Item = { id: string; code: string; description: string };
type Supplier = { id: string; name: string };

export type BatchLine = {
  id?: string;
  position: number;
  rawDescription: string;
  matchedCode: string | null;
  matchedItemId: string | null;
  qty: number;
  uom: string;
  unitPrice: number;
  subtotal: number;
  matchConfidence: number;
  matchMethod: string;
  wasEdited?: boolean;
};

export type BatchInvoice = {
  id: string;
  fileName: string | null;
  supplierId: string | null;
  supplierName: string | null;
  lines: BatchLine[];
};

const numCls =
  "nums w-full rounded border border-slate-200 bg-white px-1.5 py-1 text-right text-xs outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-sky-100";

export default function BatchEditor({
  invoices: initial,
  suppliers,
  itemsBySupplier,
}: {
  invoices: BatchInvoice[];
  suppliers: Supplier[];
  itemsBySupplier: Record<string, Item[]>;
}) {
  const [invoices, setInvoices] = useState<BatchInvoice[]>(initial);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState("");

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  function updateLine(invoiceIdx: number, lineIdx: number, patch: Partial<BatchLine>) {
    setInvoices((prev) => {
      const next = prev.map((inv, ii) => {
        if (ii !== invoiceIdx) return inv;
        const lines = inv.lines.map((l, li) => {
          if (li !== lineIdx) return l;
          const merged = { ...l, ...patch, wasEdited: true };
          if (
            (patch.qty !== undefined || patch.unitPrice !== undefined) &&
            patch.subtotal === undefined
          ) {
            merged.subtotal =
              Math.round((Number(merged.qty) || 0) * (Number(merged.unitPrice) || 0) * 10000) /
              10000;
          }
          return merged;
        });
        return { ...inv, lines };
      });
      return next;
    });
  }

  function pickCode(invoiceIdx: number, lineIdx: number, itemId: string) {
    const inv = invoices[invoiceIdx];
    const items = inv.supplierId ? itemsBySupplier[inv.supplierId] ?? [] : [];
    if (!itemId) {
      updateLine(invoiceIdx, lineIdx, { matchedItemId: null, matchedCode: null, matchMethod: "manual", matchConfidence: 0 });
      return;
    }
    const item = items.find((it) => it.id === itemId);
    if (item) {
      updateLine(invoiceIdx, lineIdx, { matchedItemId: item.id, matchedCode: item.code, matchMethod: "manual", matchConfidence: 1 });
    }
  }

  async function saveInvoice(invoiceIdx: number, markReviewed: boolean) {
    const inv = invoices[invoiceIdx];
    setSaving((s) => ({ ...s, [inv.id]: true }));
    try {
      const res = await fetch(`/api/invoices/${inv.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: inv.supplierId,
          status: markReviewed ? "reviewed" : undefined,
          lines: inv.lines.map((l, i) => ({ ...l, position: i })),
        }),
      });
      flash(res.ok ? (markReviewed ? "Saved & learned" : "Saved") : "Save failed");
    } finally {
      setSaving((s) => ({ ...s, [inv.id]: false }));
    }
  }

  function exportLines(inv: BatchInvoice): ExportLine[] {
    const items = inv.supplierId ? itemsBySupplier[inv.supplierId] ?? [] : [];
    return inv.lines.map((l) => ({
      matchedCode: l.matchedCode,
      // Use the Hock Lee master description for the matched code, not the invoice wording.
      matchedDescription:
        items.find(
          (it) => it.id === l.matchedItemId || it.code === l.matchedCode
        )?.description ?? null,
      rawDescription: l.rawDescription,
      qty: l.qty,
      uom: l.uom,
      unitPrice: l.unitPrice,
      subtotal: l.subtotal,
    }));
  }

  async function copyOne(inv: BatchInvoice) {
    await navigator.clipboard.writeText(toTSV(exportLines(inv)));
    flash(`Copied ${inv.supplierName ?? inv.fileName ?? "invoice"} — paste into SQL Account`);
  }

  async function copyAll() {
    const allLines = invoices.flatMap(exportLines);
    await navigator.clipboard.writeText(toTSV(allLines));
    flash(`Copied ALL ${allLines.length} lines — paste into SQL Account`);
  }

  async function downloadAll() {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    for (const inv of invoices) {
      const aoa = toAoA(exportLines(inv));
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      // Force item-code column (col 0) to text — preserves leading zeros in Excel.
      const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
      for (let r = 1; r <= range.e.r; r++) {
        const ref = XLSX.utils.encode_cell({ r, c: 0 });
        if (ws[ref]) { ws[ref].t = "s"; ws[ref].z = "@"; }
      }
      const sheetName = (inv.supplierName ?? inv.fileName ?? inv.id).slice(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }
    XLSX.writeFile(wb, "batch_SQL.xlsx");
    flash("Excel downloaded — one sheet per invoice");
  }

  function rowCls(l: BatchLine) {
    if (!l.matchedCode) return "border-l-2 border-l-red-400 bg-red-50/40";
    if (l.matchMethod === "fuzzy" && l.matchConfidence < FUZZY_ACCEPT + 0.15)
      return "border-l-2 border-l-amber-400 bg-amber-50/30";
    return "border-l-2 border-l-transparent";
  }

  const totalLines = useMemo(() => invoices.reduce((s, inv) => s + inv.lines.length, 0), [invoices]);
  const unmatchedAll = useMemo(
    () => invoices.reduce((s, inv) => s + inv.lines.filter((l) => !l.matchedCode).length, 0),
    [invoices]
  );

  return (
    <div className="space-y-4">
      {/* Sticky top bar */}
      <div className="glass sticky top-4 z-20 flex flex-wrap items-center gap-3 rounded-2xl px-5 py-3 shadow-md">
        <div className="flex items-center gap-3 text-sm">
          <span className="font-semibold text-slate-800">{invoices.length} invoices</span>
          <span className="text-slate-400">·</span>
          <span className="text-slate-600">{totalLines} lines</span>
          {unmatchedAll > 0 ? (
            <>
              <span className="text-slate-400">·</span>
              <span className="flex items-center gap-1 font-medium text-red-600">
                <AlertTriangle className="h-3.5 w-3.5" />
                {unmatchedAll} unmatched
              </span>
            </>
          ) : (
            <>
              <span className="text-slate-400">·</span>
              <span className="flex items-center gap-1 font-medium text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" />
                All matched
              </span>
            </>
          )}
        </div>
        <div className="ml-auto flex gap-2">
          <button
            onClick={copyAll}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white transition hover:bg-[var(--accent-hover)]"
          >
            <ClipboardCopy className="h-4 w-4" /> Copy ALL for SQL
          </button>
          <button
            onClick={downloadAll}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
          >
            <Download className="h-4 w-4" /> Download ALL .xlsx
          </button>
        </div>
      </div>

      {/* Per-invoice sections */}
      {invoices.map((inv, invoiceIdx) => {
        const items = inv.supplierId ? itemsBySupplier[inv.supplierId] ?? [] : [];
        const isCollapsed = collapsed[inv.id];
        const unmatched = inv.lines.filter((l) => !l.matchedCode).length;
        const total = inv.lines.reduce((s, l) => s + (Number(l.subtotal) || 0), 0);

        return (
          <div key={inv.id} className="glass overflow-hidden rounded-2xl">
            {/* Section header */}
            <div className="flex items-center gap-3 border-b border-white/50 bg-white/40 px-5 py-3">
              <button
                onClick={() => setCollapsed((c) => ({ ...c, [inv.id]: !isCollapsed }))}
                className="cursor-pointer rounded p-0.5 text-slate-400 transition hover:text-slate-700"
              >
                {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </button>
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-slate-900">
                  {inv.supplierName ?? "Unknown supplier"}
                </span>
                <span className="ml-2 text-sm text-slate-500 truncate">{inv.fileName}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 shrink-0">
                {unmatched > 0 ? (
                  <span className="text-red-600 font-medium">{unmatched} unmatched</span>
                ) : (
                  <span className="text-emerald-600 font-medium">✓ matched</span>
                )}
                <span className="nums font-medium text-slate-700">
                  Total: {total.toFixed(2)}
                </span>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => saveInvoice(invoiceIdx, false)}
                  disabled={!!saving[inv.id]}
                  className="flex cursor-pointer items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  <Save className="h-3 w-3" /> Save
                </button>
                <button
                  onClick={() => saveInvoice(invoiceIdx, true)}
                  disabled={!!saving[inv.id]}
                  className="flex cursor-pointer items-center gap-1 rounded bg-[var(--primary)] px-2 py-1 text-xs font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
                >
                  <GraduationCap className="h-3 w-3" /> Save &amp; learn
                </button>
                <button
                  onClick={() => copyOne(inv)}
                  className="flex cursor-pointer items-center gap-1 rounded bg-[var(--accent)] px-2 py-1 text-xs font-medium text-white transition hover:bg-[var(--accent-hover)]"
                >
                  <ClipboardCopy className="h-3 w-3" /> Copy
                </button>
              </div>
            </div>

            {/* Line items table */}
            {!isCollapsed && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="border-b border-white/50 bg-white/60 text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="w-52 px-3 py-2 text-left font-medium">Item code</th>
                      <th className="min-w-[180px] px-3 py-2 text-left font-medium">Description</th>
                      <th className="w-16 px-3 py-2 text-right font-medium">Qty</th>
                      <th className="w-14 px-3 py-2 text-left font-medium">UOM</th>
                      <th className="w-24 px-3 py-2 text-right font-medium">U/Price</th>
                      <th className="w-24 px-3 py-2 text-right font-medium">Subtotal</th>
                      <th className="w-7"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {inv.lines.map((l, lineIdx) => (
                      <tr
                        key={lineIdx}
                        className={`border-t border-slate-100 transition-colors hover:bg-slate-50/60 ${rowCls(l)}`}
                      >
                        <td className="px-2 py-1">
                          <select
                            value={l.matchedItemId ?? ""}
                            onChange={(e) => pickCode(invoiceIdx, lineIdx, e.target.value)}
                            className="nums w-full cursor-pointer rounded border border-slate-200 bg-white px-1 py-1 text-xs outline-none focus:border-[var(--accent)]"
                            title={l.matchedCode ?? "unmatched"}
                          >
                            <option value="">{l.matchedCode ?? "— pick —"}</option>
                            {items.map((it) => (
                              <option key={it.id} value={it.id}>
                                {it.code} — {it.description}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-1">
                          <input
                            value={l.rawDescription}
                            onChange={(e) => updateLine(invoiceIdx, lineIdx, { rawDescription: e.target.value })}
                            className="w-full rounded border border-transparent px-1.5 py-1 text-xs outline-none hover:border-slate-200 focus:border-[var(--accent)]"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input type="number" step="any" value={l.qty}
                            onChange={(e) => updateLine(invoiceIdx, lineIdx, { qty: Number(e.target.value) })}
                            className={numCls} />
                        </td>
                        <td className="px-2 py-1">
                          <input value={l.uom}
                            onChange={(e) => updateLine(invoiceIdx, lineIdx, { uom: e.target.value })}
                            className="w-full rounded border border-slate-200 px-1.5 py-1 text-xs uppercase outline-none focus:border-[var(--accent)]" />
                        </td>
                        <td className="px-2 py-1">
                          <input type="number" step="any" value={l.unitPrice}
                            onChange={(e) => updateLine(invoiceIdx, lineIdx, { unitPrice: Number(e.target.value) })}
                            className={numCls} />
                        </td>
                        <td className="px-2 py-1">
                          <input type="number" step="any" value={l.subtotal}
                            onChange={(e) => updateLine(invoiceIdx, lineIdx, { subtotal: Number(e.target.value) })}
                            className={`${numCls} bg-slate-50 text-slate-600`} />
                        </td>
                        <td className="px-1 py-1 text-center">
                          <button
                            onClick={() =>
                              setInvoices((prev) =>
                                prev.map((inv2, ii) =>
                                  ii !== invoiceIdx
                                    ? inv2
                                    : { ...inv2, lines: inv2.lines.filter((_, li) => li !== lineIdx) }
                                )
                              )
                            }
                            className="cursor-pointer rounded p-0.5 text-slate-300 hover:bg-red-50 hover:text-red-500"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          {toast}
        </div>
      )}
    </div>
  );
}

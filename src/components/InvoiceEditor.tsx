"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  Save,
  GraduationCap,
  ClipboardCopy,
  Download,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Maximize2,
  X,
  ExternalLink,
} from "lucide-react";
import { toTSV, toAoA, type ExportLine } from "@/lib/sql-export";
import { FUZZY_ACCEPT } from "@/lib/match";

type Item = { id: string; code: string; description: string };
type SupplierOpt = { id: string; name: string };

export type EditorLine = {
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

const numInput =
  "nums w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-right outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-sky-100";

export default function InvoiceEditor({
  invoiceId,
  fileUrl,
  fileName,
  initialSupplierId,
  suppliers,
  itemsBySupplier,
  initialLines,
}: {
  invoiceId: string;
  fileUrl: string | null;
  fileName: string | null;
  initialSupplierId: string | null;
  suppliers: SupplierOpt[];
  itemsBySupplier: Record<string, Item[]>;
  initialLines: EditorLine[];
}) {
  const router = useRouter();
  const [supplierId, setSupplierId] = useState<string | null>(initialSupplierId);
  const [lines, setLines] = useState<EditorLine[]>(initialLines);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const items = supplierId ? itemsBySupplier[supplierId] ?? [] : [];
  const isPdf = fileUrl?.toLowerCase().endsWith(".pdf") ?? false;

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const total = useMemo(
    () => lines.reduce((s, l) => s + (Number(l.subtotal) || 0), 0),
    [lines]
  );
  const unmatched = lines.filter((l) => !l.matchedCode).length;

  function updateLine(i: number, patch: Partial<EditorLine>) {
    setLines((prev) => {
      const next = [...prev];
      const merged = { ...next[i], ...patch, wasEdited: true };
      if (
        (patch.qty !== undefined || patch.unitPrice !== undefined) &&
        patch.subtotal === undefined
      ) {
        merged.subtotal =
          Math.round(
            (Number(merged.qty) || 0) * (Number(merged.unitPrice) || 0) * 10000
          ) / 10000;
      }
      next[i] = merged;
      return next;
    });
  }

  function pickCode(i: number, itemId: string) {
    if (!itemId) {
      updateLine(i, {
        matchedItemId: null,
        matchedCode: null,
        matchMethod: "manual",
        matchConfidence: 0,
      });
      return;
    }
    const item = items.find((it) => it.id === itemId);
    if (item) {
      updateLine(i, {
        matchedItemId: item.id,
        matchedCode: item.code,
        matchMethod: "manual",
        matchConfidence: 1,
      });
    }
  }

  function addRow() {
    setLines((prev) => [
      ...prev,
      {
        position: prev.length,
        rawDescription: "",
        matchedCode: null,
        matchedItemId: null,
        qty: 0,
        uom: "KG",
        unitPrice: 0,
        subtotal: 0,
        matchConfidence: 0,
        matchMethod: "manual",
        wasEdited: true,
      },
    ]);
  }

  function removeRow(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function onSupplierChange(newId: string) {
    const sid = newId || null;
    setSupplierId(sid);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplierId: sid }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.lines)) {
        setLines((prev) =>
          prev.map((l, i) => ({
            ...l,
            matchedCode: data.lines[i]?.matchedCode ?? null,
            matchedItemId: data.lines[i]?.matchedItemId ?? null,
            matchConfidence: data.lines[i]?.matchConfidence ?? 0,
            matchMethod: data.lines[i]?.matchMethod ?? "none",
          }))
        );
        flash("Re-matched codes for the selected supplier");
      }
    } catch {
      /* ignore */
    }
  }

  async function save(markReviewed: boolean) {
    setSaving(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId,
          status: markReviewed ? "reviewed" : undefined,
          lines: lines.map((l, i) => ({ ...l, position: i })),
        }),
      });
      if (res.ok) {
        flash(markReviewed ? "Saved — corrections learned" : "Saved");
        router.refresh();
      } else {
        flash("Save failed");
      }
    } finally {
      setSaving(false);
    }
  }

  function exportLines(): ExportLine[] {
    return lines.map((l) => ({
      matchedCode: l.matchedCode,
      rawDescription: l.rawDescription,
      qty: l.qty,
      uom: l.uom,
      unitPrice: l.unitPrice,
      subtotal: l.subtotal,
    }));
  }

  async function copyForSQL() {
    await navigator.clipboard.writeText(toTSV(exportLines()));
    flash("Copied — paste into SQL Account");
  }

  async function downloadXlsx() {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet(toAoA(exportLines()));
    const wb = XLSX.utils.book_new();
    const supplierName =
      suppliers.find((s) => s.id === supplierId)?.name || "INVOICE";
    XLSX.utils.book_append_sheet(wb, ws, supplierName.slice(0, 31));
    XLSX.writeFile(wb, `${supplierName}_SQL.xlsx`);
    flash("Excel downloaded");
  }

  function rowClass(l: EditorLine): string {
    if (!l.matchedCode) return "border-l-2 border-l-red-400 bg-red-50/40";
    if (l.matchMethod === "fuzzy" && l.matchConfidence < FUZZY_ACCEPT + 0.15)
      return "border-l-2 border-l-amber-400 bg-amber-50/30";
    return "border-l-2 border-l-transparent";
  }

  return (
    <>
      {/* ── Main two-column grid ── */}
      {/* Left takes all available space; right is a fixed-width preview panel */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">
        {/* ── Editable table ── */}
        <div className="min-w-0 space-y-4">
          {/* Supplier bar */}
          <div className="glass flex flex-wrap items-center gap-3 rounded-xl px-4 py-3">
            <label className="text-sm font-medium text-slate-700">Supplier</label>
            <select
              value={supplierId ?? ""}
              onChange={(e) => onSupplierChange(e.target.value)}
              className="cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-800 outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-sky-100"
            >
              <option value="">— not detected —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <div className="ml-auto flex items-center gap-4 text-sm">
              {unmatched > 0 ? (
                <span className="flex items-center gap-1.5 font-medium text-red-600">
                  <AlertTriangle className="h-4 w-4" />
                  {unmatched} unmatched
                </span>
              ) : (
                <span className="flex items-center gap-1.5 font-medium text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" />
                  All matched
                </span>
              )}
              <span className="text-slate-500">
                Total <b className="nums ml-1 text-slate-900">{total.toFixed(2)}</b>
              </span>
            </div>
          </div>

          {/* Table — wider columns now that AppShell uses max-w-[110rem] */}
          <div className="glass overflow-x-auto rounded-xl">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 border-b border-white/50 bg-white/70 text-xs uppercase tracking-wide text-slate-500 backdrop-blur">
                <tr>
                  <th className="w-56 px-3 py-2.5 text-left font-medium">Item code</th>
                  <th className="min-w-[220px] px-3 py-2.5 text-left font-medium">
                    Description (from invoice)
                  </th>
                  <th className="w-20 px-3 py-2.5 text-right font-medium">Qty</th>
                  <th className="w-16 px-3 py-2.5 text-left font-medium">UOM</th>
                  <th className="w-28 px-3 py-2.5 text-right font-medium">U/Price</th>
                  <th className="w-28 px-3 py-2.5 text-right font-medium">Subtotal</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr
                    key={i}
                    className={`border-t border-slate-100 transition-colors hover:bg-slate-50/60 ${rowClass(l)}`}
                  >
                    <td className="px-2 py-1.5">
                      <select
                        value={l.matchedItemId ?? ""}
                        onChange={(e) => pickCode(i, e.target.value)}
                        className="nums w-full cursor-pointer rounded-md border border-slate-200 bg-white px-1.5 py-1.5 text-xs outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-sky-100"
                        title={l.matchedCode ?? "unmatched"}
                      >
                        <option value="">
                          {l.matchedCode ? l.matchedCode : "— pick —"}
                        </option>
                        {items.map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.code} — {it.description}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        value={l.rawDescription}
                        onChange={(e) =>
                          updateLine(i, { rawDescription: e.target.value })
                        }
                        className="w-full rounded-md border border-transparent px-2 py-1.5 outline-none transition hover:border-slate-200 focus:border-[var(--accent)] focus:ring-2 focus:ring-sky-100"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        step="any"
                        value={l.qty}
                        onChange={(e) =>
                          updateLine(i, { qty: Number(e.target.value) })
                        }
                        className={numInput}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        value={l.uom}
                        onChange={(e) => updateLine(i, { uom: e.target.value })}
                        className="w-full rounded-md border border-slate-200 px-2 py-1.5 uppercase outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-sky-100"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        step="any"
                        value={l.unitPrice}
                        onChange={(e) =>
                          updateLine(i, { unitPrice: Number(e.target.value) })
                        }
                        className={numInput}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        step="any"
                        value={l.subtotal}
                        onChange={(e) =>
                          updateLine(i, { subtotal: Number(e.target.value) })
                        }
                        className={`${numInput} bg-slate-50 text-slate-600`}
                      />
                    </td>
                    <td className="px-1 py-1.5 text-center">
                      <button
                        onClick={() => removeRow(i)}
                        className="cursor-pointer rounded p-1 text-slate-300 transition hover:bg-red-50 hover:text-red-500"
                        title="Remove row"
                        aria-label="Remove row"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Action bar */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={addRow}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <Plus className="h-4 w-4" /> Add row
            </button>
            <div className="ml-auto flex flex-wrap gap-2">
              <button
                onClick={() => save(false)}
                disabled={saving}
                className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => save(true)}
                disabled={saving}
                className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
              >
                <GraduationCap className="h-4 w-4" /> Save &amp; learn
              </button>
              <button
                onClick={copyForSQL}
                className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white transition hover:bg-[var(--accent-hover)]"
              >
                <ClipboardCopy className="h-4 w-4" /> Copy for SQL
              </button>
              <button
                onClick={downloadXlsx}
                className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
              >
                <Download className="h-4 w-4" /> Download .xlsx
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-400">
            Red rows have no code yet. Pick the correct code, then{" "}
            <b className="text-slate-500">Save &amp; learn</b> so the same invoice
            wording matches automatically next time.
          </p>
        </div>

        {/* ── Original invoice panel ── */}
        <div className="self-start xl:sticky xl:top-8">
          <div className="glass rounded-xl p-2">
            <div className="flex items-center justify-between px-1 pb-2 pt-1">
              <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{fileName || "Original invoice"}</span>
              </p>
              {fileUrl && (
                <div className="flex shrink-0 items-center gap-1">
                  {isPdf ? (
                    <a
                      href={fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open PDF in new tab"
                      className="cursor-pointer rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-[var(--accent)]"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : (
                    <button
                      onClick={() => setLightboxOpen(true)}
                      title="View full size"
                      className="cursor-pointer rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-[var(--accent)]"
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {fileUrl ? (
              isPdf ? (
                <iframe
                  src={fileUrl}
                  className="h-[72vh] w-full rounded-lg"
                  title="Invoice PDF"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={fileUrl}
                  alt="Original invoice"
                  onClick={() => setLightboxOpen(true)}
                  className="w-full cursor-zoom-in rounded-lg transition hover:opacity-90"
                  title="Click to view full size"
                />
              )
            ) : (
              <div className="p-8 text-center text-sm text-slate-400">
                Original not available
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Image lightbox ── */}
      {lightboxOpen && fileUrl && !isPdf && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setLightboxOpen(false)}
        >
          {/* Close button */}
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute right-4 top-4 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/25"
            aria-label="Close preview"
          >
            <X className="h-5 w-5" />
          </button>
          {/* Full-size image — click on image itself shouldn't bubble to dismiss */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fileUrl}
            alt="Invoice full size"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92vh] max-w-[92vw] rounded-xl object-contain shadow-2xl"
          />
          <p className="absolute bottom-4 text-xs text-white/50">
            Click outside to close
          </p>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          {toast}
        </div>
      )}
    </>
  );
}

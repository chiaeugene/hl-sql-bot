"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, Loader2, FileText, CheckCircle2 } from "lucide-react";

type UploadState =
  | { phase: "idle" }
  | { phase: "uploading"; current: number; total: number; fileName: string }
  | { phase: "done"; total: number };

export default function UploadZone() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadState, setUploadState] = useState<UploadState>({ phase: "idle" });
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  async function uploadAll(files: File[]) {
    if (files.length === 0) return;
    setError("");

    const ids: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadState({ phase: "uploading", current: i + 1, total: files.length, fileName: file.name });
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/parse", { method: "POST", body: fd });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.invoiceId) {
          ids.push(data.invoiceId);
        } else {
          setError(`Failed on "${file.name}": ${data.error ?? "Unknown error"}`);
          setUploadState({ phase: "idle" });
          return;
        }
      } catch {
        setError(`Upload failed for "${file.name}". Check your connection.`);
        setUploadState({ phase: "idle" });
        return;
      }
    }

    if (ids.length > 0) {
      setUploadState({ phase: "done", total: ids.length });
      const [first, ...rest] = ids;
      // Encode all IDs in the batch param so any page knows its position + total.
      const batchParam = ids.length > 1 ? `?batch=${ids.join(",")}` : "";
      router.push(`/invoice/${first}${batchParam}`);
    }
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) uploadAll(files);
    // Reset so re-picking same files still fires onChange
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) uploadAll(files);
  }

  const busy = uploadState.phase === "uploading";

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload invoices"
        onClick={() => !busy && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !busy)
            inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onPaste={(e) => {
          const files = Array.from(e.clipboardData.files);
          if (files.length > 0) uploadAll(files);
        }}
        className={`cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center outline-none transition focus:ring-2 focus:ring-cyan-200 ${
          dragging
            ? "border-[var(--accent)] bg-cyan-50/70"
            : "border-cyan-300/60 bg-white/50 hover:border-[var(--accent)] hover:bg-white/70"
        } ${busy ? "pointer-events-none opacity-70" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="hidden"
          onChange={onPick}
        />

        {busy && uploadState.phase === "uploading" ? (
          <div className="space-y-3">
            <Loader2 className="mx-auto h-9 w-9 animate-spin text-[var(--accent)]" />
            <p className="font-medium text-slate-800">
              Reading invoice {uploadState.current} of {uploadState.total}…
            </p>
            <p className="max-w-xs mx-auto truncate text-sm text-slate-500">
              {uploadState.fileName}
            </p>
            <p className="text-xs text-slate-400">
              Identifying supplier and matching fish codes
            </p>
          </div>
        ) : uploadState.phase === "done" ? (
          <div className="space-y-3">
            <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-500" />
            <p className="font-medium text-slate-800">
              {uploadState.total} invoice{uploadState.total > 1 ? "s" : ""} ready — redirecting…
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-[var(--accent)]">
              <UploadCloud className="h-7 w-7" />
            </span>
            <p className="text-lg font-medium text-slate-800">
              Drop, paste, or click to upload invoices
            </p>
            <p className="flex items-center justify-center gap-1.5 text-sm text-slate-500">
              <FileText className="h-4 w-4" />
              One or multiple scanned images (JPG / PNG) or PDFs
            </p>
            <p className="text-xs text-slate-400">
              Select multiple files to review them one by one in sequence
            </p>
          </div>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

import { Fish } from "lucide-react";

export default function Logo({ subtitle = true }: { subtitle?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--primary)] text-white shadow-sm">
        <Fish className="h-5 w-5" strokeWidth={2} />
      </span>
      <div className="leading-tight">
        <div className="font-semibold tracking-tight text-slate-900">Hock Lee</div>
        {subtitle && (
          <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            Invoice → SQL
          </div>
        )}
      </div>
    </div>
  );
}

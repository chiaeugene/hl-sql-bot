// Subtle attribution, fixed to the top-right on every page.
export default function PoweredBy() {
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 sm:right-6">
      <span className="glass pointer-events-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-slate-600">
        <span className="text-slate-400">Powered by</span>
        <span className="font-semibold text-[var(--primary)]">Gong Ji</span>
      </span>
    </div>
  );
}

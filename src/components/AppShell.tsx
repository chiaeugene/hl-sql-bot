import type { ReactNode } from "react";
import Sidebar from "@/components/Sidebar";

// Glass sidebar + content area, floating over the animated aurora background.
// Pass wide=true on pages that benefit from full-width tables (e.g. invoice editor).
export default function AppShell({
  children,
  wide,
}: {
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="relative flex min-h-dvh">
      <Sidebar />
      <div className="min-w-0 flex-1 overflow-x-auto">
        <div
          className={`mx-auto px-4 py-8 sm:px-6 lg:px-8 ${
            wide ? "max-w-[110rem]" : "max-w-6xl"
          }`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

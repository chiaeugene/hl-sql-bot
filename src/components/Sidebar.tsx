"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Fish, LayoutDashboard, Database, LogOut } from "lucide-react";

const links = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/master", label: "Code Master", icon: Database },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/login", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="glass sticky top-0 z-30 flex h-dvh w-16 shrink-0 flex-col rounded-r-2xl px-2 py-4 md:w-60 md:px-3">
      {/* Brand */}
      <Link
        href="/"
        className="mb-6 flex items-center gap-2.5 px-1.5 md:px-2"
        title="Hock Lee"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--primary)] text-white shadow-sm">
          <Fish className="h-5 w-5" strokeWidth={2} />
        </span>
        <span className="hidden leading-tight md:block">
          <span className="block font-semibold tracking-tight text-slate-900">
            Hock Lee
          </span>
          <span className="block text-[11px] font-medium uppercase tracking-wide text-cyan-700/70">
            Invoice → SQL
          </span>
        </span>
      </Link>

      {/* Nav */}
      <nav className="flex flex-col gap-1">
        {links.map((l) => {
          const active =
            l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
          const Icon = l.icon;
          return (
            <Link
              key={l.href}
              href={l.href}
              title={l.label}
              className={`flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm font-medium transition-colors md:px-3 ${
                active
                  ? "bg-[var(--primary)] text-white shadow-sm"
                  : "text-slate-600 hover:bg-white/70 hover:text-slate-900"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="hidden md:inline">{l.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Sign out */}
      <button
        onClick={logout}
        title="Sign out"
        className="mt-auto flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:bg-white/70 hover:text-slate-900 md:px-3"
      >
        <LogOut className="h-5 w-5 shrink-0" />
        <span className="hidden md:inline">Sign out</span>
      </button>
    </aside>
  );
}

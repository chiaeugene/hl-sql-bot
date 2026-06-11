"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Lock, Loader2, Fish } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (res.ok) {
      router.push(next);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data?.error || "Login failed");
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="w-full max-w-sm"
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-[var(--primary)] text-white shadow-lg shadow-cyan-900/20">
            <Fish className="h-7 w-7" strokeWidth={2} />
          </span>
          <div className="text-xl font-semibold tracking-tight text-slate-900">
            Hock Lee
          </div>
          <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-cyan-700/70">
            Invoice → SQL
          </div>
        </div>

        <form onSubmit={submit} className="glass rounded-2xl p-8">
          <h1 className="text-lg font-semibold text-slate-900">Team sign in</h1>
          <p className="mb-6 text-sm text-slate-500">
            Enter the shared accounting team password.
          </p>

          <label htmlFor="pw" className="mb-1.5 block text-sm font-medium text-slate-700">
            Password
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="pw"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              autoComplete="current-password"
              className="w-full rounded-lg border border-slate-300 bg-white/80 py-2.5 pl-9 pr-3 text-slate-900 outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-cyan-200"
              placeholder="••••••••"
            />
          </div>
          {error && (
            <p role="alert" className="mt-2 text-sm text-rose-600">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="mt-5 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 font-medium text-white shadow-sm transition hover:bg-[var(--accent-hover)] disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-slate-500">
          Hock Lee · Invoice → SQL · v1.0
        </p>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

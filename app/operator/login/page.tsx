"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Read `next` directly from window.location rather than useSearchParams(), which would
// require wrapping this page in a Suspense boundary during static generation for one param.
function nextPath(): string {
  if (typeof window === "undefined") return "/operator";
  return new URLSearchParams(window.location.search).get("next") || "/operator";
}

export default function OperatorLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(false);

    const res = await fetch("/api/operator-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push(nextPath());
      router.refresh();
    } else {
      setError(true);
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col gap-3">
        <div className="text-center mb-2">
          <h1 className="text-lg font-semibold">Operator sign-in</h1>
          <p className="text-sm text-neutral-500 mt-1">This area is restricted to school staff.</p>
        </div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Operator password"
          autoFocus
          className="rounded-full border px-4 py-2.5 text-sm focus:outline-none focus:ring-2"
          style={{ borderColor: "var(--border)" }}
        />
        {error && <p className="text-xs text-center" style={{ color: "var(--rose)" }}>Incorrect password.</p>}
        <button
          type="submit"
          disabled={loading || !password}
          className="rounded-full px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: "var(--brand)" }}
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

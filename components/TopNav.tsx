"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CENTER } from "@/lib/constants";

export function TopNav() {
  const pathname = usePathname();
  const isOperator = pathname?.startsWith("/operator");

  return (
    <header className="border-b bg-[var(--card)]" style={{ borderColor: "var(--border)" }}>
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 min-w-0">
          <div
            className="h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-white font-bold text-sm"
            style={{ background: "var(--brand)" }}
          >
            CS
          </div>
          <div className="min-w-0">
            <p className="font-semibold leading-tight truncate">{CENTER.name}</p>
            <p className="text-xs text-neutral-500 leading-tight">Unofficial AI Front Desk Prototype</p>
          </div>
        </Link>
        <nav className="flex gap-1.5 text-sm font-medium shrink-0">
          <Link
            href="/"
            className="px-3 py-1.5 rounded-full transition-colors"
            style={
              !isOperator
                ? { background: "var(--brand)", color: "white" }
                : { color: "var(--foreground)" }
            }
          >
            Parent View
          </Link>
          <Link
            href="/operator"
            className="px-3 py-1.5 rounded-full transition-colors"
            style={
              isOperator
                ? { background: "var(--brand)", color: "white" }
                : { color: "var(--foreground)" }
            }
          >
            Operator View
          </Link>
        </nav>
      </div>
    </header>
  );
}

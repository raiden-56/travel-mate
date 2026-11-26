"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, LayoutDashboard, MapPinned, ScrollText, Users } from "lucide-react";
import { RequireAuth } from "@/components/layout/auth-guards";
import { Logo } from "@/components/layout/site-header";
import { useAuthStore, hasPermission } from "@/lib/auth-store";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, permission: "admin:access" },
  { href: "/admin/destinations", label: "Destinations", icon: MapPinned, permission: "destination:write" },
  { href: "/admin/users", label: "Users", icon: Users, permission: "user:read" },
  { href: "/admin/audit", label: "Audit log", icon: ScrollText, permission: "audit:read" },
];

function AdminNav() {
  const pathname = usePathname().replace(/(.)\/$/, "$1");
  const user = useAuthStore((s) => s.user);
  const items = nav.filter((n) => hasPermission(user, n.permission));
  return (
    <ul className="flex gap-1 overflow-x-auto lg:flex-col">
      {items.map((n) => {
        const active = n.href === "/admin" ? pathname === "/admin" : pathname.startsWith(n.href.replace(/s$/, ""));
        return (
          <li key={n.href}>
            <Link
              href={n.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium",
                active ? "bg-forest text-on-forest" : "text-ink-muted hover:bg-surface-muted hover:text-ink",
              )}
            >
              <n.icon className="size-4" aria-hidden /> {n.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth permission="admin:access">
      <div className="min-h-dvh lg:grid lg:grid-cols-[232px_1fr]">
        <aside className="border-b border-line bg-surface px-4 py-4 lg:sticky lg:top-0 lg:h-dvh lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between lg:block">
            <Logo />
            <span className="rounded bg-terracotta-soft px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-terracotta lg:mt-2 lg:inline-block">Admin</span>
          </div>
          <nav aria-label="Admin" className="mt-4 lg:mt-8">
            <AdminNav />
          </nav>
          <Link href="/home" className="mt-6 hidden items-center gap-1.5 px-3 text-[13px] text-ink-muted hover:text-ink lg:flex">
            <ArrowLeft className="size-4" /> Back to app
          </Link>
        </aside>
        <main id="main" className="min-w-0 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </RequireAuth>
  );
}
